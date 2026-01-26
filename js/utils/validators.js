/**
 * Validation Utility Functions
 * Input validation and data verification
 */

/**
 * Error types for categorization
 */
export const ErrorTypes = {
    NETWORK: 'Network Error',
    API: 'API Error',
    AUTH: 'Authentication Error',
    CONTENT: 'Content Extraction Error',
    FILE: 'File Processing Error',
    TTS: 'TTS Error',
    VALIDATION: 'Validation Error'
};

/**
 * Validates the configuration object
 * @param {Object} config - The configuration object to validate
 * @throws {Error} - If configuration is invalid
 */
export function validateConfig(config) {
    if (!config || typeof config !== 'object') {
        throw new Error('Configuration object not found. Please create a config.js file.');
    }

    if (!config.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not found. Please add OPENAI_API_KEY to your config.js file.');
    }

    if (typeof config.OPENAI_API_KEY !== 'string' || config.OPENAI_API_KEY.trim().length === 0) {
        throw new Error('OpenAI API key must be a non-empty string.');
    }

    // Basic format validation for OpenAI API keys
    if (!config.OPENAI_API_KEY.startsWith('sk-')) {
        throw new Error('Invalid OpenAI API key format. API keys should start with "sk-".');
    }
}

/**
 * Validates file type for upload
 * @param {File} file - The file to validate
 * @returns {Object} - Validation result with isValid and error properties
 */
export function validateFile(file) {
    if (!file) {
        return { isValid: false, error: 'No file provided.' };
    }

    // Check file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
        return { isValid: false, error: `File too large. Maximum size is 10MB.` };
    }

    // Check file type
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
        'text/plain',
        'text/markdown',
        'text/javascript',
        'application/json',
        'text/html',
        'text/css'
    ];

    // Check by MIME type
    if (allowedTypes.includes(file.type)) {
        return { isValid: true };
    }

    // Check by file extension for text files that may not have correct MIME type
    const allowedExtensions = ['.txt', '.md', '.js', '.py', '.html', '.css', '.json', '.pdf'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (hasValidExtension) {
        return { isValid: true };
    }

    return {
        isValid: false,
        error: `File type "${file.type || 'unknown'}" is not supported.`
    };
}

/**
 * Validates a chat message
 * @param {string} message - The message to validate
 * @returns {Object} - Validation result with isValid and error properties
 */
export function validateMessage(message) {
    if (!message || typeof message !== 'string') {
        return { isValid: false, error: 'Message must be a non-empty string.' };
    }

    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return { isValid: false, error: 'Message cannot be empty or whitespace only.' };
    }

    if (trimmed.length > 100000) {
        return { isValid: false, error: 'Message too long. Maximum length is 100,000 characters.' };
    }

    return { isValid: true };
}

/**
 * Validates a URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if the URL is valid
 */
export function isValidURL(url) {
    if (!url || typeof url !== 'string') return false;

    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Checks if text is an affirmative response
 * @param {string} text - The text to check
 * @returns {boolean} - True if the text is affirmative
 */
export function isAffirmative(text) {
    if (!text || typeof text !== 'string') return false;
    return /^(yes|yeah|yep|sure|ok|okay|do it|go ahead|please do|yup|i would|yes please)$/i.test(text.trim());
}

/**
 * Checks if text is a negative response
 * @param {string} text - The text to check
 * @returns {boolean} - True if the text is negative
 */
export function isNegative(text) {
    if (!text || typeof text !== 'string') return false;
    return /^(no|nah|nope|stop|cancel|don't|no thanks)$/i.test(text.trim());
}

/**
 * Sanitizes a chat title
 * @param {string} title - The title to sanitize
 * @param {number} maxLength - Maximum length for the title
 * @returns {string} - Sanitized title
 */
export function sanitizeTitle(title, maxLength = 50) {
    if (!title) return 'New Chat';
    return title.trim().substring(0, maxLength) + (title.length > maxLength ? '...' : '');
}
