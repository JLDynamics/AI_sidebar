Modify the sidebar AI so it behaves like ChatGPT Atlas when a webpage is opened.
Implement the following features:

1. Automatically show the current webpage URL in the chat window

When the sidebar loads or when the user switches pages, display:

Current Page: [PAGE_URL]

2. Extract only the main content of the page

Use a main-content extractor (Mozilla Readability or similar) to remove all noise:
	•	header
	•	footer
	•	sidebar
	•	ads
	•	recommended links
	•	navigation

Return only the article body / primary text.

3. Create page metadata for the AI

Generate a structured metadata object:

{
  url: PAGE_URL,
  domain: DOMAIN_NAME,
  pageTitle: DOCUMENT_TITLE,
  mainContent: CLEAN_ARTICLE_CONTENT
}

Pass this metadata to the AI as context.

4. Add a Webpage-Understanding System Prompt

Include this instruction for the AI on every page:

You are assisting the user while they browse. 
You can see the current webpage. Describe what the page is, identify the type of content, summarize the main article, and extract key points. 

When the user asks "what is this?" or anything referring to the webpage, analyze the page and respond in this format:

1. What this page is (e.g., news article, product page, blog, forum, etc.)
2. Website / publisher
3. Main topic or headline
4. Key points from the article (clean bullet list)
5. Optional next steps or follow-up suggestions for the user

Use clean, simple, structured language.

5. Intent detection: When user asks “what is this?”

If the question refers to:
	•	“this page”
	•	“what is this”
	•	“tell me about this website”
	•	“what am I looking at”
	•	“summarize this”
	•	“explain this page”

→ The sidebar AI MUST analyze the webpage using the metadata.

6. Follow ChatGPT Atlas response style

When responding about a page, Atlas-style formatting should look like:

This is a **[type of webpage]** from **[site name]**.
It covers **[main topic]**.

Here’s what you’re looking at:

**Website:**  
**Topic:**  
**Headline:**  
**Key Points:**  
- [...]
- [...]
- [...]

If you want, I can also:
- summarize shorter
- break down gameplay/features
- compare to similar items
- explain more details

7. Still answer general questions normally

General questions (weather, translation, math, code) should NOT use webpage content.


Goal

The sidebar should behave exactly like ChatGPT Atlas:
	•	show the page
	•	understand “what is this?”
	•	classify the webpage
	•	summarize accurately
	•	extract key points
	•	give optional follow-ups
	•	still act as a normal full AI assistant
