/**
 * HTML Sanitizer Utility
 * Removes scripts, event handlers, and potentially dangerous content from HTML
 */

/**
 * Sanitizes HTML by removing scripts and event handlers
 * @param {string} html - The HTML string to sanitize
 * @returns {string} - Sanitized HTML string
 */
export function sanitizeHTML(html) {
    const template = document.createElement('div');
    template.innerHTML = html;

    // Remove scripts
    const scripts = template.querySelectorAll('script');
    scripts.forEach(script => script.remove());

    // Remove event handlers (onclick, onerror, etc)
    const all = template.querySelectorAll('*');
    all.forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on') || attr.name.startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return template.innerHTML;
}

