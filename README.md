# AI Sidebar Assistant

A powerful Chrome browser extension that provides an AI-powered sidebar assistant for analyzing webpage content and answering questions. Now powered by **OpenAI**!

## Features

- **AI-Powered Q&A**: Ask OpenAI questions about the current webpage content with multi-modal support
- **Text-to-Speech (TTS)**: Listen to AI responses with playback controls (pause, resume, rewind, fast-forward)
- **File Attachments**: Drag & drop or paste files (images, PDFs, text files) directly into the sidebar
- **PDF Text Extraction**: Automatically extracts text from PDF files
- **Image Preview**: Lightbox preview for attached images
- **HTML Sanitization**: Secure handling of AI responses to prevent XSS attacks
- **Content Analysis**: Uses Mozilla's Readability.js to extract clean page content
- **Markdown Rendering**: Beautiful rendering of AI responses with syntax highlighting

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

- **OpenAI** (GPT-4o-mini for chat, TTS-1 for text-to-speech)

## Configuration

The extension requires a `config.js` file in the root directory. Copy the following template:

```javascript
const CONFIG = {
    OPENAI_API_KEY: 'sk-...',     // Required: Your OpenAI API key
    OPENAI_MODEL: 'gpt-4o-mini'   // Optional: Defaults to gpt-4o-mini
};
```

To use the extension, you must provide a valid `OPENAI_API_KEY`.

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
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker - OpenAI API calls
├── content.js             # Content script - page extraction
├── sidebar.html           # Sidebar interface
├── sidebar.js             # Sidebar functionality + TTS (OpenAI)
├── sidebar.css            # Styling (dark theme)
├── Readability.js         # Mozilla content extraction
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