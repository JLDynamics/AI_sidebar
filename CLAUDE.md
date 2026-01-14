# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Chrome browser extension that provides an AI-powered sidebar assistant for analyzing webpage content. The extension uses ZenMux API for AI (Grok 4.1 Fast) and Google Gemini for text-to-speech.

## Project Architecture

### Core Components

**Background Service Worker** (`background.js`)
- Handles AI API requests to ZenMux
- Manages the side panel behavior
- Processes messages from sidebar with page context
- Implements multi-modal support (text + images)

**Content Script** (`content.js`)
- Injected into all pages via manifest
- Uses Mozilla Readability.js to extract clean page content
- Responds to `GET_PAGE_CONTENT` messages from sidebar

**Sidebar UI** (`sidebar.html` + `sidebar.js` + `sidebar.css`)
- Main user interface loaded as side panel
- Handles chat history (localStorage)
- Manages file attachments (images, PDFs, text files)
- Implements TTS controls with playback seeking
- Renders markdown with syntax highlighting

**TTS Module** (`gemini-tts.js`)
- Google Gemini TTS integration
- Audio buffer caching for performance
- Manual PCM decoding (Gemini returns raw 16-bit PCM @ 24kHz)
- Seek/pause/resume functionality

**PDF Processing** (`pdf.min.js` + `pdf.worker.min.js`)
- PDF.js library for text extraction
- Extracts text from PDF files for AI context

**Markdown Rendering** (`marked.min.js`)
- Converts AI markdown responses to HTML
- Used with custom sanitization

### Data Flow

1. User opens sidebar → `sidebar.html` loads
2. Sidebar loads chat history from localStorage
3. User asks question → `sidebar.js` captures page content via `content.js`
4. Request sent to `background.js` with metadata + history
5. Background calls ZenMux API with system prompt + context
6. Response rendered with markdown + TTS controls

### Configuration

The extension requires a `config.js` file (gitignored) with:

```javascript
const CONFIG = {
    ZENMUX_API_KEY: 'sk-zm-...',  // Required: ZenMux API key
    ZENMUX_MODEL: 'x-ai/grok-4.1-fast',
    GEMINI_TTS_API_KEY: 'your-gemini-key',  // Required for TTS
    TAVILY_API_KEY: 'optional-tavily-key'   // Optional web search
};
```

## Development Commands

This is a vanilla JavaScript Chrome extension with **no build step required**. All files are loaded directly.

### Testing the Extension
```bash
# 1. Ensure config.js exists with API keys
cp config.js.example config.js  # (if template exists)
# Or manually create config.js with required keys

# 2. Load in Chrome
# - Open chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked" and select this folder
# - Click extension icon to open sidebar

# 3. Verify installation
# - Check extension loads without errors
# - Test sidebar opens
# - Verify config.js keys are set
```

### Debugging Commands
```bash
# View background service worker logs
# chrome://extensions/ → Inspect views: service worker

# View content script logs
# Open any webpage → DevTools → Console

# View sidebar logs
# Right-click sidebar → Inspect → Console
```

### Manual Testing Checklist
```bash
# 1. Content extraction test
# - Open any article page
# - Click extension icon
# - Verify page content appears in context

# 2. AI query test
# - Ask a question about the page
# - Verify response with markdown rendering

# 3. File attachment test
# - Drag & drop an image
# - Verify preview appears
# - Send message with attachment

# 4. TTS test
# - Click play button on AI response
# - Verify audio plays
# - Test rewind/forward controls

# 5. Chat history test
# - Create new chat
# - Switch between chats
# - Delete a chat
```

## Key Features & Implementation Details

### Content Extraction
- Uses `Readability.js` to parse main article content
- Falls back to "No primary content detected" if Readability fails
- Truncates to 15,000 characters for API context

### Multi-modal Support
- **Images**: Converted to base64, sent as `image_url` type
- **PDFs**: Text extracted via PDF.js, appended to user message
- **Text files**: Read as text, appended to user message
- **Paste support**: Handles Ctrl+V for files

### TTS Implementation
- **Audio Context**: Must be resumed on user interaction (click)
- **Caching**: Audio buffers cached by text to avoid re-generation
- **Seeking**: Manual offset tracking for rewind/fast-forward
- **Format**: Raw PCM decoding (not standard WAV/MP3)

### Security
- HTML sanitization removes `script` tags and `on*` event handlers
- Strict CSP in manifest (`script-src 'self'`)
- API keys user-provided via config.js

### Chat History
- Stored in localStorage under `gemini_chats`
- Each chat has: id, title, messages[], lastUpdated
- Messages stored as `{role: 'User'|'AI', content: string}`
- Image attachments noted but not stored (base64 quota issues)

### Pending Action System
- AI can offer to search web for missing info
- Regex detects phrases like "Would you like me to search..."
- User can respond "yes"/"no" to trigger/cancel search
- Vague queries fall back to last user message

### Modifying the AI Prompt
Edit the system prompt in `background.js:37-50`. This controls:
- How AI uses page content vs web search
- Response formatting
- Citation requirements

### Adding New File Types
1. Update `sidebar.html:96` accept attribute
2. Add handler in `sidebar.js:168-208` `handleFileSelection`
3. Ensure background.js can process the content type

### Updating Dependencies
- `pdf.min.js` / `pdf.worker.min.js`: Download from PDF.js releases
- `marked.min.js`: Download from marked.js releases
- `Readability.js`: Download from Mozilla Readability repo

### CSS Changes
- Uses CSS variables in `:root` for theming
- Dark mode only (premium dark palette)
- Responsive design for side panel width

## Important Notes

### Manifest V3 Requirements
- Service worker must be non-persistent
- All external API calls in background.js
- Side panel API for Chrome 114+

### API Quotas
- Gemini TTS: ~1M characters free tier
- ZenMux: Check your plan limits
- LocalStorage: ~5MB limit (chat history)

### Debugging
- Background script: `chrome://extensions/` → Inspect views: service worker
- Content script: DevTools on any page → Sources tab
- Sidebar: Right-click sidebar → Inspect

### File Structure
```
AI_sidebar/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker - API calls
├── content.js             # Content script - page extraction
├── sidebar.html           # UI structure
├── sidebar.js             # UI logic & state management
├── sidebar.css            # Styling (dark theme)
├── gemini-tts.js          # TTS with PCM decoding
├── Readability.js         # Mozilla content extraction
├── marked.min.js          # Markdown renderer
├── pdf.min.js             # PDF processing
├── pdf.worker.min.js      # PDF worker thread
└── config.js              # API keys (gitignored - create this)
```

### Git Status
- `config.js` is gitignored - users must create it
- Third-party libraries included in repo
- No build step required (vanilla JS)

## Troubleshooting

**TTS not working**: Ensure `config.js` has `GEMINI_TTS_API_KEY` and user clicked to resume AudioContext

**Content not extracted**: Page may be restricted (chrome://, file://) or Readability couldn't parse

**API errors**: Check `config.js` has valid `ZENMUX_API_KEY` and host permissions in manifest

**PDF text extraction fails**: PDF.js worker path must be correct (`pdf.worker.min.js`)

**Chat history lost**: Check localStorage quota or browser clearing data