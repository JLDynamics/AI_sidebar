importScripts('config.js');

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ASK_AI') {
        handleAskAI(request)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }
});

// --- Provider routing ---------------------------------------------------

async function handleAskAI(request) {
    const providerId = request.providerId || CONFIG.DEFAULT_PROVIDER;
    const provider = (CONFIG.PROVIDERS || {})[providerId];

    if (!provider) {
        throw new Error(`Unknown provider "${providerId}". Check PROVIDERS in config.js.`);
    }

    // 'default' means: let the backend use its own default model
    const model = (request.model && request.model !== 'default') ? request.model : null;

    if (provider.type === 'bridge') {
        const data = await callBridge(provider, request, model);
        return {
            answer: data.answer,
            meta: {
                provider: data.provider,
                model: data.model,
                cost_usd: data.cost_usd,
                duration_ms: data.duration_ms
            }
        };
    }

    const started = Date.now();
    const answer = await callOpenAICompatible(provider, request, model);
    return {
        answer: answer,
        meta: {
            provider: provider.label || providerId,
            model: model || provider.model,
            duration_ms: Date.now() - started
        }
    };
}

// --- Route 1: Python bridge -> Claude Code ------------------------------

async function callBridge(provider, request, model) {
    const url = `${(CONFIG.BRIDGE_URL || 'http://127.0.0.1:8765').replace(/\/+$/, '')}/chat`;

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: request.question || '',
                metadata: {
                    url: request.metadata?.url || 'unknown',
                    title: request.metadata?.title || request.metadata?.pageTitle || 'unknown',
                    mainContent: request.metadata?.mainContent || ''
                },
                history: request.history || [],
                attachment: request.attachment || null,
                provider: provider.provider,
                model: model || provider.model || null,
                effort: request.effort || null
            })
        });
    } catch (e) {
        throw new Error(
            'Bridge server not reachable. Start it with: uvicorn server:app --port 8765 (in the bridge folder).',
            { cause: e }
        );
    }

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || `Bridge error (HTTP ${response.status})`);
    }
    return data;
}

// --- Route 2: direct OpenAI-compatible API ------------------------------

async function callOpenAICompatible(provider, request, model) {
    if (!provider.baseUrl) {
        throw new Error(`Provider "${provider.label}" has no baseUrl configured yet. Fill it in config.js.`);
    }
    const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const { question, metadata, history, attachment } = request;

    // 1. Page context as system prompt
    const MAX_CONTEXT_LENGTH = 15000;
    const truncatedContent = metadata.mainContent
        ? metadata.mainContent.substring(0, MAX_CONTEXT_LENGTH)
        : '[No page content extracted]';

    const systemPrompt = `You are a helpful assistant running inside a browser side panel.

[CURRENT PAGE CONTEXT]
URL: ${metadata.url || 'unknown'}
Title: ${metadata.title || metadata.pageTitle || 'unknown'}
Content: ${truncatedContent}

[INSTRUCTIONS]
1. The user is asking about the current page content provided above.
2. Be concise and direct. Use bullet points for lists.
3. Do NOT apologize for previous errors - just answer the current question.
`;

    // 2. User message (multi-modal)
    const userContent = [];
    if (question) {
        userContent.push({ type: 'text', text: question });
    } else if (attachment) {
        userContent.push({ type: 'text', text: 'Analyze this file.' });
    }

    if (attachment) {
        if (attachment.type === 'image') {
            userContent.push({ type: 'image_url', image_url: { url: attachment.content } });
        } else if (attachment.type === 'text') {
            const fileContext = `\n\n[Attached File: ${attachment.name}]\n${attachment.content}\n`;
            if (userContent.length > 0 && userContent[0].type === 'text') {
                userContent[0].text += fileContext;
            } else {
                userContent.push({ type: 'text', text: fileContext });
            }
        }
    }

    // 3. Build messages and call the API
    const messages = [
        { role: 'system', content: systemPrompt },
        ...(history || []),
        { role: 'user', content: userContent }
    ];

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey || ''}`
        },
        body: JSON.stringify({
            model: model || provider.model,
            messages: messages,
            max_tokens: 2000
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    if (!data.choices || data.choices.length === 0) {
        throw new Error('Invalid API response: ' + JSON.stringify(data).substring(0, 500));
    }

    return data.choices[0].message.content;
}
