Update my sidebar AI so it analyzes only the main content of the webpage, not the entire DOM.
Implement the following logic:
	1.	Use a boilerplate remover / readability extractor, such as:
	•	Mozilla Readability (recommended)
	•	or any equivalent “main content extractor” library
This ensures we only get the real article/body text.
	2.	Ignore these elements completely:
	•	<header>, <footer>
	•	<nav>, menus, navigation bars
	•	<aside> (sidebars)
	•	ads, popups, cookie banners
	•	related articles, recommended links
	•	comment sections
	•	external script-generated widgets
	3.	After extracting the main article/primary text, return only:
	•	clean text
	•	headings
	•	paragraphs
	•	lists
	•	images (optional)
Nothing else.
	4.	Pass ONLY this cleaned main content to the AI model for:
	•	summarization
	•	answering questions
	•	reasoning
	•	discussion
	5.	If the webpage has no readable main content, return:
“No primary content detected.”

Goal:
The AI must behave like a smart reader that focuses only on the real article or main text, just like Mercury Parser or Mozilla Reader View.