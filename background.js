importScripts('config.js');

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ASK_AI') {
        handleOpenAIRequest(
            request.apiKey,
            request.question,
            request.metadata,
            request.history,
            request.attachment // Pass attachment
        )
            .then(answer => sendResponse({ answer }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Will respond asynchronously
    }
});




// --- OpenAI Integration ---

async function handleOpenAIRequest(apiKey, question, metadata, history, attachment) {
    const OPENAI_API_KEY = CONFIG.OPENAI_API_KEY;
    // Use OpenAI API endpoint
    const url = 'https://api.openai.com/v1/chat/completions';

    // 1. Prepare Context
    const MAX_CONTEXT_LENGTH = 15000;
    const truncatedContent = metadata.mainContent ? metadata.mainContent.substring(0, MAX_CONTEXT_LENGTH) : "No content available.";

    const systemPrompt = `You are a smart, helpful assistant with full browsing ability using web search.
    
[CURRENT PAGE CONTEXT]
URL: ${metadata.url}
Title: ${metadata.pageTitle}
Content: ${truncatedContent}

[INSTRUCTIONS]
1. **Page Focus**: Use the provided webpage content when the user is asking about the current page.
2. **Missing Info**: If the information is missing from the page (e.g. location, released date, price), AUTOMATICALLY use your web search capability.
3. **General Questions**: If the question is unrelated to the page (e.g. "weather", "general knowledge"), ignore the page content and use web search.
4. **No Hallucinations**: Always confirm facts using search if not in the page.
5. **Format**: Present answers in clear, well-structured language. If you used search, cite your sources naturally.
`;

    // 2. Prepare User Message (Multi-modal)
    let userContent = [];

    // Add text question (or default if only image sent)
    if (question) {
        userContent.push({ type: "text", text: question });
    } else if (attachment) {
        userContent.push({ type: "text", text: "Analyze this file." });
    }

    // Add Attachment Logic
    if (attachment) {
        if (attachment.type === 'image') {
            userContent.push({
                type: "image_url",
                image_url: {
                    url: attachment.content // Base64
                }
            });
        } else if (attachment.type === 'text') {
            // Append text content directly to the user's text question
            const fileContext = `\n\n[Attached File: ${attachment.name}]\n${attachment.content}\n`;

            // If we already have a text block, append to it
            // If userContent[0] is text type
            if (userContent.length > 0 && userContent[0].type === 'text') {
                userContent[0].text += fileContext;
            } else {
                userContent.push({ type: "text", text: fileContext });
            }
        }
    }

    // 3. Prepare Full Message Chain
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userContent }
    ];

    // 4. Make API Call
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini", // Updated Model
            messages: messages,
            max_tokens: 1000 // Reasonable limit for sidebar
        })
    });

    const data = await response.json();

    if (data.error) throw new Error(data.error.message);
    if (!data.choices || data.choices.length === 0) {
        throw new Error('Invalid API response: Missing choices. Response: ' + JSON.stringify(data));
    }

    const message = data.choices[0].message;
    return message.content;
}
