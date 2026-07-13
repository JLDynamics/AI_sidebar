/**
 * Helper Utility Functions
 * Common utility functions used throughout the application
 */

/**
 * Generates a unique ID
 * @returns {string} - Unique ID string
 */
export function generateId() {
    return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Debounces a function call
 * @param {Function} func - The function to debounce
 * @param {number} wait - The wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttles a function call
 * @param {Function} func - The function to throttle
 * @param {number} limit - The minimum time between calls in milliseconds
 * @returns {Function} - Throttled function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Deep clones an object
 * @param {*} obj - The object to clone
 * @returns {*} - Cloned object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Object) {
        const clonedObj = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * Truncates text to a specified length
 * @param {string} text - The text to truncate
 * @param {number} maxLength - The maximum length
 * @returns {string} - Truncated text with ellipsis if needed
 */
export function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength) + '...';
}

/**
 * Removes an embedded attachment body from a stored message, keeping a short
 * marker in its place. Attachment content is saved on the bridge as a file the
 * model reads on demand, so the full text must NOT ride along in the
 * conversation history every turn (that would grow token cost without bound).
 * @param {string} content - The stored message content
 * @returns {string} - Content with the file body replaced by a marker
 */
export function stripAttachmentContent(content) {
    if (!content) return content || '';
    const marker = content.indexOf('\n\n[File: ');
    if (marker === -1) return content;
    const head = content.slice(0, marker);
    const nameMatch = content.slice(marker).match(/\[File: ([^\]]+)\]/);
    const name = nameMatch ? nameMatch[1] : 'file';
    return `${head}\n\n[Shared file: ${name} — saved to this session's files]`;
}

/**
 * Retry wrapper for async operations
 * @param {Function} asyncFn - The async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delayMs - Delay between retries in milliseconds
 * @returns {Promise} - Promise that resolves with the result
 */
export async function withRetry(asyncFn, maxRetries = 2, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await asyncFn();
        } catch (error) {
            if (attempt === maxRetries) throw error;

            // Don't retry on certain errors
            if (error.message?.includes('401') || error.message?.includes('403')) {
                throw error;
            }

            console.warn(`Attempt ${attempt} failed, retrying...`, error);
            await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
    }
}
