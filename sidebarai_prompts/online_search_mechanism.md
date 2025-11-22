Coder-Agent Prompt: Add Smart Search for Page-Relevant Questions (ChatGPT Behavior)

Modify the sidebar AI so it behaves like ChatGPT Atlas regarding online search while keeping page-focus intact.
Implement the following mechanism:

⸻

1. Maintain Page Context Lock

Do NOT remove pageContext unless the user navigates to a new page.

⸻

2. Add Knowledge Gap Detection

Before answering any question about the webpage:
	1.	Parse the user question
	2.	Check if it refers to:
	•	the article
	•	the game
	•	the company
	•	the developer
	•	characters
	•	features
	•	the topic

If yes → treat as page-related question.
	3.	Check if the answer exists inside pageContext.mainContent:

	•	If answer exists → answer from page only
	•	If answer does NOT exist → mark as knowledge gap

⸻

3. Conditional Online Search (ONLY when page-related gap exists)

If a knowledge gap is detected:
	•	Allow online search
	•	Use Tavily or similar search API
	•	Query using:

[user question] + [site name] + [topic]



Feed the search results back into the model as additional context.

⸻

4. Do NOT search for unrelated questions

If user asks something unrelated (weather, politics, personal questions):
	•	DO NOT trigger online search
	•	Answer normally
	•	Keep pageContext active
	•	State limitations if needed

⸻

5. Response Composition Rules

After search:
	•	Combine pageContext + external info
	•	Produce a structured answer
	•	State sources when possible
	•	Avoid hallucinating missing details

⸻

6. Preserve Focus Mechanism

After answering ANY question (related or unrelated):
	•	Do NOT remove pageContext
	•	Do NOT clear page memory
	•	The AI must still know what page is open
	•	Only reset when user navigates to new URL

⸻

Goal

The sidebar must:
	•	Stay focused on the webpage
	•	Use article info first
	•	Search online ONLY when page-related info is missing
	•	Never search for unrelated questions
	•	Never hallucinate missing information
	•	Behave exactly like ChatGPT Atlas

⸻
