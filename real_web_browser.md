Role

You are a Senior Full-Stack AI Engineer specializing in Chrome Extensions and Python Backend development.

Context

I have an existing Chrome Extension called "Gemini Sidebar Assistant".

Current Stack: Manifest V3, Vanilla JS (sidebar.js, background.js), Readability.js.

Current AI: Google Gemini API (gemini-2.5-flash-preview-09-2025) called directly from background.js.

Current Features: It reads the current page context, summarizes it, and can do simple information lookups using the Tavily Search API.

The Goal

I want to add Real Browser Automation capabilities.
I want to be able to say: "Go to Rogers.com and check the price of the Pixel 9" and have the AI actually navigate there, interact with the page, and return the data.

The Constraints

Chrome Extensions cannot run Playwright/Puppeteer directly due to the sandbox.

Therefore, I need a Local Python Companion Server to handle the heavy lifting.

Tasks

Part 1: The Python Companion Server (server.py)

Create a robust FastAPI server that acts as the "Body" for the AI.

Tech Stack: FastAPI, Uvicorn, Playwright (Async), google-genai SDK.

Endpoint: POST /api/agent that accepts {"query": "..."}.

Agent Logic: Implement the "Browser Agent" logic. It should use Gemini function calling to decide when to use tools like Maps, click, type, and extract.

Tools: Implement Maps(url), click(selector), type(selector, text), extract_content(), Google Search(query).

CORS: Allow origins from chrome-extension://* so my extension can talk to it.

Part 2: Update manifest.json

Add permission to access http://127.0.0.1:8000/*.

Ensure connect-src policy allows localhost.

Part 3: Update background.js & sidebar.js

Intent Detection: Add a new intent check. If the user's query implies navigation or browsing (e.g., "Go to", "Check site", "Login to"), route the request to the local Python server instead of the standard Gemini chat handler.

Communication: Write a function callBrowserAgent(query) in background.js that makes the fetch request to http://127.0.0.1:8000/api/agent.

UI Handling: In sidebar.js, show a specific loading state (e.g., "🤖 Browsing...") while waiting for the Python server, as these tasks take longer than simple chat.

Requirements

The Python code must use the Async Playwright API.

The Agent must be self-correcting (if a selector fails, it should retry or ask Gemini for help).

Provide the complete code for server.py and the exact code snippets to add to manifest.json and background.js.