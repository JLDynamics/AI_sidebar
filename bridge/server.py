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
import re
import shutil
import subprocess
import time

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load API keys from the .env file sitting next to this script.
# override=True so bridge/.env wins over a stale DEEPSEEK_API_KEY (etc.)
# already present in the shell — otherwise Claude Code gets 401s and retries
# for minutes until our 180s timeout looks like a "hang".
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

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


class SessionPage(BaseModel):
    url: str = ""
    title: str = ""
    markdown: str = ""


class ChatRequest(BaseModel):
    question: str = ""
    metadata: PageMetadata = PageMetadata()
    history: list[HistoryMessage] = []
    attachment: Attachment | None = None
    provider: str = "deepseek"
    model: str | None = None
    effort: str | None = None  # "low" | "medium" | "high"
    mode: str | None = None  # None (normal chat) | "factcheck"
    # Cross-page memory: other pages viewed this session. They're written to
    # per-session files the agent greps on demand (not inlined into the prompt).
    session_id: str = ""
    # Legacy: older clients sent the session's other pages here. The bridge now
    # accumulates pages from `metadata` itself, so this is optional/backward-compat.
    session_pages: list[SessionPage] = []


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------

MAX_PAGE_CHARS = 20000
# Pages are the source of truth here on disk (not in the browser). A session's
# pages are deleted immediately when the chat is deleted (see /memory/{id}).
# This prune is only a safety net for orphaned folders — e.g. a chat deleted
# while the bridge was offline, so the delete signal never arrived.
MEMORY_PRUNE_DAYS = 90
# Per-page content cap for stored memory files (bounds what the agent reads).
MEMORY_PAGE_CHARS = 8000
# Only run the orphan prune this often, not on every request.
PRUNE_INTERVAL_SECONDS = 3600
_last_prune_at = 0.0


# ---------------------------------------------------------------------------
# Session memory (files the agent greps, instead of inlining page text)
# ---------------------------------------------------------------------------

def _memory_root() -> str:
    """Base folder for session memory, inside the agent's working directory."""
    workdir = get_agent_config()["workdir"] or os.path.join(
        os.path.dirname(__file__), "workspace"
    )
    return os.path.join(workdir, "memory")


def _safe_session_id(session_id: str) -> str:
    """Sanitize a session id into a safe folder name (no path traversal)."""
    clean = re.sub(r"[^A-Za-z0-9_-]", "", session_id or "")[:64]
    return clean or "default"


def _prune_old_memory(root: str) -> None:
    """Delete session folders whose newest file is older than the cutoff."""
    cutoff = time.time() - MEMORY_PRUNE_DAYS * 86400
    try:
        for name in os.listdir(root):
            path = os.path.join(root, name)
            if not os.path.isdir(path):
                continue
            files = [os.path.join(path, f) for f in os.listdir(path)]
            if not files:
                continue  # freshly-created / in-progress folder; leave it alone
            newest = max(os.path.getmtime(f) for f in files)
            if newest < cutoff:
                shutil.rmtree(path, ignore_errors=True)
    except OSError:
        pass


def _page_filename(url: str) -> str:
    """Stable .md filename from a URL so revisits overwrite the same file."""
    stem = re.sub(r"[^A-Za-z0-9]", "_", url)[:80] or "page"
    return f"{stem}.md"


def _write_doc(path: str, doc: str) -> bool:
    """Write a Markdown doc, skipping the write if the file is already identical
    (just refresh its mtime so the prune keeps treating it as active)."""
    try:
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                if f.read() == doc:
                    os.utime(path, None)  # unchanged — keep fresh, skip rewrite
                    return True
        with open(path, "w", encoding="utf-8") as f:
            f.write(doc)
        return True
    except OSError as e:
        print(f"Failed to write memory file {path}: {e}")
        return False


def _write_page_file(session_dir: str, url: str, title: str, content: str) -> bool:
    """Write one page's Markdown file. Returns True if written/kept."""
    body = (content or "").strip()
    if not body or url in ("", "unknown"):
        return False
    doc = f"# {title or url}\nURL: {url}\n\n{body[:MEMORY_PAGE_CHARS]}\n"
    return _write_doc(os.path.join(session_dir, _page_filename(url)), doc)


def _write_attachment_file(session_dir: str, name: str, content: str) -> bool:
    """Write an attached file's content so the agent can read it on demand
    across turns (instead of it being re-sent in the prompt every message)."""
    body = (content or "").strip()
    if not body:
        return False
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", name or "file")[:80] or "file"
    doc = f"# Attached file: {name or safe}\n\n{body}\n"
    return _write_doc(os.path.join(session_dir, f"attachment__{safe}.md"), doc)


def _session_has_files(session_dir: str) -> bool:
    return os.path.isdir(session_dir) and any(
        f.endswith(".md") for f in os.listdir(session_dir)
    )


def sync_session_memory(
    session_id: str,
    current_page: dict | None,
    extra_pages: list[SessionPage] | None = None,
    attachment=None,
) -> str | None:
    """
    Accumulate this session's pages AND attached files as Markdown files the
    agent can grep/read on demand.

    Pages ACCUMULATE: the current page is upserted (added or refreshed) and
    every previously stored page/file is KEPT. There is no count cap — disk,
    not the 5MB browser quota, is the limit now. Files are removed only when the
    chat is deleted (DELETE /memory/{id}); the age prune is a safety net for
    orphaned folders and runs at most once per PRUNE_INTERVAL_SECONDS.

    Returns the folder path if it holds any files, else None.
    """
    global _last_prune_at
    root = _memory_root()
    session_dir = os.path.join(root, _safe_session_id(session_id))

    now = time.time()
    if os.path.isdir(root) and now - _last_prune_at > PRUNE_INTERVAL_SECONDS:
        _prune_old_memory(root)  # sweep orphaned folders (best-effort)
        _last_prune_at = now

    # Collect pages to upsert this turn: the current page, plus any legacy
    # session_pages an older client might still send (backward compatible).
    pages = []
    if current_page and current_page.get("url"):
        pages.append((current_page.get("url"), current_page.get("title", ""), current_page.get("content", "")))
    for p in (extra_pages or []):
        if p.url:
            pages.append((p.url, p.title, p.markdown))

    has_attachment = (
        attachment is not None
        and getattr(attachment, "type", None) == "text"
        and (attachment.content or "").strip()
    )

    if pages or has_attachment:
        os.makedirs(session_dir, exist_ok=True)
        for url, title, content in pages:
            _write_page_file(session_dir, url, title, content)
        if has_attachment:
            _write_attachment_file(session_dir, attachment.name, attachment.content)

    # Point the agent at the folder if it has anything worth grepping.
    return session_dir if _session_has_files(session_dir) else None


def history_to_text(history: list[HistoryMessage]) -> str:
    """Flatten prior messages into a readable transcript (no cap — the browser
    sends the full conversation; these chats stay well within model limits)."""
    lines = []
    for msg in history:
        content = msg.content
        if isinstance(content, list):
            # Rich content: keep only the text parts
            content = " ".join(
                part.get("text", "") for part in content if isinstance(part, dict)
            )
        lines.append(f"{msg.role}: {content}")
    return "\n".join(lines)


def build_factcheck_prompt(req: ChatRequest) -> str:
    """Prompt that turns the agent into a fact-checker with cited sources."""
    page = req.metadata.mainContent[:MAX_PAGE_CHARS] or "[No page content extracted]"

    if req.question.strip():
        task = (
            f'Fact-check this specific claim: "{req.question.strip()}"\n'
            "Use the page below for context if relevant."
        )
    else:
        task = (
            "Identify the main factual claims on the page below and fact-check "
            "the most important ones (aim for 3-6 claims)."
        )

    parts = [
        "You are a rigorous fact-checking assistant with web search tools.",
        "Verify claims against current, reputable, independent sources — do NOT "
        "rely on the page itself or your own memory to confirm a claim.",
        "",
        "[TASK]",
        task,
        "",
        "[METHOD]",
        "For each claim:",
        "1. State the claim in one short sentence.",
        "2. Search the web and open sources to check it.",
        "3. Give a verdict in bold: **Supported**, **Partly supported**, "
        "**Unsupported**, or **Unclear**.",
        "4. Explain briefly, citing sources inline with [1], [2], ... markers.",
        "",
        "End with a '## Sources' section listing each source as a numbered "
        "Markdown link: `1. [Page title](https://url)`. Only list sources you "
        "actually opened. If you cannot verify a claim, say so rather than guessing.",
        "Be concise.",
        "",
        "[CURRENT PAGE]",
        f"URL: {req.metadata.url}",
        f"Title: {req.metadata.title}",
        f"Content: {page}",
    ]

    if req.history:
        parts += ["", "[CONVERSATION SO FAR]", history_to_text(req.history)]

    return "\n".join(parts)


def build_prompt(req: ChatRequest, memory_dir: str | None = None) -> str:
    if req.mode == "factcheck":
        return build_factcheck_prompt(req)

    page = req.metadata.mainContent[:MAX_PAGE_CHARS] or "[No page content extracted]"

    parts = [
        "You are a helpful assistant running inside a browser side panel.",
        "Answer the user's question about the web page below.",
        "You have tools available (web search, file access, shell). Use them when "
        "they would genuinely improve or verify the answer — for example, search "
        "the web when the page doesn't contain the answer. Don't use tools when the "
        "page already answers the question.",
        "Be concise and direct. Answer in plain text or simple markdown.",
        "",
        "[CURRENT PAGE]",
        f"URL: {req.metadata.url}",
        f"Title: {req.metadata.title}",
        f"Content: {page}",
    ]

    if memory_dir:
        parts += [
            "",
            "[SESSION MEMORY]",
            "Earlier pages the user viewed and any files they shared this session "
            f"are saved as Markdown files in this folder:\n{memory_dir}",
            "Page files start with the page's title and URL; shared files are named "
            "attachment__<name>.md. The CURRENT page above is already included, so "
            "you don't need to read it from here. If the question refers to another "
            "page or a previously shared file, use your file tools (Glob/Grep/Read) "
            "on that folder to find and read the relevant one(s). Skip this if the "
            "current page already answers the question.",
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

def _text_from_assistant_event(event: dict) -> str:
    """Pull plain text out of a stream-json assistant event."""
    message = event.get("message") or {}
    parts = []
    for block in message.get("content") or []:
        if isinstance(block, dict) and block.get("type") == "text":
            t = block.get("text")
            if t:
                parts.append(t)
    return "".join(parts)


def parse_claude_stream(stdout: str) -> dict:
    """
    Parse Claude Code --output-format stream-json.

    Some cheap models (e.g. OpenRouter Hy3) stream real answer text in
    assistant events, but leave the final result.result field empty.
    Prefer result.result when present; otherwise recover text from assistant events.
    """
    final = None
    texts: list[str] = []

    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        etype = event.get("type")
        if etype == "assistant":
            chunk = _text_from_assistant_event(event)
            if chunk:
                texts.append(chunk)
        elif etype == "result":
            final = event

    if final is None:
        raise HTTPException(
            status_code=502,
            detail=f"Could not parse Claude Code stream output: {stdout[:500]}",
        )

    answer = (final.get("result") or "").strip()
    if not answer and texts:
        answer = "".join(texts).strip()
        final = {**final, "result": answer}

    return final


# ---------------------------------------------------------------------------
# Agent configuration (env-driven, read fresh each request)
# ---------------------------------------------------------------------------

def _env_flag(name: str, default: bool) -> bool:
    return os.getenv(name, "1" if default else "0").strip().lower() in (
        "1", "true", "yes", "on",
    )


def get_agent_config() -> dict:
    """
    Controls how much of Claude Code's agent the bridge unleashes.

    Defaults = FULL abilities: every tool available, permission prompts skipped,
    multi-turn agent loop on. That means any request that reaches this server
    (it listens on localhost:8765) can make Claude Code run shell commands and
    edit files. Keep the port private. To lock it down without code changes:

        CLAUDE_SKIP_PERMISSIONS=0
        CLAUDE_RESTRICT_TOOLS="WebSearch,WebFetch"   # web-only, read-nothing-else
        CLAUDE_ALLOWED_TOOLS="WebSearch,WebFetch"    # auto-approve just these
    """
    return {
        # Skip all permission prompts (needed for autonomous tool use headless).
        "skip_permissions": _env_flag("CLAUDE_SKIP_PERMISSIONS", True),
        # Auto-approve only these tools (used when skip_permissions is off).
        "allowed_tools": os.getenv("CLAUDE_ALLOWED_TOOLS", "").strip(),
        # Restrict which tools even exist. Empty => all tools available.
        "restrict_tools": os.getenv("CLAUDE_RESTRICT_TOOLS", "").strip(),
        # Cap agent turns so nothing runs away. Blank => Claude Code's default.
        "max_turns": os.getenv("CLAUDE_MAX_TURNS", "20").strip(),
        # Wall-clock limit for the whole agent run.
        "timeout": int(os.getenv("CLAUDE_TIMEOUT", "600")),
        # Where file/shell tools operate. Blank => bridge/workspace/.
        "workdir": os.getenv("CLAUDE_WORKDIR", "").strip(),
        # Comma-separated extra dirs the agent may read/edit.
        "add_dirs": os.getenv("CLAUDE_ADD_DIRS", "").strip(),
        # Ignore globally-configured MCP servers (avoids startup hangs).
        "strict_mcp": _env_flag("CLAUDE_STRICT_MCP", True),
    }


def run_claude_code(
    prompt: str,
    env_overrides: dict,
    model: str | None,
    effort: str | None = None,
) -> dict:
    claude_bin = shutil.which("claude")
    if not claude_bin:
        raise HTTPException(
            status_code=500,
            detail="Claude Code CLI not found. Install it and make sure "
                   "'claude' is on your PATH.",
        )

    # Claude Code runs headless as a full agent: provider env + --model pick the
    # cheap inference model (DeepSeek, OpenRouter Hy3, etc.), but Claude Code's
    # harness, tools, and multi-turn agent loop stay ON. That harness is what
    # lets a cheap model punch above its weight — it can web-search, read/edit
    # files, run shell, and self-correct across turns instead of one-shotting.
    #
    # stream-json: recover answers when result.result is empty (some models).
    # --strict-mcp-config: ignore global MCP servers unless CLAUDE_STRICT_MCP=0.
    # Tool access + turn limits are controlled by env (see get_agent_config).
    cfg = get_agent_config()

    cmd = [
        claude_bin,
        "-p",
        prompt,
        "--output-format",
        "stream-json",
        "--verbose",
    ]
    if cfg["strict_mcp"]:
        cmd += ["--strict-mcp-config"]

    # Which tools EXIST for this run. Empty => every tool is available (full mode).
    # Set CLAUDE_RESTRICT_TOOLS="WebSearch,WebFetch" to narrow the toolbox.
    if cfg["restrict_tools"]:
        cmd += ["--tools", cfg["restrict_tools"]]

    # How tools get APPROVED. On a headless server there's no one to click "allow",
    # so either skip prompts entirely (full mode) or pre-approve a safe allowlist.
    if cfg["skip_permissions"]:
        cmd += ["--dangerously-skip-permissions"]
    elif cfg["allowed_tools"]:
        cmd += ["--allowedTools", cfg["allowed_tools"]]

    # Bound the agent loop so a runaway task can't burn time/tokens forever.
    if cfg["max_turns"]:
        cmd += ["--max-turns", cfg["max_turns"]]

    # Extra folders the agent may read/edit.
    for extra_dir in [p.strip() for p in cfg["add_dirs"].split(",") if p.strip()]:
        cmd += ["--add-dir", extra_dir]

    if model:
        cmd += ["--model", model]
    if effort in ("low", "medium", "high", "xhigh", "max"):
        cmd += ["--effort", effort]

    # Where Bash/Write/Edit operate. Defaults to a dedicated bridge/workspace/
    # folder so the agent doesn't scribble over the extension source by accident.
    workdir = cfg["workdir"] or os.path.join(os.path.dirname(__file__), "workspace")
    os.makedirs(workdir, exist_ok=True)

    env = {**os.environ, **env_overrides}
    # Blank override values mean "unset" — a present-but-empty key can confuse auth.
    for key, value in env_overrides.items():
        if value == "":
            env.pop(key, None)
    if effort in ("low", "medium", "high", "xhigh", "max"):
        env["CLAUDE_CODE_EFFORT_LEVEL"] = effort

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
            cwd=workdir,
            stdin=subprocess.DEVNULL,
            timeout=cfg["timeout"],
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail=f"Claude Code timed out ({cfg['timeout']}s). Long agent runs can "
                   f"exceed this — raise CLAUDE_TIMEOUT or lower CLAUDE_MAX_TURNS.",
        )

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "unknown error").strip()[-2000:]
        raise HTTPException(status_code=502, detail=f"Claude Code failed: {detail}")

    return parse_claude_stream(result.stdout or "")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    claude_bin = shutil.which("claude")
    providers = get_providers()
    cfg = get_agent_config()
    return {
        "status": "ok",
        "claude_cli_found": claude_bin is not None,
        "providers": {
            name: bool(p["key_name"] is None or os.getenv(p["key_name"]))
            for name, p in providers.items()
        },
        "agent": {
            "mode": "full (all tools, permissions skipped)"
            if cfg["skip_permissions"] and not cfg["restrict_tools"]
            else "restricted",
            "skip_permissions": cfg["skip_permissions"],
            "tools": cfg["restrict_tools"] or cfg["allowed_tools"] or "all",
            "max_turns": cfg["max_turns"] or "unlimited",
            "timeout_s": cfg["timeout"],
            "workdir": cfg["workdir"]
            or os.path.join(os.path.dirname(__file__), "workspace"),
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

    # Accumulate the current page into this session's on-disk memory (kept
    # across turns, deleted when the chat is deleted). The agent greps these
    # files on demand instead of us inlining every page into the prompt.
    current_page = {
        "url": req.metadata.url,
        "title": req.metadata.title,
        "content": req.metadata.mainContent,
    }
    memory_dir = sync_session_memory(
        req.session_id, current_page, req.session_pages, attachment=req.attachment
    )

    prompt = build_prompt(req, memory_dir=memory_dir)
    model = req.model or provider["default_model"]
    effort = req.effort if req.effort in ("low", "medium", "high") else None

    env_overrides = dict(provider["env"])
    output = run_claude_code(prompt, env_overrides, model, effort=effort)

    if output.get("is_error"):
        raise HTTPException(status_code=502, detail=str(output.get("result", "error")))

    answer = (output.get("result") or "").strip()
    # Claude Code sometimes finishes OK but leaves result empty (seen with some
    # OpenRouter models). Report it clearly instead of a blank sidebar bubble.
    if not answer:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Claude Code returned an empty answer for model "
                f"'{model or 'provider default'}'. Try again, or pick another "
                f"cheap model (e.g. deepseek-v4-flash)."
            ),
        )

    return {
        "answer": answer,
        "provider": req.provider,
        "model": model or "provider default",
        "effort": effort,
        "cost_usd": output.get("total_cost_usd"),
        "duration_ms": output.get("duration_ms"),
        "num_turns": output.get("num_turns"),
    }


@app.delete("/memory/{session_id}")
def forget_session(session_id: str):
    """Delete a session's remembered pages (called when a chat is deleted)."""
    session_dir = os.path.join(_memory_root(), _safe_session_id(session_id))
    shutil.rmtree(session_dir, ignore_errors=True)
    return {"status": "ok", "forgotten": session_id}
