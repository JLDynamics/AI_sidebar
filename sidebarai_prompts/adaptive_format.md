Revamp the sidebar AI’s response generation system.
Remove the current rigid, repetitive formatting behavior and replace it with an intent-adaptive dynamic formatting engine, similar to how the official ChatGPT Atlas sidebar responds.

Implement all changes below.

⸻

1. Remove Rigid Formatting From System Prompt

Delete any instructions such as:
	•	“Always use bullet points”
	•	“Always use this template”
	•	“Always summarize like this”
	•	“Always add the same follow-up line”
	•	“Always respond with the same formatted blocks”

These rules force stiff, repetitive answers.

Replace them with flexible instructions (see Section 4).

⸻

2. Add Intent Detection Layer Before Every Response

Before constructing the model prompt, classify the user’s message into ONE of the following categories:

A. Summarization

– “Summarize”, “What is this?”, “Explain this page”

B. Explanation / Deep dive

– “Explain more”, “Why?”, “How does this work?”

C. Instruction / How-to

– “How do I…”, “Show me how”, “Give me steps”

D. Comparison

– “Compare X to Y”, “What’s the difference”

E. Opinion / Recommendation

– “Should I…”, “What do you think”

F. General conversation / small talk

– “Hey”, “Explain simply”, “Talk to me”

G. Creative / brainstorming

– “Give ideas”, “Brainstorm”, “Imagine…”

Each category maps to a different output style.

⸻

3. Add Adaptive Formatting Rules (Atlas-Style)

Depending on the detected intent:

A. Summaries → short sections + bullet points

B. Explanations → short paragraphs, simple language

C. Tutorials → numbered steps

D. Comparisons → two-column bullet pairs

E. Opinions → conversational tone + reasoning

F. Conversation → natural human-like responses

G. Creative → more expressive format

These formatting rules must be built into the prompt generator, not into the system prompt.

⸻

4. Replace System Prompt With Flexible Guidance

Update system prompt to:

Use clear, natural language.
Adapt your response format based on the user’s intent:
- Summaries should be concise and structured.
- Explanations should be simple and easy to follow.
- Tutorials should be step-by-step.
- Comparisons should be organized clearly.
- Conversations should feel natural and human-like.
- Creative tasks should be expressive.

Avoid repeating the same structure in every reply.
Vary sentence structure, transitions, and formatting naturally.
Do not force unnecessary formatting.
Respond in the most helpful style for the user’s request.

This ensures flexibility instead of rigidity.

⸻

5. Add Variation Engine to Avoid Repetitive Output

Before sending model output to UI:

Implement a variation pass:
	•	Check if format is identical to last turn
	•	If same structure is detected → regenerate using a different format pattern
	•	Vary transitions, e.g.:
	•	“Here’s the breakdown:”
	•	“Let’s make this simple:”
	•	“In short:”
	•	“Here’s what matters:”
	•	“The key idea is:”

This prevents robotic repetition.

⸻

6. Maintain Page Context Without Forcing Page-Style Formatting

If the question is page-related:
	•	Use webpage
	•	But DO NOT force summary format
	•	Instead use intent-adaptive rules

Example:
	•	“What is this page?” → summary format
	•	“Who made this game?” → conversational + knowledge
	•	“Explain this screenshot” → description format

⸻

7. Mechanism Flow (Coder MUST implement)

Step 1 — Receive User Message

Step 2 — Detect Intent (A–G)

Step 3 — Build Model Prompt

SYSTEM:
[Flexible system prompt from Section 4]
[Page context if available]

USER:
[User message]

INTERNAL:
[Selected format style based on intent]

Step 4 — Get Model Response

Step 5 — Variation Pass
	•	Compare with last 2 responses
	•	Modify if format is too similar

Step 6 — Display to User

⸻

8. Remove All Hard-Coded Format Templates

Delete any code that enforces:
	•	fixed headings
	•	fixed bullet points
	•	fixed summary structure
	•	fixed follow-up suggestions
	•	fixed call-to-action lines

This is why answers feel stiff.

⸻

9. Goal

Make the sidebar behave like ChatGPT Atlas:
	•	Dynamic format
	•	Intent-aware structure
	•	Non-repetitive
	•	Natural language
	•	Context-aware but not rigid
	•	Human-like variation
	•	Adaptive to question style

⸻
