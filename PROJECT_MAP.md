# AI Sidebar Assistant — Project Map

## Overview

A Chrome extension (Manifest V3) providing an AI sidebar for asking questions about the webpage you're viewing. Supports multiple swappable model providers — DeepSeek, OpenRouter, and Claude (via a local Python bridge to Claude Code), plus any direct OpenAI-compatible API (e.g. OpenCode Go). Features chat history, file/image attachments, TTS, markdown rendering, and a model/think-effort picker.

## Architecture

```
Chrome side panel (sidebar.html + js/app.js)
  │  extracts page content (PageService + Readability)
  │  ASK_AI runtime message {providerId, model, effort, question, page, history}
  ▼
background.js (service worker — provider router)
  ├─ type 'bridge' → http://127.0.0.1:8765 → bridge/server.py → claude -p → DeepSeek / OpenRouter / Claude
  └─ type 'openai' → direct OpenAI-compatible API (OpenCode Go, ...)
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
│   │   ├── MessageComponent.js     Message rendering, action rows, markdown, TTS buttons
│   │   ├── InputComponent.js       Input, attach menu (+), drag-drop, send visibility
│   │   ├── ModelPickerComponent.js Provider/model/effort popup panel
│   │   ├── HistoryComponent.js     Chat history drawer
│   │   └── LightboxComponent.js    Image zoom modal
│   ├── services/
│   │   ├── PageService.js          Active-tab content extraction (Readability + fallback)
│   │   ├── FileService.js          File → attachment (base64 images, PDF text)
│   │   ├── StorageService.js       localStorage wrapper, quota handling
│   │   └── TTSService.js           OpenAI TTS playback + cache
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

- `type: 'bridge'` — request goes to the local Python bridge (port 8765), which runs Claude Code headless with per-provider env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`). Providers: `deepseek`, `openrouter`, `claude`. Think-effort maps to `CLAUDE_CODE_EFFORT_LEVEL`.
- `type: 'openai'` — direct `{baseUrl}/chat/completions` call with `apiKey`. Providers: `opencode-go` (and any other OpenAI-compatible endpoint you add).

Bridge API keys live in `bridge/.env` (gitignored). Direct-provider keys live in `config.js` (gitignored).

## Message flow

1. `InputComponent` → `App._handleSendMessage` → store + render user message
2. `PageService.getActivePageContent()` injects Readability into the active tab
3. `chrome.runtime.sendMessage({type: 'ASK_AI', ...selection, metadata, history})`
4. `background.js` routes by provider type, returns `{answer, meta}`
5. AI message rendered with meta footer (provider · model · ~cost · duration) and action row (copy · TTS · thumbs · regenerate · time ago)

## Development

- Lint: `npm install` once, then `npm run lint`
- Bridge: `cd bridge && uvicorn server:app --port 8765` (health check: `/health`)
- Reload extension after changes: chrome://extensions → ⟳
