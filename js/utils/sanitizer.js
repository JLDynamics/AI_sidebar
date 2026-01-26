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

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} text - The text to escape
 * @returns {string} - Escaped text safe for HTML
 */
export function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Sanitizes a URL for use in href/src attributes
 * @param {string} url - The URL to sanitize
 * @returns {string} - Sanitized URL or empty string if dangerous
 */
export function sanitizeURL(url) {
    if (!url || typeof url !== 'string') return '';

    // Block javascript: and data: URLs
    if (url.trim().toLowerCase().startsWith('javascript:') ||
        url.trim().toLowerCase().startsWith('data:')) {
        return '';
    }

    return url;
}
