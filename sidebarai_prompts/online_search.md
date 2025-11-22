Modify the sidebar AI to support internet search similar to the official ChatGPT app.
Implement all of the following behavior:

1. Intent Detection for Search

Before calling the model, analyze the user’s question and determine if it requires current online information.

Trigger search when the question involves:
	•	weather
	•	today’s temperature
	•	current events
	•	latest news
	•	real-time facts
	•	“search”, “look up”, “find online”, “check for me”, etc.

If the question does not require online info, skip web search.

2. Search Pipeline (RAG-style)

If search is needed:
	1.	Generate a clean search query from the user’s question
	2.	Send that query to Tavily Search API (or alternative search engine)
	3.	Retrieve top relevant results
	4.	Extract:
	•	title
	•	URL
	•	summary/snippet
	5.	Pass all retrieved results into the AI with this instruction:

Here are search results. Synthesize a final answer using these results.
Cite the sources clearly. If uncertain, say so.

3. Output Behavior (ChatGPT-style)

The AI must:
	•	write a clear explanation
	•	keep paragraphs short
	•	break down steps
	•	summarize the answer
	•	include citations or URLs in a clean bullet list
	•	sound like a helpful assistant

4. Webpage + Web Search Dual Mode

Your sidebar must support:
	•	page analysis (current webpage)
	•	general questions (normal AI)
	•	internet search (when needed)

Use this logic:
	•	If question refers to current page → Use page content
	•	Else if question requires real-time info → Use web search
	•	Otherwise → Use base model only

5. Never block general questions

The AI must continue to answer non-search questions normally.


Goal

Give the sidebar the same smart behavior as the ChatGPT official app:
	•	Auto-detect when search is needed
	•	Perform online search using Tavily (or another provider)
	•	Feed search results back into the model
	•	Produce clean, structured explanations with sources
	•	Still act as a full general assistant
