# AI Sidebar Assistant

A Chrome extension that puts an AI assistant in your browser's side panel for analyzing webpage content and answering questions — with **swappable model providers**: cheap models (e.g. DeepSeek) for everyday browsing, routed through a local **Claude Code bridge** — or any OpenAI-compatible API directly.

## Features

- **Multi-provider model picker**: Switch between DeepSeek, OpenRouter, and Claude models per message, right from the chat box — plus a think-effort setting (low/medium/high)
- **Claude Code bridge**: A small local Python (FastAPI) server that runs Claude Code headless with third-party backends (DeepSeek/OpenRouter), so no claude.ai subscription is consumed
- **AI-Powered Q&A**: Ask questions about the current webpage, with multi-modal support
- **Per-message metadata**: Each answer shows which provider/model responded, estimated cost, and duration
- **Message actions**: Copy, read aloud (TTS), thumbs up/down, regenerate; edit or restart the conversation from any of your messages
- **Text-to-Speech (TTS)**: Listen to AI responses via OpenAI TTS with playback controls
- **File Attachments**: Drag & drop or paste images, PDFs, and text files
- **PDF Text Extraction**: Automatic text extraction via PDF.js
- **Content Analysis**: Mozilla's Readability.js extracts clean page content
- **Markdown Rendering**: Code blocks with copy buttons, tables, links
- **Chat History**: Persistent conversation history stored locally
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

The bridge only needs to run when you use a bridge provider; direct OpenAI-compatible providers work without it.

## Configuration

Create `config.js` in the root directory (it's gitignored — your keys never get committed):

```javascript
const CONFIG = {
    // Only used for Text-to-Speech (optional)
    OPENAI_API_KEY: 'sk-...',
    OPENAI_MODEL: 'gpt-4o-mini',

    // Python bridge server
    BRIDGE_URL: 'http://127.0.0.1:8765',

    // Default selection for the model picker
    DEFAULT_PROVIDER: 'deepseek',
    DEFAULT_MODEL: 'deepseek-v4-flash',
    DEFAULT_EFFORT: 'medium',

    PROVIDERS: {
        // type 'bridge' -> local bridge -> Claude Code -> provider
        'deepseek':   { label: 'deepseek',   type: 'bridge', provider: 'deepseek',   models: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
        'openrouter': { label: 'openrouter', type: 'bridge', provider: 'openrouter', models: ['tencent/hy3:free'] },
        'claude':     { label: 'claude',     type: 'bridge', provider: 'claude',     models: ['default'] },

        // type 'openai' -> direct OpenAI-compatible API (optional)
        // 'my-provider': {
        //     label: 'my provider',
        //     type: 'openai',
        //     baseUrl: 'https://api.example.com/v1',
        //     apiKey: 'YOUR_KEY',
        //     models: ['model-name']
        // }
    }
};
```

Bridge provider keys (DeepSeek/OpenRouter) go in `bridge/.env`, not here.

## How It Works

1. **Content Extraction**: The extension injects Readability.js into the active tab and extracts clean page content (raw-text fallback)
2. **Routing**: Your question + page content + history is sent to the background service worker, which routes it based on the selected provider — either to the local bridge (which runs `claude -p` with per-provider `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` env) or directly to an OpenAI-compatible API
3. **Response**: Rendered as markdown, with a footer showing provider · model · ~cost · duration
4. **TTS**: Click the speaker icon to hear the response (OpenAI TTS)
5. **History**: Conversations persist in localStorage

## Project Structure

```
AI_sidebar/
├── manifest.json              # Extension manifest (MV3)
├── background.js              # Service worker - provider router (bridge / direct APIs)
├── content.js                 # Content script - Readability.js extraction
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
│   │   ├── InputComponent.js       # Input, attach menu, drag-drop
│   │   ├── ModelPickerComponent.js # Provider/model/effort popup
│   │   ├── HistoryComponent.js     # Chat history drawer
│   │   └── LightboxComponent.js    # Image preview modal
│   ├── services/
│   │   ├── PageService.js          # Active-tab content extraction
│   │   ├── FileService.js          # File processing (images, PDFs, text)
│   │   ├── StorageService.js       # localStorage wrapper
│   │   └── TTSService.js           # Text-to-speech
│   ├── store/
│   │   ├── ChatStore.js            # Chat state + events
│   │   └── store.js                # Singleton export
│   └── utils/
│       ├── constants.js            # Shared keys/limits
│       ├── helpers.js              # Utilities
│       ├── sanitizer.js            # HTML sanitization (XSS prevention)
│       └── validators.js           # Input validation
└── vendored: Readability.js, marked.min.js, pdf.min.js, pdf.worker.min.js
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

**Provider answers but claims to be a Claude model**:
- Normal — Claude Code's prompt tells the model a Claude name; check the response footer or your provider dashboard for the truth

**TTS not working**:
- Requires a valid `OPENAI_API_KEY` in `config.js`
- Click the sidebar once to resume AudioContext (autoplay policy)

**Content not extracted**:
- Page may be restricted (chrome://, file://, web store)
- Readability falls back to raw text automatically

**Chat history lost**:
- localStorage cleared or quota exceeded (~5MB limit)

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
