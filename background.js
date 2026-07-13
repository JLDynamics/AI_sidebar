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
    if (request.type === 'FORGET_SESSION') {
        forgetSession(request.sessionId)
            .then(() => sendResponse({ ok: true }))
            .catch(() => sendResponse({ ok: false }));
        return true;
    }
});

// Ask the bridge to delete a session's remembered pages (best-effort).
async function forgetSession(sessionId) {
    if (!sessionId) return;
    const base = (CONFIG.BRIDGE_URL || 'http://127.0.0.1:8765').replace(/\/+$/, '');
    try {
        await fetch(`${base}/memory/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    } catch (e) {
        // Bridge may be down; the bridge also prunes stale memory by age.
    }
}

// --- Provider routing ---------------------------------------------------

async function handleAskAI(request) {
    const providerId = request.providerId || CONFIG.DEFAULT_PROVIDER;
    const provider = (CONFIG.PROVIDERS || {})[providerId];

    if (!provider) {
        throw new Error(`Unknown provider "${providerId}". Check PROVIDERS in config.js.`);
    }

    // 'default' means: let the backend use its own default model
    const model = (request.model && request.model !== 'default') ? request.model : null;

    if (provider.type !== 'bridge') {
        throw new Error(`Provider "${providerId}" must be type 'bridge'. This build routes all requests through the Claude Code bridge.`);
    }

    const data = await callBridge(provider, request, model);
    return {
        answer: data.answer,
        meta: {
            provider: data.provider,
            model: data.model,
            effort: data.effort || request.effort || null,
            cost_usd: data.cost_usd,
            duration_ms: data.duration_ms,
            num_turns: data.num_turns
        }
    };
}

// --- Python bridge -> Claude Code ---------------------------------------

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
                effort: request.effort || null,
                mode: request.mode || null,
                session_id: request.sessionId || ''
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
