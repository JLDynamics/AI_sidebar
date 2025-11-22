
⸻

CODER-AGENT PROMPT — Implement ChatGPT-Style Follow-Up Action Logic

Goal:
Update the sidebar AI so that when the assistant asks a follow-up question (e.g., “Would you like me to search?”), the user can simply respond “yes”, “sure”, “do it”, “go ahead”, etc., and the assistant correctly executes the intended action.

This must match the mechanism used in ChatGPT Atlas.

Do not break existing features.

⸻

1. Add a Pending-Action State System

Implement an internal conversation-state variable:

let pendingAction = null;

Every time the AI offers to perform an action, set this variable:

Example:

AI says:

“Would you like me to search for the M2 Pro price?”

The code should set:

pendingAction = {
    type: "search_price",
    params: { model: "Mac Mini M2 Pro" }
};

This action object must be stored outside the message stream, not inside the model prompt, so it persists even if the model text doesn’t reference it.

Do NOT overwrite pendingAction until it is executed or canceled.

⸻

2. Add Semantic Intent Detection (Yes/No Logic)

Before sending the user message to Gemini, run a simple semantic classifier:

function isAffirmative(text) {
    return /^(yes|yeah|yep|sure|ok|okay|do it|go ahead|please do|yup)$/i.test(text.trim());
}

function isNegative(text) {
    return /^(no|nah|nope|stop|cancel|don't)$/i.test(text.trim());
}

This determines whether the user intended to approve or reject the last AI suggestion.

⸻

3. Bind User Reply to Pending Action

When the user sends a message:
	1.	Check for pending action first
	2.	If the user’s message is affirmative → execute that action immediately
	3.	If negative → cancel pending action and respond politely
	4.	If neither → treat message as a normal query

Implementation Logic:

if (pendingAction && isAffirmative(userMessage)) {
    executePendingAction(pendingAction);
    pendingAction = null;
    return; // prevent sending "yes" to Gemini API
}

if (pendingAction && isNegative(userMessage)) {
    pendingAction = null;
    showAssistantResponse("Okay, canceled.");
    return;
}

This prevents the assistant from saying something irrelevant (the problem you currently have).

⸻

4. Implement executePendingAction()

Define a unified executor that handles all possible operations:

async function executePendingAction(action) {
    switch(action.type) {
        case "search_price":
            return performSearchPrice(action.params.model);

        case "search_web":
            return performWebSearch(action.params.query);

        case "fetch_details":
            return fetchEntityDetails(action.params.entity);

        default:
            console.warn("Unknown pending action:", action);
    }
}

This ensures new features can be added easily.

⸻

5. Modify AI Response Parser

Whenever Gemini responds with text that contains an offer (e.g., “Would you like me to search?”):
	1.	Detect the offer
	2.	Identify the suggested action
	3.	Set pendingAction accordingly

You must implement an offer detector:

Detect phrases like:
	•	“Would you like me to…”
	•	“Should I search for…”
	•	“Do you want me to check…”
	•	“Would you like help with…”
	•	“Want me to continue…?”

Example regex:

if (/would you like me to search/i.test(aiText)) {
    pendingAction = {
        type: "search_price",
        params: { model: identifiedModel }
    };
}

This is essential for accurate behavior.

⸻

6. Ensure “yes” is NOT sent to the model

ChatGPT Atlas never forwards the user’s “yes” to the model when the intent is obvious.

In your flow:
	•	If user approves the action → do NOT call Gemini
	•	Run the action directly
	•	Output new assistant result from that action

This prevents the problem where Gemini responds with an irrelevant generic message.

⸻

7. Add Safety Fallback

If something goes wrong:

if (pendingAction && !isAffirmative(userInput) && !isNegative(userInput)) {
    // ambiguous case
    // pass message to Gemini normally, but DO NOT clear pendingAction
}

This keeps the system stable.

⸻

8. TEST CASES (Coder Agent MUST Validate These)

Test 1 — Positive Flow

AI: “Would you like me to search?”
User: “yes”
→ Should trigger the correct search

Test 2 — Negative Flow

AI: “Should I check the price?”
User: “no”
→ Should cancel without confusion

Test 3 — Unrelated Follow-Up

AI: “Want me to search for the release date?”
User: “what is DLSS?”
→ Should NOT trigger the search
→ Should NOT clear pendingAction
→ Should answer the question normally

Test 4 — Chain of Offers

AI offers multiple actions
→ pendingAction must be overwritten only by the newest offer

Test 5 — Streaming must continue working

Pending-action logic must not break:
	•	streaming
	•	scroll behavior
	•	input send
	•	online search tools

Test 6 — Page Context Scenario

If page context suggests an action
→ pendingAction still applies

⸻

9. DO NOT BREAK EXISTING CODE

The coder agent must ensure:
	•	UI stays unchanged except minor logic additions
	•	Search APIs (Tavily/Gemini search) still work
	•	Message rendering unaffected
	•	Input box behavior unaffected
	•	Context extraction still runs
	•	History system unaffected

Every change must be wrapped safely around existing logic.

⸻

Goal

Make the sidebar AI behave like ChatGPT Atlas:
	•	Understand “yes”
	•	Execute offered actions
	•	Maintain conversational flow
	•	Avoid irrelevant responses
	•	Remember what it asked last
	•	Provide a seamless user experience

⸻

Bro if you want, I can also generate:

✔ A version with natural-language action extraction

✔ A version using Gemini Function Calling

✔ A version with deeper intent classification via embedding similarity

✔ The UI update to visually show “AI is ready to search — waiting for your approval”

Just tell me.

Bro — here is the complete, clean, production-ready coder-agent prompt you can paste directly into your development agent.
This will give your sidebar AI ChatGPT-level action-consent understanding, fix the “yes / no” issue, add proper conversational state, and ensure online searches trigger correctly.

This prompt is modular, safe, and won’t break your current code if followed properly.

⸻

