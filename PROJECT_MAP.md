# AI Sidebar Assistant — Project Map

## Overview

A Chrome extension (Manifest V3) providing an AI sidebar for asking questions about the
webpage you're viewing. **Every request is routed through a local Python bridge** to
**Claude Code** running headless, which uses cheap third-party models (DeepSeek,
OpenRouter, or your own Claude account) for inference. The bridge runs Claude Code as a
full agent (web search, file/shell tools, multi-turn self-correction), so a cheap model
can look things up and verify answers instead of one-shotting.

New in this build:
- **Cross-page session memory** — pages you visit in a chat are remembered and handed to
  the agent as files it can grep/read on demand (accurate + token-efficient).
- **Fact-check mode** — a dedicated button that turns the agent into a cited fact-checker.
- **Defuddle** replaces Readability for page extraction (injected on demand, no content
  script). Markdown output keeps headings, tables, code, and links.

## Architecture

```
Chrome side panel (sidebar.html + js/app.js)
  │  extracts page content via Defuddle (injected through chrome.scripting)
  │  records the current page in session memory, gathers other session pages
  │  ASK_AI runtime message {providerId, model, effort, question, page,
  │                          history, attachment, mode, sessionId, sessionPages}
  ▼
background.js (service worker — provider router)
  └─ ALL providers are type 'bridge' → http://127.0.0.1:8765
                                          │
                                          ▼
bridge/server.py (FastAPI)
  ├─ writes session pages to workspace/memory/<sessionId>/*.md (agent greps on demand)
  └─ runs `claude -p --output-format stream-json --verbose` (per-provider env)
        → DeepSeek / OpenRouter / Claude  → {answer, meta}
  DELETE /memory/{sessionId}  ← called when a chat is deleted (FORGET_SESSION)
```

State flows one way: components → ChatStore (pub/sub events) → localStorage → re-render.

## File Structure

```
AI_sidebar/
├── manifest.json               MV3 config (sidePanel, scripting, storage). NO content_scripts.
├── background.js               Service worker: routes ASK_AI to the bridge; handles FORGET_SESSION
├── config.js                   Providers, models, keys (GITIGNORED — never commit)
├── defuddle.js                 Vendored page-to-Markdown extractor (NEW; replaces Readability)
├── sidebar.html                Panel markup (incl. #factCheckBtn). Loads config.js then js/app.js
├── sidebar.css                 Dark theme styles
├── package.json                npm scripts: `npm run lint`
├── eslint.config.js            ESLint flat config
├── bridge/
│   ├── server.py               FastAPI bridge → Claude Code headless; session memory; fact-check
│   ├── requirements.txt        fastapi, uvicorn, python-dotenv
│   ├── .env.example            Template for API keys + agent behaviour (copy to .env)
│   ├── README.md               Setup + endpoints
│   └── workspace/memory/       Per-session page files the agent greps (created at runtime)
├── js/
│   ├── app.js                  Entry point: App class, send flow, fact-check, session memory
│   ├── components/
│   │   ├── MessageComponent.js     Message rendering, action rows, markdown, new-tab links
│   │   ├── InputComponent.js       Input, attach menu (+), drag-drop, send visibility
│   │   ├── ModelPickerComponent.js Provider/model/effort popup panel
│   │   └── HistoryComponent.js     Chat history drawer
│   ├── services/
│   │   ├── PageService.js          Active-tab content extraction (Defuddle + raw-text fallback)
│   │   ├── FileService.js          File → attachment (base64 images, PDF text)
│   │   └── StorageService.js       localStorage wrapper; per-session keys + quota eviction
│   ├── store/
│   │   ├── ChatStore.js            State + events; pages (session memory), ratings, truncate
│   │   └── store.js                Singleton re-export
│   └── utils/
│       ├── constants.js            Shared keys and limits (HISTORY_CONTEXT_MESSAGES = 25)
│       ├── validators.js           Config/message/file validation, ErrorTypes
│       ├── helpers.js              generateId, debounce, throttle, deepClone, truncateText, withRetry
│       └── sanitizer.js            HTML sanitization — UNUSED (leftover; safe to delete)
└── vendored: marked.min.js, pdf.min.js, pdf.worker.min.js
```

### Deleted since the previous map
- `Readability.js` — replaced by `defuddle.js`.
- `content.js` — page extraction now runs on demand from `PageService` via the `scripting`
  API, so the manifest no longer declares a `content_scripts` block.
- `js/components/LightboxComponent.js` — image-zoom modal removed.
- `js/services/TTSService.js` — read-aloud removed.

## Providers (config.js)

`CONFIG.PROVIDERS` drives the model picker. **All providers must be `type: 'bridge'`** —
`background.js` throws "must be type 'bridge'" otherwise. There is no longer a direct
OpenAI-compatible route in the extension; if you need a different backend, add it in the
bridge (`bridge/server.py`), not in the extension.

`bridge/server.py` maps each provider to Claude Code env vars:
- `deepseek`  → `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic` (+ `DEEPSEEK_API_KEY`)
- `openrouter`→ `ANTHROPIC_BASE_URL=https://openrouter.ai/api` (+ `OPENROUTER_API_KEY`)
- `claude`    → no overrides (uses your normal Claude Code auth)

Think-effort maps to `claude --effort` / `CLAUDE_CODE_EFFORT_LEVEL` (low|medium|high|xhigh|max).

Bridge API keys live in `bridge/.env` (gitignored). The bridge loads `.env` with
`override=True` so shell-exported stale keys do not win.

## Message flow (normal chat)

1. `InputComponent` → `App._handleSendMessage` → store + render user message
   (`app.js:244`). Pending-action interception was removed in this build.
2. `PageService.getActivePageContent()` injects `defuddle.js` into the active tab and
   returns `{url, title, domain, mainContent}` as clean Markdown (`PageService.js:97`).
3. `store.upsertPage(metadata)` records this page in the chat's session memory;
   `store.getSessionPages(url)` returns the OTHER remembered pages (`app.js:335`).
4. `chrome.runtime.sendMessage({type:'ASK_AI', ..., mode, sessionId, sessionPages})`
   (`app.js:351`).
5. `background.js` → `callBridge` → `POST /chat` with `question, metadata, history,
   attachment, provider, model, effort, mode, session_id, session_pages`
   (`background.js:58`).
6. `bridge/server.py` `chat()` writes session pages to files (`sync_session_memory`),
   builds the prompt (embedding `[SESSION MEMORY]`), runs `claude -p`, returns
   `{answer, provider, model, effort, cost_usd, duration_ms, num_turns}`.
7. AI message rendered with meta footer (provider · model · effort · *N turns* · ~cost ·
   duration) and action row (copy · thumbs · regenerate · time ago). Links in the answer
   open in a new tab; non-http links are stripped (`MessageComponent.js`).

## Fact-check mode

- `#factCheckBtn` in `sidebar.html` → `App._handleFactCheck()` (`app.js:283`).
- Sends the typed claim (or, if empty, "fact-check this page") with `mode:'factcheck'`.
- `bridge/server.py` `build_factcheck_prompt()` turns the agent into a rigorous
  fact-checker that **verifies claims against the web** (not the page alone), gives a
  bold verdict (**Supported / Partly supported / Unsupported / Unclear**), and ends with a
  `## Sources` section of numbered Markdown links. Those links open in a new tab in the
  sidebar.

## Session memory (cross-page)

- **Client (`ChatStore.js`):** each chat carries a `pages` array. `upsertPage(page)`
  dedupes by URL (revisit updates in place), caps at `MAX_MEMORY_PAGES = 12`, and trims
  each page's Markdown to `MAX_STORED_PAGE_CHARS = 8000`. Pages persist with the chat and
  are dropped when the chat is deleted.
- **Bridge (`server.py`):** `sync_session_memory(session_id, pages)` writes each page to
  `workspace/memory/<safe_session_id>/<url>.md` (filename derived from the URL so revisits
  overwrite). Stale `.md` files no longer in the current set are removed. The prompt tells
  the agent to `Glob/Grep/Read` that folder when a question spans pages. Folders untouched
  for `MEMORY_PRUNE_DAYS = 7` are auto-deleted.
- **Forget:** deleting a chat fires `StoreEvents.SESSION_DELETED` → `App` sends
  `FORGET_SESSION` → `background.js:forgetSession()` → `DELETE /memory/{sessionId}`. If the
  bridge is down, age-based pruning still reclaims the files.

## Bridge notes

- Invokes `claude -p --output-format stream-json --verbose` and recovers answer text from
  assistant events when the final `result` is empty (needed for some OpenRouter models).
- Runs Claude Code as a **full agent**: tools (web/file/shell), permission-skipping, and
  the multi-turn loop are ON by default — this is what lets a cheap model self-correct.
  Controlled by env vars (see `bridge/.env.example`):
  `CLAUDE_SKIP_PERMISSIONS` (default 1), `CLAUDE_RESTRICT_TOOLS`, `CLAUDE_ALLOWED_TOOLS`,
  `CLAUDE_MAX_TURNS` (default 20), `CLAUDE_TIMEOUT` (default 600s), `CLAUDE_WORKDIR`,
  `CLAUDE_ADD_DIRS`, `CLAUDE_STRICT_MCP` (default 1).
- **Security:** full mode means any request to `localhost:8765` can run shell commands /
  edit files (in `CLAUDE_WORKDIR`, default `bridge/workspace/`). Keep the port private;
  set `CLAUDE_RESTRICT_TOOLS=WebSearch,WebFetch` to lock it to web-only.
- Returns `num_turns` (shown in the footer when > 1) and `cost_usd` / `duration_ms`.
- Empty answers surface as HTTP 502 with a clear error instead of a blank chat bubble.
- Endpoints: `GET /health` (CLI found? which provider keys set? agent mode),
  `POST /chat`, `DELETE /memory/{session_id}`.

## Development

- Lint: `npm install` once, then `npm run lint`
- Bridge: `cd bridge && uv run --with-requirements requirements.txt uvicorn server:app --port 8765`
  (health check: `/health`)
- Reload extension after changes: chrome://extensions → ⟳
