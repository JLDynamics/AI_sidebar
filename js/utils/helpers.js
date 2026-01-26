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
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * Formats a file size for display
 * @param {number} bytes - The file size in bytes
 * @returns {string} - Formatted file size string
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
 * Cleans text for TTS by removing URLs and citations
 * @param {string} text - The text to clean
 * @returns {string} - Cleaned text
 */
export function cleanTextForTTS(text) {
    if (!text) return '';

    // Remove Markdown links [text](url) -> text
    let cleanText = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove http/https URLs
    cleanText = cleanText.replace(/https?:\/\/[^\s)]+/g, '');

    // Remove parenthesized domains often used as citations e.g. (example.com)
    cleanText = cleanText.replace(/\([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\)/g, '');

    return cleanText;
}

/**
 * Checks if a value is a promise
 * @param {*} value - The value to check
 * @returns {boolean} - True if the value is a promise
 */
export function isPromise(value) {
    return value && typeof value.then === 'function';
}

/**
 * Safe JSON parse with fallback
 * @param {string} json - The JSON string to parse
 * @param {*} fallback - The fallback value if parsing fails
 * @returns {*} - Parsed object or fallback
 */
export function safeJSONParse(json, fallback = null) {
    try {
        return JSON.parse(json);
    } catch (e) {
        console.warn('Failed to parse JSON:', e);
        return fallback;
    }
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
