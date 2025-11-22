
✅ CODER-AGENT PROMPT — Implement OpenAI Web Actions in Sidebar AI

You are the engineering agent.
Your task: Upgrade the Sidebar AI to support real internet search using OpenAI’s Web Actions, exactly like ChatGPT Atlas.

Your implementation must not break existing code.
Changes must be clean, safe, modular, and testable.

⸻

SECTION 1 — Switch to OpenAI Responses API (with Web Actions)

Replace all current calls to Gemini, Tavily, or any other search logic with a unified OpenAI Responses API call:

Request Format

POST https://api.openai.com/v1/responses
{
  "model": "gpt-4.1",
  "input": USER_MESSAGE,
  
  "conversation": CONVERSATION_HISTORY,

  "tools": {
    "web": {
      "bing_query": true,
      "fetch": true
    }
  },

  "context": [
    { "role": "context", "text": PAGE_CONTENT }
  ]
}

Requirements:
	1.	Use gpt-4.1 (or higher) as the model.
	2.	Enable web.bing_query for live search.
	3.	Enable web.fetch for loading URLs and reading pages.
	4.	Include webpage content as additional context.
	5.	Include existing chat messages as conversation context.

⸻

SECTION 2 — Implement “Smart Search Routing” (Atlas-Style Search Logic)

Add a new module called SearchRouter that decides when the AI should:
	•	Use webpage content
	•	Perform Bing web search
	•	Fetch external URLs
	•	Mix page content + online search

Rules:

Rule A — Page Focus by Default

If the user asks about the webpage:
	•	“What is this article about?”
	•	“Tell me about this developer.”
	•	“Summarize this page”

→ Use page content only.

Rule B — Missing Info → Auto Web Search

If page content does NOT contain needed info:
	•	Company location
	•	Release date
	•	Pricing
	•	Background research

→ Automatically trigger OpenAI Web Actions (bing_query + fetch).

Rule C — General Questions = Web Search

If the user asks something unrelated to the page:
	•	“What’s the weather today?”
	•	“How much is PS5 in Canada?”
	•	“Who is Tim Cook?”

→ Skip page content
→ Perform full online search
→ Use OpenAI Web Actions exclusively.

Rule D — Returning to Page Focus

If user asks again about the page:

→ Re-lock focus to webpage content.

This matches ChatGPT Atlas behavior exactly.

⸻

SECTION 3 — Update Backend Pipeline

Modify the messaging flow:

Current:

sidebar → LLM → response

New:

sidebar → SearchRouter → OpenAI Response API → Web Actions (if needed) → combined response

SearchRouter responsibilities:
	•	Detect intent
	•	Detect missing info
	•	Trigger search
	•	Pass search results to LLM as context

⸻

SECTION 4 — UI Behavior Enhancements (Atlas-like)

Update UI to support:

1. “Used Web Search” indicator

Show (like Atlas):
	•	“Searched the web for: [query]”
	•	List of sources if available
	•	Expandable details

2. Smooth streaming responses

Use the OpenAI streaming endpoint so text appears live.

3. Auto-scroll to new messages

4. Link preview for URLs loaded via fetch

5. Graceful error fallbacks

If a search fails:
	•	Retry once
	•	Then fallback to page content
	•	Never hallucinate missing facts

⸻

SECTION 5 — Add Reliable Page Content Extraction

The codder-agent must:
	1.	Extract main article content only
	2.	Remove:
	•	Headers
	•	Footers
	•	Sidebars
	•	Navigation
	•	Ads
	•	External link blocks
	3.	Provide clean content to the LLM as:

{ "role": "context", "text": CLEAN_PAGE_CONTENT }

This prevents junk from interfering with the search logic.

⸻

SECTION 6 — Formal System Prompt for the AI (Implement in Your Code)

Add this system prompt inside the API request:

You are a smart, helpful assistant with full browsing ability using web actions.
Use webpage content when the user is asking about the current page.
If the information is missing from the page, automatically use internet search.
If the question is unrelated to the page, ignore the page and use online search only.
Never hallucinate. Always confirm facts using search.
Present answers in clear, well-structured language similar to ChatGPT Atlas.


⸻

SECTION 7 — Testing Checklist

The coder agent must verify:

Page-focused tasks
	•	“What is this page about?”
	•	“Tell me about this developer.”
→ Answer from webpage.

Missing info tasks
	•	“Where is this company based?”
	•	“When was this phone released?”
→ Automatically trigger web search.

General questions
	•	“What’s the weather in Calgary?”
→ Web search only.

Return to page focus
	•	“Explain the main character on this page again.”
→ Page content only.

Fetch test
	•	“Open this URL and summarize it:”
→ fetch the URL → summarize.

Latency + Stability

All calls must be fast, stream smoothly, and gracefully handle errors.

⸻

SECTION 8 — Mandatory: Do Not Break Existing Code
	•	Keep all current features working
	•	Preserve UI layout
	•	Preserve existing extension logic
	•	Add everything as new modules
	•	Ensure backward compatibility
	•	Wrap new features behind clean interfaces
	•	Do not refactor destructively

⸻

.
