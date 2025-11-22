
⸻

Prompt for Coder Agent: Revamp Sidebar AI to Match ChatGPT Atlas Behavior

Revamp the entire sidebar AI mechanism to match the behavior and stability of ChatGPT Atlas.
Replace the current logic with the following session-anchored, page-aware interaction system.

⸻

1. Implement “Page Context Locking”

When the user opens a webpage:
	1.	Extract:
	•	URL
	•	domain
	•	document.title
	•	main readable content (using Readability or similar)
	2.	Store this as the current page context object:

pageContext = {
  url: ...,
  domain: ...,
  title: ...,
  mainContent: ...
}

	3.	This pageContext MUST stay active and always included in the system prompt until the user navigates to a different page.
	4.	Never clear or replace this context based on user questions.
Only replace it when a new webpage loads.

⸻

2. System Prompt Structure (Always Present)

Always send this system prompt to the model:

You are assisting the user while they view the following webpage.
This webpage stays active for the entire session unless replaced by navigation.

[PAGE_URL]
[PAGE_TITLE]
[DOMAIN]
[MAIN_CONTENT]

Rules:
- Do NOT discard this page context at any time.
- Use this content ONLY when the user’s question refers to the page.
- For unrelated questions, answer normally but keep the page context available.
- When the user asks “what is this”, “continue”, “tell me more”, “explain this”, or anything referencing the page, analyze the webpage again.


⸻

3. Intent Detection System

For each user question, classify it into ONE of three categories:

A. Page-Related

Keywords:
	•	“this page”
	•	“this article”
	•	“what is this”
	•	“tell me about this”
	•	“summarize this”
	•	“explain this part”
	•	“give more details”
	•	“what am I looking at”
	•	“continue”
	•	“more info from the page”

→ Use pageContext heavily in the answer.

B. Mixed Context

User asks something related to the page but needing outside info.

Examples:
	•	“Who is the author?”
	•	“What else did this company make?”
	•	“Is this game popular?”
	•	“Give me history of this topic.”

→ Use pageContext + external search (if your extension supports search).

C. General Question

Questions unrelated to the webpage:
	•	“What’s the weather?”
	•	“Translate this”
	•	“Explain Python”
	•	“Who is Elon Musk”
	•	“How to fix my iPhone”
	•	“What’s 9 × 12?”

→ Ignore pageContext for the answer, but do NOT remove it from memory.
It must remain for the next turn.

⸻

4. Core Rule: NEVER LOSE PAGE CONTEXT

Your current mechanism incorrectly switches modes and stops using page context after a general question.

Fix this by keeping the page context permanently in the system prompt during the entire session.

Atlas does this, and your sidebar must too.

⸻

5. Mechanism Flow Step-by-Step (Coder Must Follow)

Step 1 — On Page Load
	•	Extract and store pageContext
	•	Inject pageContext into system message
	•	Show “Current Page: [URL]” in the chat window

Step 2 — On Every User Message

Perform intent detection:
	1.	If page-related →
	•	Use pageContext
	•	Summarize / analyze / explain as requested
	2.	If mixed →
	•	Use pageContext + online search (if applicable)
	3.	If general →
	•	Answer normally
	•	Ignore pageContext in reasoning
	•	DO NOT delete or forget pageContext

Step 3 — Build the Prompt (Always)

Construct the full model input:

SYSTEM:
[Session instructions]
[PageContext]

USER:
[User question]

Step 4 — Produce Response
	•	Follow ChatGPT Atlas structure
	•	Clear formatting
	•	Short paragraphs
	•	Bullet points for key items
	•	Offer follow-up options

Step 5 — Maintain Session

After answering:
	•	Keep pageContext memory
	•	Wait for next question
	•	Repeat Steps 2–4
	•	Only replace pageContext when a new tab/page loads

⸻

6. Format Rules (Atlas Style)

When responding about a webpage, always format like ChatGPT Atlas:

This is a **[type of webpage]** from **[site]**.
It covers **[main topic]**.

Here’s what you’re looking at:

**Website:**  
**Topic:**  
**Headline:**  
**Key Points:**  
- ...
- ...

Then offer follow-up suggestions.

⸻

7. Required Cleanup

Remove all existing logic in the extension that:
	•	Drops page context after unrelated questions
	•	Switches permanently to general mode
	•	Overrides page-focused mode after search requests
	•	Clears context when the user asks off-topic questions
	•	Prevents summarization after general queries

These behaviors cause “focus loss” and must be replaced.

⸻

8. Goal

Make the sidebar AI behave exactly like ChatGPT Atlas:
	•	Page stays LOCKED until user navigates
	•	AI never loses focus
	•	General questions do not destroy page context
	•	Page analysis works across multiple turns
	•	Mixed questions retrieve outside info while still respecting the page
	•	Formatting and behavior match Atlas style

⸻
