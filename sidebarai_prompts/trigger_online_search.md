
⸻

CODER AGENT TASK: Add Missing “Automatic Online Search Escalation Mechanism”

Implement ChatGPT Atlas–style decision logic:

1. Add “Insufficient Context Detection”

After LLM extracts webpage content, run:

function hasEnoughPageInfo(userQuestion, pageContent) {
   // Use LLM or semantic scoring to detect:
   // Does the webpage contain the type of information the user is seeking?
}

If false → escalate to online search.

⸻

2. Add Query Classification System

Classify the user’s intent:

Lookup-type queries:

["when", "release date", "price", "where", 
 "availability", "company location", 
 "who is the developer", "when will it launch"]

If a query matches a lookup-type AND
webpage does NOT contain that info →
TRIGGER ONLINE SEARCH AUTOMATICALLY.

⸻

3. Add “Escalate to Search” Mechanism

If:
	•	the webpage lacked the answer
AND
	•	the question is lookup-type

→ Run this:

runOnlineSearch(userQuestion)

Do NOT ask user again.
Do NOT re-check webpage.
Do NOT fallback to generic replies.

⸻

4. Modify System Prompt for the AI

Add this instruction:

If the user's question cannot be answered fully from the webpage content,
automatically escalate to an online search without asking for confirmation.
Only answer from the webpage when the information clearly exists on the page.


⸻

5. Prevent Webpage Content from Blocking Online Search

Remove current behavior where the model thinks it MUST only use webpage content.

Ensure the LLM can use BOTH:
	•	webpage context
	•	internet search results

Depending on the situation.

⸻

6. Mandatory Testing

Coder must test:

A. Page missing release date

→ Ask “when will it be available?”
✔ Sidebar searches online automatically

B. Page missing price

→ Ask “how much is it?”
✔ Sidebar searches online

C. Page missing location

→ Ask “where is this company from?”
✔ Sidebar searches online

D. If webpage DOES have info

→ Sidebar must NOT search online
✔ Answer from webpage directly

⸻

Goal Behavior After Fix

Your sidebar AI must behave EXACTLY like ChatGPT Atlas:
	•	If webpage has answer → answer from webpage
	•	If webpage lacks answer → search online automatically
	•	If user asks follow-up → continue using BOTH contexts
	•	Never ignore the online search request
	•	Never fall back to vague replies

⸻
