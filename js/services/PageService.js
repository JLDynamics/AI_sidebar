/**
 * Page Service
 * Extracts readable content from the active browser tab
 * using Readability.js, with a raw-text fallback.
 */

/**
 * Runs inside the page via chrome.scripting.executeScript.
 * Must be self-contained: no imports or outer variables.
 * @returns {Object|null} - {url, title, domain, mainContent}
 */
function extractPageContent() {
    const MAX_CHARS = 15000;
    try {
        const documentClone = document.cloneNode(true);
        if (typeof Readability !== 'undefined') {
            const reader = new Readability(documentClone);
            const article = reader.parse();
            if (article && article.textContent) {
                return {
                    url: window.location.href,
                    title: article.title || document.title,
                    domain: window.location.hostname,
                    mainContent: article.textContent.replace(/\s+/g, ' ').trim().substring(0, MAX_CHARS)
                };
            }
        }
        // Fallback to raw innerText
        const raw = document.body.innerText.replace(/\s+/g, ' ').trim().substring(0, MAX_CHARS);
        return {
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname,
            mainContent: raw || 'No readable content found.'
        };
    } catch {
        return null;
    }
}

/**
 * Gets metadata + readable content from the currently active tab.
 * Falls back to {url, title} only when injection isn't possible
 * (e.g. chrome:// pages or the web store).
 * @returns {Promise<Object>} - {url, title, domain?, mainContent?}
 */
export async function getActivePageContent() {
    const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
    const [tab] = await chrome.tabs.query({ active: true, windowId: currentWindow.id });

    if (!tab) throw new Error('No active tab found in main window');

    let metadata = { url: tab.url, title: tab.title };

    try {
        if (tab.url && tab.url.startsWith('http')) {
            // Inject the Readability library first, then run the extractor
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['Readability.js']
            });

            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: extractPageContent
            });

            if (result && result[0] && result[0].result) {
                metadata = result[0].result;
            }
        }
    } catch (e) {
        console.warn('Script injection failed (likely restricted page):', e);
    }

    return metadata;
}
