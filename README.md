# AI Sidebar Assistant

A Chrome extension that puts an AI assistant in your browser's side panel for analyzing webpage content and answering questions — with **swappable model providers**: cheap models (e.g. DeepSeek) for everyday browsing, all routed through a local **Claude Code bridge** that runs the model as a full agent (web search, file/grep, multi-turn).

## Features

- **Multi-provider model picker**: Switch between DeepSeek, OpenRouter (e.g. `tencent/hy3:free`), and Claude models per message — plus a think-effort setting (low/medium/high)
- **Claude Code bridge**: Local Python (FastAPI) server runs Claude Code headless against cheap models (DeepSeek / OpenRouter) instead of official Anthropic models
- **AI-Powered Q&A**: Ask questions about the current webpage, with multi-modal support
- **Fact-checking with sources**: One click verifies the page's claims (or a claim you type) against the web via the agent, with cited, clickable sources (needs a bridge provider)
- **Cross-page session memory**: Pages you ask about — and any files you attach — are saved as files on the bridge that the agent greps/reads on demand, so you can compare and follow up across pages (and re-reference old attachments) accurately without re-sending them in every prompt. Memory is scoped to the session, has no page/file count cap, is deleted when the session is deleted, and a 90-day age prune sweeps orphaned folders
- **Per-message metadata**: Footer shows provider · model · effort · ~cost · duration
- **Message actions**: Copy, thumbs up/down, regenerate; edit or restart the conversation from any of your messages
- **File Attachments**: Drag & drop or paste PDFs and text/code files
- **PDF Text Extraction**: Automatic text extraction via PDF.js
- **Content Analysis**: Defuddle extracts clean page content as Markdown (cleaned raw-text fallback)
- **Markdown Rendering**: Code blocks with copy buttons, tables, links
- **Chat History**: Full conversation persisted locally, one lightweight key per session; the whole conversation is sent as context (no fixed message cap)
- **Keyboard Shortcuts**: Ctrl/Cmd+Enter (send), Ctrl/Cmd+K (focus), Ctrl/Cmd+N (new chat), Ctrl/Cmd+H (history), Ctrl/Cmd+L (clear), Esc (close overlays)

## Installation

### 1. Extension

1. Clone this repository
2. Create a `config.js` file in the root directory (see Configuration below)
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extension folder

### 2. Bridge server (for DeepSeek / OpenRouter / Claude providers)

Requires Python 3.10+ and the [Claude Code CLI](https://code.claude.com) on your PATH.

```bash
cd bridge
pip install -r requirements.txt
copy .env.example .env        # then put your DeepSeek/OpenRouter keys in .env
uvicorn server:app --port 8765
```

Health check: http://127.0.0.1:8765/health — you want `"claude_cli_found": true`.

The bridge must be running to use the extension — all providers route through it.

## Configuration

Create `config.js` in the root directory (it's gitignored — your keys never get committed):

```javascript
const CONFIG = {
    // Python bridge server
    BRIDGE_URL: 'http://127.0.0.1:8765',

    // Default selection for the model picker
    DEFAULT_PROVIDER: 'deepseek',
    DEFAULT_MODEL: 'deepseek-v4-flash',
    DEFAULT_EFFORT: 'medium',

    // All providers route through the local Claude Code bridge.
    PROVIDERS: {
        'deepseek':   { label: 'deepseek',   type: 'bridge', provider: 'deepseek',   models: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
        'openrouter': { label: 'openrouter', type: 'bridge', provider: 'openrouter', models: ['tencent/hy3:free'] },
        'claude':     { label: 'claude',     type: 'bridge', provider: 'claude',     models: ['default'] }
    }
};
```

Bridge provider keys (DeepSeek/OpenRouter) go in `bridge/.env`, not here.

## Agent abilities & security

By default the bridge runs Claude Code as a **full agent** — every tool (web search, file access, shell), permission prompts skipped, and a multi-turn loop. This is what lets a cheap model self-correct and look things up instead of answering in one shot.

The tradeoff: because the bridge is an HTTP endpoint on `localhost:8765`, any request that reaches it can make Claude Code run shell commands and edit files (inside `CLAUDE_WORKDIR`, default `bridge/workspace/`). The server binds to localhost only — keep the port private and don't expose it.

Tune it in `bridge/.env` (all optional; defaults are full mode):

| Env var | Default | Purpose |
| --- | --- | --- |
| `CLAUDE_SKIP_PERMISSIONS` | `1` | `1` = autonomous tools; `0` = only auto-run `CLAUDE_ALLOWED_TOOLS` |
| `CLAUDE_RESTRICT_TOOLS` | *(all)* | Limit which tools exist, e.g. `WebSearch,WebFetch` for web-only |
| `CLAUDE_ALLOWED_TOOLS` | *(none)* | Auto-approve just these (when skip is off) |
| `CLAUDE_MAX_TURNS` | `20` | Cap agent turns so nothing runs away |
| `CLAUDE_TIMEOUT` | `600` | Wall-clock limit per run (seconds) |
| `CLAUDE_WORKDIR` | `bridge/workspace/` | Where file/shell tools operate |
| `CLAUDE_ADD_DIRS` | *(none)* | Extra dirs the agent may read/edit |
| `CLAUDE_STRICT_MCP` | `1` | Ignore global MCP servers (avoids hangs) |

To lock it down to a safe read-only-web assistant: `CLAUDE_RESTRICT_TOOLS=WebSearch,WebFetch`. Check the active mode any time at http://127.0.0.1:8765/health.

## How It Works

1. **Content Extraction**: The extension injects Defuddle into the active tab, which removes boilerplate and returns clean Markdown directly (cleaned raw-text last resort if Defuddle can't parse the page)
2. **Routing**: Your question + current page + full conversation history is sent to the background service worker, which forwards it to the local Claude Code bridge (the current question is sent once, as `[USER QUESTION]`)
3. **Bridge**: runs `claude -p` with per-provider env (`ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`) so Claude Code uses DeepSeek, OpenRouter (Hy3), etc. for inference — as a **full agent** with tools (web search, file access, shell) and a multi-turn loop, so a cheap model can look things up and self-correct instead of one-shotting
4. **Session memory**: the bridge accumulates the pages you visit and the files you attach into a per-session folder on disk; older pages/attachments aren't re-sent every turn — the agent Greps/Reads them only when a question needs them
5. **Response**: Rendered as markdown, with a footer showing provider · model · effort · turns · ~cost · duration

### Where data lives

- **Browser localStorage** holds only your **messages**, split into one small key per session (plus a lightweight index). Page/attachment content is *not* stored here, so the ~5MB quota is a non-issue.
- **The bridge (your machine's disk)** holds **page and attachment memory** as Markdown files under `bridge/workspace/memory/<session>/`. Deleting a chat deletes its folder immediately; a 90-day prune cleans up any orphans.
- The session ID links the two — delete a chat and both its messages and its on-disk memory go.

## Project Structure

```
AI_sidebar/
├── manifest.json              # Extension manifest (MV3)
├── background.js              # Service worker - routes requests to the Claude Code bridge
├── defuddle.js                 # Vendored Defuddle bundle (extraction → Markdown)
├── sidebar.html               # UI structure
├── sidebar.css                # Styling (dark theme)
├── config.js                  # Providers & keys (gitignored - create this)
├── package.json               # npm run lint
├── eslint.config.js           # ESLint flat config
├── bridge/                    # Python bridge -> Claude Code
│   ├── server.py              # FastAPI server (POST /chat, GET /health)
│   ├── requirements.txt
│   ├── .env.example           # Key template (copy to .env)
│   └── README.md
├── js/
│   ├── app.js                 # Application entry point
│   ├── components/
│   │   ├── MessageComponent.js     # Message rendering + action rows
│   │   ├── InputComponent.js       # Input, file attach, drag-drop
│   │   ├── ModelPickerComponent.js # Provider/model/effort popup
│   │   └── HistoryComponent.js     # Chat history drawer
│   ├── services/
│   │   ├── PageService.js          # Active-tab content extraction
│   │   ├── FileService.js          # File processing (PDFs, text)
│   │   └── StorageService.js       # localStorage wrapper (messages only, per-session keys)
│   ├── store/
│   │   ├── ChatStore.js            # Chat state + events
│   │   └── store.js                # Singleton export
│   └── utils/
│       ├── constants.js            # Shared keys/limits
│       ├── helpers.js              # Utilities
│       ├── sanitizer.js            # HTML sanitization (XSS prevention)
│       └── validators.js           # Input validation
└── vendored: defuddle.js (extractor → Markdown), marked.min.js, pdf.min.js, pdf.worker.min.js
```

## Development

```bash
npm install     # once
npm run lint    # ESLint, should report 0 problems
```

After code changes: `chrome://extensions` → reload ⟳ the extension.

## Troubleshooting

**"Bridge server not reachable"**:
- Start it: `cd bridge && uvicorn server:app --port 8765`
- Check http://127.0.0.1:8765/health

**"Missing DEEPSEEK_API_KEY / OPENROUTER_API_KEY"**:
- Add the key to `bridge/.env` and restart the bridge
- Prefer keys only in `bridge/.env`. A stale `export DEEPSEEK_API_KEY=...` in `~/.zshrc` used to override the good key; the bridge now loads `.env` with `override=True`

**Empty answer / blank bubble**:
- Some OpenRouter models stream text but leave Claude Code's final `result` empty — the bridge recovers text from `stream-json` assistant events
- If it still fails, try another model (e.g. `deepseek-v4-flash`) and check bridge terminal logs

**Provider answers but claims to be a Claude model**:
- Normal — Claude Code's prompt tells the model a Claude name; check the response footer or your provider dashboard for the truth

**Content not extracted**:
- Page may be restricted (chrome://, file://, web store)
- Defuddle falls back to cleaned raw text automatically

**Chat history lost**:
- localStorage was cleared. Messages are tiny (pages/attachments live on the bridge, not in localStorage), so the ~5MB quota is effectively never the cause anymore

**AI doesn't recall an earlier page or attachment**:
- Session memory lives on the bridge under `bridge/workspace/memory/`. If the bridge wasn't running when you deleted a chat, its folder is swept by the 90-day prune. Deleting a chat while the bridge is up removes it immediately

## Security

- HTML sanitization for all AI responses (removes scripts and event handlers)
- Strict Content Security Policy (`script-src 'self'`)
- API keys stored locally (`config.js`, `bridge/.env` — both gitignored)
- The bridge listens on localhost only
- Content extraction happens locally in the browser

## License

This project is open source. Feel free to use and modify as needed.

## Author

JLDynamics
