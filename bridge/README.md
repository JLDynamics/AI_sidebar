# AI Sidebar Bridge

Connects the AI Sidebar Chrome extension to **Claude Code** running on your
computer, so the sidebar can use cheap third-party models (DeepSeek,
OpenRouter) instead of a claude.ai subscription or expensive APIs.

```
Sidebar extension ──HTTP──> this bridge (localhost:8765) ──> claude -p ──> DeepSeek / OpenRouter
```

## Requirements

- Python 3.10+
- Claude Code CLI installed (`claude --version` should work in a terminal)
- A DeepSeek and/or OpenRouter API key

## Setup

```bash
cd bridge
pip install -r requirements.txt
copy .env.example .env        # macOS/Linux: cp .env.example .env
```

Edit `.env` and paste in your API keys.

## Run

```bash
uvicorn server:app --port 8765
```

Check it works: open http://127.0.0.1:8765/health — you should see
`"claude_cli_found": true` and `true` for each provider you added a key for.

Then open the sidebar in Chrome, pick a "Claude Code" provider from the
dropdown, and ask a question about any page.

## Endpoints

- `GET /health` — is the CLI found, which provider keys are configured
- `POST /chat` — `{question, metadata, history, attachment, provider, model}`
  → `{answer, provider, model, cost_usd, duration_ms}`

## Notes

- Providers: `deepseek` (model names auto-mapped), `openrouter` (set any
  model slug from their catalog via `OPENROUTER_MODEL` or per-request),
  `claude` (your normal Claude Code account, no override).
- Attachments: PDF and text/code files are supported (images are not).
- The bridge only listens on localhost; your keys never leave your machine
  except to the provider you chose.
