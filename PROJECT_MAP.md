# AI Sidebar Assistant — Project Map

## Overview

A Chrome extension (Manifest V3) providing an AI sidebar for asking questions about the webpage you're viewing. Supports multiple swappable model providers — DeepSeek, OpenRouter (e.g. Hy3), and Claude — via a local Python bridge to **Claude Code** (cheap models for inference), plus any direct OpenAI-compatible API. Features chat history, file/image attachments, markdown rendering, and a model/think-effort picker.

## Architecture

```
Chrome side panel (sidebar.html + js/app.js)
  │  extracts page content (PageService + Readability)
  │  ASK_AI runtime message {providerId, model, effort, question, page, history}
  ▼
background.js (service worker — provider router)
  ├─ type 'bridge' → http://127.0.0.1:8765 → bridge/server.py → claude -p → DeepSeek / OpenRouter / Claude
  └─ type 'openai' → direct OpenAI-compatible API (optional)
```

State flows one way: components → ChatStore (pub/sub events) → localStorage → re-render.

## File Structure

```
AI_sidebar/
├── manifest.json               MV3 config (sidePanel, scripting, storage)
├── background.js               Service worker: routes ASK_AI to bridge or direct API
├── content.js                  Content script: page extraction on GET_PAGE_CONTENT
├── config.js                   Providers, models, keys (GITIGNORED — never commit)
├── sidebar.html                Panel markup
├── sidebar.css                 Dark theme styles
├── package.json                npm scripts: `npm run lint`
├── eslint.config.js            ESLint flat config
├── bridge/
│   ├── server.py               FastAPI bridge → Claude Code headless (per-provider env)
│   ├── requirements.txt        fastapi, uvicorn, python-dotenv
│   ├── .env.example            Template for API keys (copy to .env)
│   └── README.md               Setup + endpoints
├── js/
│   ├── app.js                  Entry point: App class, send flow, user/AI actions
│   ├── components/
│   │   ├── MessageComponent.js     Message rendering, action rows, markdown
│   │   ├── InputComponent.js       Input, attach menu (+), drag-drop, send visibility
│   │   ├── ModelPickerComponent.js Provider/model/effort popup panel
│   │   ├── HistoryComponent.js     Chat history drawer
│   │   └── LightboxComponent.js    Image zoom modal
│   ├── services/
│   │   ├── PageService.js          Active-tab content extraction (Readability + fallback)
│   │   ├── FileService.js          File → attachment (base64 images, PDF text)
│   │   ├── StorageService.js       localStorage wrapper, quota handling
│   │   └── TTSService.js           Unused leftover (read-aloud removed from UI)
│   ├── store/
│   │   ├── ChatStore.js            State + events; truncate/rating for edit/restart/thumbs
│   │   └── store.js                Singleton re-export
│   └── utils/
│       ├── constants.js            Shared keys and limits
│       ├── validators.js           Config/file/message validation
│       ├── helpers.js              debounce, retry, formatting, deepClone
│       └── sanitizer.js            HTML sanitization (XSS)
└── vendored: Readability.js, marked.min.js, pdf.min.js, pdf.worker.min.js
```

## Providers (config.js)

`CONFIG.PROVIDERS` drives the model picker. Two types:

- `type: 'bridge'` — request goes to the local Python bridge (port 8765), which runs Claude Code headless with per-provider env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`) so **cheap models do inference**. Providers: `deepseek`, `openrouter` (e.g. `tencent/hy3:free`), `claude`. Think-effort maps to `claude --effort` / `CLAUDE_CODE_EFFORT_LEVEL`.
- `type: 'openai'` — direct `{baseUrl}/chat/completions` call with `apiKey`. None configured by default — add any OpenAI-compatible endpoint.

Bridge API keys live in `bridge/.env` (gitignored). Direct-provider keys live in `config.js` (gitignored). The bridge loads `.env` with `override=True` so shell-exported stale keys do not win.

## Message flow

1. `InputComponent` → `App._handleSendMessage` → store + render user message
2. `PageService.getActivePageContent()` injects Readability into the active tab
3. `chrome.runtime.sendMessage({type: 'ASK_AI', ...selection, metadata, history})`
4. `background.js` routes by provider type, returns `{answer, meta}`
5. AI message rendered with meta footer (provider · model · effort · ~cost · duration) and action row (copy · thumbs · regenerate · time ago)

## Bridge notes

- Uses `claude -p --output-format stream-json --verbose` and recovers answer text from assistant events when final `result` is empty (needed for some OpenRouter models like Hy3).
- `--strict-mcp-config --tools ""` avoids hanging on global MCP servers / tools for pure page Q&A.
- Empty answers surface as HTTP 502 with a clear error instead of a blank chat bubble.

## Development

- Lint: `npm install` once, then `npm run lint`
- Bridge: `cd bridge && uv run --with-requirements requirements.txt uvicorn server:app --port 8765` (health check: `/health`)
- Reload extension after changes: chrome://extensions → ⟳
