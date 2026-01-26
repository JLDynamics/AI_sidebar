/**
 * Storage Service
 * Wraps localStorage operations with error handling and serialization
 */

const STORAGE_KEYS = {
    CHATS: 'gemini_chats',
    SETTINGS: 'sidebar_settings'
};

const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

/**
 * Checks if localStorage is available
 * @returns {boolean} - True if localStorage is available
 */
function isStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Estimates the size of a string in bytes
 * @param {string} str - The string to measure
 * @returns {number} - Size in bytes
 */
function getStringSize(str) {
    return new Blob([str]).size;
}

/**
 * Storage Service class
 */
class StorageService {
    constructor() {
        this.available = isStorageAvailable();
        if (!this.available) {
            console.warn('localStorage is not available. Chat history will not persist.');
        }
    }

    /**
     * Gets an item from localStorage
     * @param {string} key - The storage key
     * @returns {*} - The parsed value or null
     */
    getItem(key) {
        if (!this.available) return null;

        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            console.error(`Failed to get item "${key}" from localStorage:`, e);
            return null;
        }
    }

    /**
     * Sets an item in localStorage
     * @param {string} key - The storage key
     * @param {*} value - The value to store
     * @returns {boolean} - True if successful
     */
    setItem(key, value) {
        if (!this.available) return false;

        try {
            const serialized = JSON.stringify(value);
            const size = getStringSize(serialized);

            if (size > MAX_STORAGE_SIZE) {
                throw new Error(`Storage quota exceeded. Item size: ${size} bytes`);
            }

            localStorage.setItem(key, serialized);
            return true;
        } catch (e) {
            console.error(`Failed to set item "${key}" in localStorage:`, e);

            // Handle quota exceeded error
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                this._cleanupOldEntries(key);
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (retryError) {
                    console.error('Retry failed after cleanup:', retryError);
                }
            }
            return false;
        }
    }

    /**
     * Removes an item from localStorage
     * @param {string} key - The storage key
     */
    removeItem(key) {
        if (!this.available) return;
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error(`Failed to remove item "${key}" from localStorage:`, e);
        }
    }

    /**
     * Clears all items from localStorage
     */
    clear() {
        if (!this.available) return;
        try {
            localStorage.clear();
        } catch (e) {
            console.error('Failed to clear localStorage:', e);
        }
    }

    /**
     * Gets all chat history
     * @returns {Array} - Array of chat objects
     */
    getChats() {
        return this.getItem(STORAGE_KEYS.CHATS) || [];
    }

    /**
     * Saves chat history
     * @param {Array} chats - Array of chat objects
     * @returns {boolean} - True if successful
     */
    saveChats(chats) {
        return this.setItem(STORAGE_KEYS.CHATS, chats);
    }

    /**
     * Gets settings
     * @returns {Object} - Settings object
     */
    getSettings() {
        return this.getItem(STORAGE_KEYS.SETTINGS) || {};
    }

    /**
     * Saves settings
     * @param {Object} settings - Settings object
     * @returns {boolean} - True if successful
     */
    saveSettings(settings) {
        return this.setItem(STORAGE_KEYS.SETTINGS, settings);
    }

    /**
     * Gets the approximate storage usage
     * @returns {Object} - Object with used and total bytes
     */
    getStorageInfo() {
        if (!this.available) return { used: 0, total: MAX_STORAGE_SIZE };

        let used = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                used += getStringSize(localStorage[key]);
            }
        }
        return { used, total: MAX_STORAGE_SIZE };
    }

    /**
     * Internal method to clean up old entries when quota is exceeded
     * @param {string} excludeKey - Key to exclude from cleanup
     * @private
     */
    _cleanupOldEntries(excludeKey) {
        const chats = this.getChats();
        if (chats.length > 1) {
            // Keep only the most recent chat
            const recentChats = chats.slice(0, 1);
            this.setItem(STORAGE_KEYS.CHATS, recentChats);
            console.warn('Storage quota exceeded. Old chat history was cleared.');
        }
    }
}

// Export singleton instance
export const storageService = new StorageService();
export default StorageService;
