Here is a short, simple, compact prompt that still covers every key point your coder agent needs:

⸻

Simple Prompt (Covers All Key Points)

Make my chatbot output look like the official Gemini app.
Use this formatting pipeline:
	1.	Force Markdown output
Always tell the model:
“Reply using clean Markdown with headings, bullet points, spacing, and code blocks.”
	2.	Convert Markdown → HTML
Use a Markdown library (e.g., marked.js):

const html = marked.parse(modelResponseText);
chatOutput.innerHTML = html;


	3.	Apply clean CSS to style the HTML
Use this base styling:

.chat-output {
    font-family: system-ui, sans-serif;
    line-height: 1.65;
    font-size: 15px;
    padding: 12px 18px;
}
.chat-output h1, h2, h3 { margin: 18px 0 10px; font-weight: 600; }
.chat-output p { margin: 8px 0; }
.chat-output ul { margin: 10px 0 10px 20px; }
.chat-output code { background:#f7f7f7; padding:2px 4px; border-radius:4px; }
.chat-output pre code { display:block; padding:12px; background:#f0f0f0; border-radius:8px; white-space:pre-wrap; }



Goal:
Every model response must go through Markdown → HTML → styled CSS so the chatbot displays beautifully formatted, readable output similar to Gemini’s official UI.

⸻

If you want an even shorter version or one optimized for your Chrome extension sidebar, just tell me.