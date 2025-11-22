
Modify the sidebar AI to work like ChatGPT Atlas. Implement these rules:

1. Support two behaviors at the same time
	•	General AI mode:
Answer ANY user question, even if unrelated to the webpage.
	•	Webpage analysis mode:
When the question refers to the webpage, summarize or explain the main content only, not the whole site.

2. Webpage content is optional

Do NOT force the AI to use webpage text.
Provide it as optional context:

Here is optional webpage content. Use it only if it helps answer the user. Ignore it if not relevant.
[MAIN_CONTENT]

3. Automatic intent detection

The logic must work like this:
	•	If the user mentions “this page”, “this article”, “summarize this”, or anything pointing to the webpage →
Use the webpage content in the answer.
	•	If the question does NOT reference the webpage →
Ignore the webpage entirely and answer normally.

4. Never block general questions

Remove any restrictions that prevent answering unrelated questions.
The AI must always answer, whether the question is about the webpage or not.

Goal

The sidebar should behave like ChatGPT Atlas:
A general-purpose assistant that can ALSO analyze the webpage when needed, instead of being locked to webpage-only answers.
