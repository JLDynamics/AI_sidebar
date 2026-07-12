/**
 * Page Service
 * Extracts readable content from the active browser tab using Defuddle, which
 * removes page boilerplate and returns clean Markdown directly. Falls back to
 * cleaned raw text if Defuddle is unavailable or can't parse the page.
 */

/**
 * Runs inside the page via chrome.scripting.executeScript.
 * Must be self-contained: no imports or outer variables (the function body is
 * serialized and injected, so every helper lives inside it).
 * @returns {Object|null} - {url, title, domain, mainContent}
 */
function extractPageContent() {
    const MAX_CHARS = 20000;
    let title = document.title;

    // Prepend a "# Title" (plus byline/source) unless the body already opens
    // with that same heading — avoids showing the title to the model twice.
    function withHeader(body, extras) {
        const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
        const lines = body.split('\n');
        const fh = (lines[0] || '').match(/^#{1,6}\s+(.+)$/);
        const titleDup = fh && title && norm(fh[1]) === norm(title);

        const meta = (extras || []).filter(Boolean);
        if (titleDup) {
            if (!meta.length) return body;
            const rest = lines.slice(1).join('\n').replace(/^\n+/, '');
            return [lines[0], meta.join('\n\n'), rest].filter(Boolean).join('\n\n');
        }
        const header = [];
        if (title) header.push(`# ${title}`);
        meta.forEach((line) => header.push(line));
        return header.length ? header.join('\n\n') + '\n\n' + body : body;
    }

    // Cut at the last block boundary before the limit so we never leave a
    // half table or code fence dangling.
    function clamp(text) {
        if (text.length <= MAX_CHARS) return text;
        const boundary = text.lastIndexOf('\n\n', MAX_CHARS);
        return text.substring(0, boundary > MAX_CHARS * 0.6 ? boundary : MAX_CHARS).trim();
    }

    try {
        let markdown = '';
        const extras = [];

        // Primary: Defuddle outputs clean Markdown directly (removes nav/ads/
        // boilerplate, resolves links, standardizes code/tables/footnotes/math).
        // It clones the DOM internally, so passing the live document is safe.
        if (typeof Defuddle !== 'undefined') {
            try {
                const r = new Defuddle(document, { url: window.location.href, markdown: true }).parse();
                if (r && r.content) {
                    title = r.title || title;
                    markdown = String(r.content).trim();
                    if (r.author) extras.push(`_By ${String(r.author).trim()}_`);
                    if (r.site) extras.push(`_Source: ${String(r.site).trim()}_`);
                    if (r.published) extras.push(`_Published: ${String(r.published).trim()}_`);
                }
            } catch (e) {
                // fall through to the raw-text last resort
            }
        }

        // Last resort (Defuddle unavailable or failed): cleaned raw text from
        // the main content region, with obvious chrome stripped out.
        if (!markdown) {
            const main = document.querySelector('main, article, [role="main"]') || document.body;
            const clone = main.cloneNode(true);
            clone.querySelectorAll('nav, aside, footer, header, script, style, noscript, form')
                .forEach((el) => el.remove());
            markdown = (clone.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
        }

        markdown = markdown ? withHeader(markdown, extras) : 'No readable content found.';

        return {
            url: window.location.href,
            title: title,
            domain: window.location.hostname,
            mainContent: clamp(markdown)
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
            // Inject Defuddle, then run the extractor.
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['defuddle.js']
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
