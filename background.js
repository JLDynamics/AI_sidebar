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
    const MODEL = CONFIG.OPENAI_MODEL;

    // Standard OpenAI Endpoint
    const url = 'https://api.openai.com/v1/chat/completions';

    // 1. Prepare Context
    const MAX_CONTEXT_LENGTH = 15000;
    const truncatedContent = metadata.mainContent ? metadata.mainContent.substring(0, MAX_CONTEXT_LENGTH) : "[No page content extracted]";

    const systemPrompt = `You are a smart, helpful assistant with access to real-time web search.
    
[CURRENT PAGE CONTEXT]
URL: ${metadata.url}
Title: ${metadata.pageTitle}
Content: ${truncatedContent}

[INSTRUCTIONS]
1. **Page Focus**: The user is asking about the current page content provided above.
   - If 'Content' is "[No page content extracted]" or empty, explicitly state you cannot read it.
2. **Web Search**: Use if page content is insufficient or user asks for external info.
3. **Format & Style**: 
   - Be **concise** and direct.
   - Use **bullet points** for lists and key takeaways.
   - Avoid fluffy intros/outros. Mimic a professional research tool.
   - **CRITICAL**: Do NOT apologize for previous errors or "confusion". Just answer the current question immediately.
`;

    // 2. Prepare User Message (Multi-modal)
    let userContent = [];
    if (question) {
        userContent.push({ type: "text", text: question });
    } else if (attachment) {
        userContent.push({ type: "text", text: "Analyze this file." });
    }

    if (attachment) {
        if (attachment.type === 'image') {
            userContent.push({ type: "image_url", image_url: { url: attachment.content } });
        } else if (attachment.type === 'text') {
            const fileContext = `\n\n[Attached File: ${attachment.name}]\n${attachment.content}\n`;
            if (userContent.length > 0 && userContent[0].type === 'text') {
                userContent[0].text += fileContext;
            } else {
                userContent.push({ type: "text", text: fileContext });
            }
        }
    }

    // 3. Initial Messages
    let messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userContent }
    ];

    // 4. Make API Call
    async function callAI(msgs) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: msgs,
                max_tokens: 1000
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        if (!data.choices || data.choices.length === 0) {
            throw new Error('Invalid API response: ' + JSON.stringify(data));
        }

        return data.choices[0].message.content;
    }

    return await callAI(messages);
}
