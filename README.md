# AI Sidebar Assistant

A powerful Chrome browser extension that provides an AI-powered sidebar assistant for analyzing webpage content and answering questions. Now powered by **OpenAI**!

## Features

- **AI-Powered Q&A**: Ask OpenAI questions about the current webpage content with multi-modal support
- **Text-to-Speech (TTS)**: Listen to AI responses with OpenAI TTS (gpt-4o-mini-tts-2025-12-15) and playback controls (pause, resume, rewind, fast-forward)
- **File Attachments**: Drag & drop or paste files (images, PDFs, text files) directly into the sidebar
- **PDF Text Extraction**: Automatically extracts text from PDF files using PDF.js
- **Image Preview**: Lightbox preview for attached images
- **HTML Sanitization**: Secure handling of AI responses to prevent XSS attacks
- **Content Analysis**: Uses Mozilla's Readability.js to extract clean page content
- **Markdown Rendering**: Beautiful rendering of AI responses with syntax highlighting
- **Chat History**: Persistent conversation history stored locally
- **Multi-modal Support**: Send text + images together for analysis

## Installation

1. Clone this repository or download the extension files
2. Create a `config.js` file in the root directory (see Configuration below)
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extension folder
6. The extension should now be installed and ready to use

## Usage

1. Click the extension icon in your Chrome toolbar to open the sidebar
2. Ask questions about the current webpage
3. Use the TTS controls to listen to responses
4. Attach files by dragging them into the sidebar or using paste (Ctrl+V)

## Supported AI APIs

- **OpenAI** (GPT-4o-mini for chat, gpt-4o-mini-tts-2025-12-15 for text-to-speech)
- **TTS Voice**: Alloy (default)
- **Audio Format**: Raw PCM (manually decoded for seeking support)

## Configuration

The extension requires a `config.js` file in the root directory. Copy the following template:

```javascript
const CONFIG = {
    OPENAI_API_KEY: 'sk-...',     // Required: Your OpenAI API key
    OPENAI_MODEL: 'gpt-4o-mini'   // Optional: Defaults to gpt-4o-mini
};
```

To use the extension, you must provide a valid `OPENAI_API_KEY`. You can get one from [OpenAI Platform](https://platform.openai.com/api-keys).

**Note**: The extension uses the OpenAI Chat Completions API and Audio Speech API. Make sure your API key has access to both.

## How It Works

1. **Content Extraction**: When you ask a question, the extension injects a script into the active tab to extract page content using Readability.js (falls back to raw text)
2. **AI Processing**: Your question + page content is sent to OpenAI's GPT-4o-mini API with a system prompt
3. **Response**: AI response is rendered as markdown with syntax highlighting
4. **TTS**: Click the speaker icon to generate and play audio using OpenAI TTS
5. **History**: All conversations are saved locally in your browser

## Technical Details

- **Manifest Version**: 3 (Chrome Extension standard)
- **Permissions**: activeTab, tabs, scripting, storage, sidePanel
- **Content Security Policy**: `script-src 'self'; object-src 'self'`
- **API Endpoints**:
  - Chat: `https://api.openai.com/v1/chat/completions`
  - TTS: `https://api.openai.com/v1/audio/speech`
- **Libraries Used**:
  - Readability.js (Mozilla) - Content extraction
  - marked.min.js - Markdown rendering
  - pdf.min.js / pdf.worker.min.js - PDF processing
- **Audio Handling**: Manual PCM decoding for seekable playback

## Project Structure

```
AI_sidebar/
├── manifest.json          # Extension manifest (MV3) - permissions & config
├── background.js          # Service worker - OpenAI API integration
├── content.js             # Content script - Readability.js extraction
├── sidebar.html           # UI structure
├── sidebar.js             # Main logic, state, TTS, file handling
├── sidebar.css            # Styling (dark theme, Slate palette)
├── Readability.js         # Mozilla content extraction library
├── marked.min.js          # Markdown to HTML renderer
├── pdf.min.js             # PDF.js library
├── pdf.worker.min.js      # PDF.js worker thread
├── config.js              # API keys (gitignored - create this)
└── CLAUDE.md              # Development guide for Claude Code
```

## Troubleshooting

**TTS not working**:
- Ensure `config.js` has valid `OPENAI_API_KEY`
- Click the sidebar once to resume AudioContext (browser autoplay policy)
- Check browser console for errors

**Content not extracted**:
- Page may be restricted (chrome://, file://, chrome-extension://)
- Readability couldn't parse (falls back to raw text)
- Check that the extension has permission to access the tab

**API errors**:
- Verify `config.js` has valid OpenAI API key
- Check OpenAI API quotas and billing
- Ensure API key has access to both chat and TTS endpoints

**PDF text extraction fails**:
- Large PDFs may exceed processing limits
- Check browser console for PDF.js errors

**Chat history lost**:
- Browser clearing localStorage data
- Storage quota exceeded (~5MB limit)
- Try exporting your chats before clearing browser data

## Security

- HTML sanitization for all AI responses (removes scripts and event handlers)
- Strict Content Security Policy (`script-src 'self'`)
- API keys stored locally in `config.js` (never sent to third parties)
- Minimal permissions approach (only what's necessary)
- Content extraction happens locally in the browser
- Secure API key handling (user-provided)

## License

This project is open source. Feel free to use and modify as needed.

## Author

JLDynamics