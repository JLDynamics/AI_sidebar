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

    if (!config.PROVIDERS || Object.keys(config.PROVIDERS).length === 0) {
        throw new Error('No providers configured. Please add a PROVIDERS map to your config.js file.');
    }

    if (config.DEFAULT_PROVIDER && !config.PROVIDERS[config.DEFAULT_PROVIDER]) {
        throw new Error(`DEFAULT_PROVIDER "${config.DEFAULT_PROVIDER}" is not defined in PROVIDERS.`);
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

/* affirmative/negative helpers removed with the search-confirmation flow */
