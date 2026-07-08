"""
AI Sidebar Bridge Server
========================
A small FastAPI server that sits between the Chrome extension and
Claude Code. It receives {question, page content, history} from the
sidebar, runs Claude Code headless (`claude -p`), and returns the answer.

Model routing works by setting environment variables per request:
  - DeepSeek:   ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
  - OpenRouter: ANTHROPIC_BASE_URL=https://openrouter.ai/api
  - Claude:     no override (uses your normal Claude Code auth)

Run it:
    cd bridge
    pip install -r requirements.txt
    copy .env.example .env   (then put your API keys in .env)
    uvicorn server:app --port 8765
"""

import json
import os
import shutil
import subprocess

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load API keys from the .env file sitting next to this script
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(title="AI Sidebar Bridge")

# The extension runs on a chrome-extension:// origin, so allow all origins.
# This server only listens on localhost, so this is safe.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Provider registry: which env vars to give Claude Code for each backend
# ---------------------------------------------------------------------------

def get_providers():
    return {
        "deepseek": {
            "env": {
                "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
                "ANTHROPIC_AUTH_TOKEN": os.getenv("DEEPSEEK_API_KEY", ""),
                "ANTHROPIC_API_KEY": "",
            },
            # Without a model set, DeepSeek maps Claude Code's default model
            # name automatically (opus -> v4-pro, sonnet/haiku -> v4-flash).
            # We pin it explicitly so you always know what you're paying for.
            "default_model": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
            "key_name": "DEEPSEEK_API_KEY",
        },
        "openrouter": {
            "env": {
                "ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
                "ANTHROPIC_AUTH_TOKEN": os.getenv("OPENROUTER_API_KEY", ""),
                "ANTHROPIC_API_KEY": "",
            },
            # OpenRouter needs an explicit model slug.
            "default_model": os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-chat"),
            "key_name": "OPENROUTER_API_KEY",
        },
        "claude": {
            # No overrides: uses whatever Claude Code is already set up with.
            "env": {},
            "default_model": None,
            "key_name": None,
        },
    }


# ---------------------------------------------------------------------------
# Request / response shapes
# ---------------------------------------------------------------------------

class PageMetadata(BaseModel):
    url: str = "unknown"
    title: str = "unknown"
    mainContent: str = ""


class HistoryMessage(BaseModel):
    role: str
    content: object  # can be a string or a rich content list


class Attachment(BaseModel):
    type: str  # "image" | "text"
    name: str = "file"
    content: str = ""


class ChatRequest(BaseModel):
    question: str = ""
    metadata: PageMetadata = PageMetadata()
    history: list[HistoryMessage] = []
    attachment: Attachment | None = None
    provider: str = "deepseek"
    model: str | None = None
    effort: str | None = None  # "low" | "medium" | "high"


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------

MAX_PAGE_CHARS = 15000
MAX_HISTORY_MESSAGES = 10


def history_to_text(history: list[HistoryMessage]) -> str:
    """Flatten prior messages into a readable transcript."""
    lines = []
    for msg in history[-MAX_HISTORY_MESSAGES:]:
        content = msg.content
        if isinstance(content, list):
            # Rich content: keep only the text parts
            content = " ".join(
                part.get("text", "") for part in content if isinstance(part, dict)
            )
        lines.append(f"{msg.role}: {content}")
    return "\n".join(lines)


def build_prompt(req: ChatRequest) -> str:
    page = req.metadata.mainContent[:MAX_PAGE_CHARS] or "[No page content extracted]"

    parts = [
        "You are a helpful assistant running inside a browser side panel.",
        "Answer the user's question about the web page below.",
        "Be concise and direct. Answer in plain text or simple markdown.",
        "",
        "[CURRENT PAGE]",
        f"URL: {req.metadata.url}",
        f"Title: {req.metadata.title}",
        f"Content: {page}",
    ]

    if req.history:
        parts += ["", "[CONVERSATION SO FAR]", history_to_text(req.history)]

    if req.attachment and req.attachment.type == "text":
        parts += ["", f"[ATTACHED FILE: {req.attachment.name}]", req.attachment.content]

    parts += ["", "[USER QUESTION]", req.question or "Summarize this page."]
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Claude Code invocation
# ---------------------------------------------------------------------------

def run_claude_code(prompt: str, env_overrides: dict, model: str | None) -> dict:
    claude_bin = shutil.which("claude")
    if not claude_bin:
        raise HTTPException(
            status_code=500,
            detail="Claude Code CLI not found. Install it and make sure "
                   "'claude' is on your PATH.",
        )

    cmd = [claude_bin, "-p", prompt, "--output-format", "json"]
    if model:
        cmd += ["--model", model]

    env = {**os.environ, **env_overrides}

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
            timeout=180,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Claude Code timed out (180s).")

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "unknown error").strip()[-2000:]
        raise HTTPException(status_code=502, detail=f"Claude Code failed: {detail}")

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail=f"Could not parse Claude Code output: {result.stdout[:500]}",
        )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    claude_bin = shutil.which("claude")
    providers = get_providers()
    return {
        "status": "ok",
        "claude_cli_found": claude_bin is not None,
        "providers": {
            name: bool(p["key_name"] is None or os.getenv(p["key_name"]))
            for name, p in providers.items()
        },
    }


@app.post("/chat")
def chat(req: ChatRequest):
    providers = get_providers()
    provider = providers.get(req.provider)
    if not provider:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider '{req.provider}'. "
                   f"Available: {', '.join(providers)}",
        )

    # Make sure the API key for this provider is configured
    key_name = provider["key_name"]
    if key_name and not os.getenv(key_name):
        raise HTTPException(
            status_code=400,
            detail=f"Missing {key_name} in bridge/.env — add your key and restart.",
        )

    # v1 limitation: image attachments only work with direct API providers
    if req.attachment and req.attachment.type == "image":
        raise HTTPException(
            status_code=400,
            detail="Image attachments aren't supported through the bridge yet. "
                   "Switch to a direct API provider for images.",
        )

    prompt = build_prompt(req)
    model = req.model or provider["default_model"]

    env_overrides = dict(provider["env"])
    if req.effort in ("low", "medium", "high"):
        # Controls how much reasoning Claude Code asks the model for
        env_overrides["CLAUDE_CODE_EFFORT_LEVEL"] = req.effort

    output = run_claude_code(prompt, env_overrides, model)

    if output.get("is_error"):
        raise HTTPException(status_code=502, detail=str(output.get("result", "error")))

    return {
        "answer": output.get("result", ""),
        "provider": req.provider,
        "model": model or "provider default",
        "cost_usd": output.get("total_cost_usd"),
        "duration_ms": output.get("duration_ms"),
    }
