
⸻

FINAL CODER-AGENT PROMPT (Copy/Paste This Into Your Agent)

Goal:
Revamp the sidebar AI to include ChatGPT Atlas-style chat history controls (add/delete), hard-code the model to gemini-3-pro-preview, remove the model dropdown, and update button/UI styling to match ChatGPT Atlas. All changes must be applied without breaking existing code logic, context extraction, or message handling.

⸻

1. Chat History Feature

Implement the following, preserving all existing sidebar architecture:

1.1 Add Chat
	•	Add a “New Chat” (+) button at the top of the history drawer.
	•	Each new chat creates a fresh session with a new sessionID and empty message list.
	•	Auto-generate a title based on the FIRST user message.
	•	Clicking “New Chat” must reset the chat window to empty but keep the sidebar UI intact.

1.2 Delete Chat
	•	Each chat history entry must include a delete (trash) icon, matching ChatGPT Atlas style.
	•	Confirm before deleting using a subtle modal or toast (“Delete chat?” → Yes / Cancel).
	•	Deleting removes the session from persistent storage.
	•	After deletion:
	•	If the deleted session is active → switch to the next most recent session.
	•	History panel updates immediately without breaking UI.

1.3 Storage
	•	Use existing localStorage/IndexedDB mechanisms.
	•	Do not overwrite or break current message store format.
	•	Only extend it to include metadata (title, timestamp, ID).

⸻

2. Hard-Code the Model

Remove dynamic model controls. Use:

model: "gemini-3-pro-preview"

	•	Remove / hide the model dropdown in the UI completely.
	•	Remove its event listeners.
	•	Ensure no functions rely on the old model-selection variable.
	•	Replace all references with the constant model name.

The change must not break:
	•	streaming
	•	search logic
	•	system prompt logic
	•	contextual understanding

⸻

3. Remove Model Dropdown Bar
	•	Delete the dropdown component on the right of the header.
	•	Adjust header spacing so layout still looks clean.
	•	Re-center the header title (“Gemini Assistant”).
	•	Ensure the header height remains consistent.
	•	Maintain padding identical to ChatGPT Atlas.

⸻

4. ChatGPT Atlas-Style Button Design

Apply new button styling to:
	•	“New Chat (+)”
	•	“Delete chat (trash icon)”
	•	“Send” button in message input
	•	History item hover states
	•	Any UI interaction buttons

Style Requirements

Buttons must follow Atlas style:
	•	Rounded radius: 10–12px
	•	Hover fade: 150–200ms
	•	Blue highlight for send button (#3B82F6)
	•	Soft shadows
	•	Dark mode color palette:
	•	Background: #2A2A2C
	•	Hover: #353538
	•	Border subtle or none

Icons must be:
	•	white or light grey
	•	20px size
	•	vertically centered
	•	fade-in on hover

Ensure button UX feels modern and tactile.

⸻

5. Message Input Box Improvement

Follow ChatGPT Atlas mechanism:
	•	Floating input bar with rounded corners
	•	Auto-resizing textarea
	•	Submit on Enter
	•	Shift+Enter for newline
	•	Sticky bottom position
	•	Keep focus on send
	•	Smooth shadow above box
	•	Blue send button

This component must remain compatible with your existing message-sending logic.

⸻

6. DO NOT Break Existing Code

Before editing files:
	•	Identify all currently used functions, event handlers, and data models.
	•	Make new features additive, not destructive.
	•	Maintain compatibility with your current:
	•	streaming API
	•	page context injection
	•	search fallback
	•	UI event bindings
	•	style classes

After implementing new features:
	•	Re-test all existing features:
	•	Chat sending
	•	Streaming
	•	Page context behavior
	•	Sidebar open/close
	•	Scroll behavior
	•	Input autofocus

⸻

7. Functional Testing (MANDATORY)

Perform tests for:

7.1 Chat History
	•	Add chat
	•	Switch chats
	•	Delete chat
	•	Auto-switch when deleting active chat
	•	Storage persistence after page reload

7.2 Model Hard-code
	•	Check no UI element references the old dropdown
	•	Confirm all responses use correct model
	•	Confirm no JS errors or undefined variables

7.3 UI Buttons
	•	Test hover states
	•	Test click responsiveness
	•	Test icon alignment
	•	Test layout stability

7.4 Input Box
	•	Test auto-expand
	•	Test sticky behavior
	•	Test Enter / Shift+Enter
	•	Test send button

7.5 Streaming
	•	Ensure incremental streaming is not broken
	•	Ensure scroll-to-bottom logic still works

⸻

8. Deliverables

Coder agent must produce:
	•	Updated JS code for chat storage and history actions
	•	Updated UI components for:
	•	History drawer
	•	Header
	•	Input box
	•	Buttons
	•	Message bubbles
	•	All associated CSS
	•	Explanation of where each change was made
	•	No unused code left behind

⸻

Goal

Make the sidebar AI behave and feel LIKE ChatGPT Atlas:
	•	clean
	•	modern
	•	responsive
	•	fast
	•	intuitive
	•	polished

While also simplifying the logic by hard-coding the model and removing the dropdown.

⸻
