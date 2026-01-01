# AI Sidebar Assistant

A powerful Chrome browser extension that provides an AI-powered sidebar assistant for analyzing webpage content and answering questions. Now powered by **Grok 4.1 Fast** via **OpenRouter**!

## Features

- **AI-Powered Q&A**: Ask Grok 4.1 Fast questions about the current webpage content
- **Text-to-Speech (TTS)**: Listen to AI responses with playback controls (pause, resume, rewind, fast-forward)
- **File Attachments**: Drag & drop or paste files (images, PDFs) directly into the sidebar
- **PDF Text Extraction**: Automatically extracts text from PDF files
- **Image Preview**: Lightbox preview for attached images
- **HTML Sanitization**: Secure handling of AI responses to prevent XSS attacks
- **Content Analysis**: Uses Mozilla's Readability.js to extract clean page content

## Installation

1. Clone this repository or download the extension files
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension should now be installed and ready to use

## Usage

1. Click the extension icon in your Chrome toolbar to open the sidebar
2. Ask questions about the current webpage
3. Use the TTS controls to listen to responses
4. Attach files by dragging them into the sidebar or using paste (Ctrl+V)

## Supported AI APIs

- **OpenRouter** (Grok 4.1 Fast, and other models)
- **Google Gemini** (via Google AI Studio for TTS)

## Configuration

The `config.js` file is already configured with OpenRouter:

```javascript
const CONFIG = {
    GEMINI_TTS_API_KEY: 'your-gemini-tts-key',
    TAVILY_API_KEY: 'your-tavily-key', // Optional
    OPENROUTER_API_KEY: 'sk-or-v1-...',
    OPENROUTER_MODEL: 'x-ai/grok-4.1-fast'
};
```

To use your own OpenRouter API key, replace the `OPENROUTER_API_KEY` value.

## Technical Details

- **Manifest Version**: 3
- **Permissions**: activeTab, scripting, storage, sidePanel
- **Content Security Policy**: Strict CSP for security
- **Libraries Used**:
  - Readability.js (Mozilla) - Content extraction
  - marked.min.js - Markdown rendering
  - pdf.min.js / pdf.worker.min.js - PDF processing

## Project Structure

```
AI_sidebar/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── content.js             # Content script for page interaction
├── sidebar.html           # Sidebar interface
├── sidebar.js             # Sidebar functionality
├── sidebar.css            # Styling
├── gemini-tts.js          # TTS functionality
├── Readability.js         # Content extraction
├── marked.min.js          # Markdown renderer
├── pdf.min.js             # PDF processing
├── pdf.worker.min.js      # PDF worker
└── config.js              # API configuration (create this)
```

## Security

- HTML sanitization for all AI responses
- Strict Content Security Policy
- Minimal permissions approach
- Secure API key handling (user-provided)

## License

This project is open source. Feel free to use and modify as needed.

## Author

JLDynamics