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
            request.history
        )
            .then(answer => sendResponse({ answer }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Will respond asynchronously
    }
});

const TAVILY_API_KEY = CONFIG.TAVILY_API_KEY;

// --- Search Router Logic ---

function determineSearchStrategy(question, pageContent) {
    const lowerQuestion = question.toLowerCase();

    // Rule A: Page Focus by Default
    // If asking about the page explicitly
    if (lowerQuestion.includes('this page') ||
        lowerQuestion.includes('this article') ||
        lowerQuestion.includes('summarize') ||
        lowerQuestion.includes('what is this about')) {
        return 'PAGE_ONLY';
    }

    // Rule C: General Questions = Web Search
    // Heuristic: If the question is about weather, general facts not likely on a specific page
    const generalKeywords = ['weather', 'current time', 'who is', 'what is', 'price of'];
    // This is tricky without an LLM to decide. 
    // We will let the LLM decide via Tool Calling, but we can give hints.

    // For "Atlas-style", we default to passing the page content BUT enabling the search tool.
    // The LLM (GPT-4o) is smart enough to ignore the page if it's irrelevant.

    return 'HYBRID';
}

// --- Web Actions (Tools) ---

async function performSearch(query) {
    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: query,
                search_depth: "basic",
                include_answer: false,
                max_results: 5
            })
        });

        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        return data.results.map(r => `[${r.title}](${r.url}): ${r.content}`).join('\n\n');
    } catch (error) {
        console.error('Search error:', error);
        return "Search failed. Please try again.";
    }
}

// --- OpenAI Integration ---

async function handleOpenAIRequest(apiKey, question, metadata, history) {
    const OPENAI_API_KEY = CONFIG.OPENAI_API_KEY;
    // Use the official OpenAI endpoint
    const url = 'https://api.openai.com/v1/chat/completions';

    // 1. Prepare Context
    const MAX_CONTEXT_LENGTH = 15000;
    const truncatedContent = metadata.mainContent ? metadata.mainContent.substring(0, MAX_CONTEXT_LENGTH) : "No content available.";

    const systemPrompt = `You are a smart, helpful assistant with full browsing ability using web actions.
    
[CURRENT PAGE CONTEXT]
URL: ${metadata.url}
Title: ${metadata.pageTitle}
Content: ${truncatedContent}

[INSTRUCTIONS]
1. **Page Focus**: Use the provided webpage content when the user is asking about the current page.
2. **Missing Info**: If the information is missing from the page (e.g. location, release date, price), AUTOMATICALLY use the 'web_search' tool.
3. **General Questions**: If the question is unrelated to the page (e.g. "weather", "general knowledge"), ignore the page content and use the 'web_search' tool.
4. **No Hallucinations**: Always confirm facts using search if not in the page.
5. **Format**: Present answers in clear, well-structured language. If you used search, cite your sources naturally.
`;

    // 2. Prepare Messages
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: question }
    ];

    // 3. Define Tools
    const tools = [
        {
            type: "function",
            function: {
                name: "web_search",
                description: "Search the internet for information not found on the current page or for general knowledge.",
                parameters: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The search query to perform."
                        }
                    },
                    required: ["query"]
                }
            }
        }
    ];

    // 4. First Call to OpenAI
    let response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-4.1-nano-2025-04-14", // User specified model
            messages: messages,
            tools: tools,
            tool_choice: "auto"
        })
    });

    let data = await response.json();

    if (data.error) throw new Error(data.error.message);

    if (!data.choices || data.choices.length === 0) {
        throw new Error('Invalid API response: Missing choices. Response: ' + JSON.stringify(data));
    }

    let message = data.choices[0].message;

    // 5. Handle Tool Calls (Web Actions)
    if (message.tool_calls) {
        messages.push(message);

        for (const toolCall of message.tool_calls) {
            if (toolCall.function.name === 'web_search') {
                const args = JSON.parse(toolCall.function.arguments);
                const query = args.query;

                const searchResults = await performSearch(query);

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: "web_search",
                    content: searchResults
                });
            }
        }

        // 6. Second Call to OpenAI (Generate Final Answer)
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4.1-nano-2025-04-14",
                messages: messages
            })
        });

        data = await response.json();
        if (data.error) throw new Error(data.error.message);
        message = data.choices[0].message;
    }

    return message.content;
}
