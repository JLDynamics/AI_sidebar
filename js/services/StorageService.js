/**
 * Storage Service
 * Wraps localStorage with error handling and serialization.
 *
 * Storage layout (per-session keys, NOT one big blob):
 *   ai_sidebar_chat_index         -> [{ id, title, lastUpdated }, ...]  (lightweight list, newest first)
 *   ai_sidebar_chat_<id>_msgs     -> [ ...messages ]   (small, changes on every message)
 *   ai_sidebar_chat_<id>_pages    -> [ ...pages ]       (heavy, changes only when a new page is visited)
 *
 * Why split? Saving one message only rewrites that one session's small
 * messages key instead of re-serializing every chat's messages AND pages.
 * The heavy page content is left untouched unless it actually changed.
 */

const STORAGE_KEYS = {
    SETTINGS: 'sidebar_settings',
    CHAT_INDEX: 'ai_sidebar_chat_index',
    // Old single-blob key from previous versions. Migrated to per-session keys
    // the first time getChats() runs, then removed.
    LEGACY_CHATS: 'ai_sidebar_chats'
};

const CHAT_PREFIX = 'ai_sidebar_chat_';
const msgsKey = (id) => `${CHAT_PREFIX}${id}_msgs`;
const pagesKey = (id) => `${CHAT_PREFIX}${id}_pages`;

const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit (browser cap is ~5-10MB)

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
            return;
        }
        this._cleanupLegacyData();
    }

    /**
     * Removes obsolete storage keys from previous versions.
     * @private
     */
    _cleanupLegacyData() {
        try {
            if (localStorage.getItem('gemini_chats')) {
                localStorage.removeItem('gemini_chats');
                console.log('Removed obsolete legacy chat data.');
            }
        } catch (e) {
            console.error('Failed to clean up legacy data:', e);
        }
    }

    // --- Low-level helpers --------------------------------------------------

    /**
     * Reads and parses a JSON value for a key.
     * @param {string} key
     * @returns {*} parsed value or null
     * @private
     */
    _read(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            console.error(`Failed to read "${key}" from localStorage:`, e);
            return null;
        }
    }

    /**
     * Writes a raw string for a key, with a size guard and quota handling.
     * On QuotaExceededError it evicts the oldest session(s) and retries.
     * @param {string} key
     * @param {string} serialized
     * @returns {boolean} true if written
     * @private
     */
    _write(key, serialized) {
        if (!this.available) return false;

        const size = getStringSize(serialized);
        if (size > MAX_STORAGE_SIZE) {
            console.error(`Refusing to store "${key}": ${size} bytes exceeds ${MAX_STORAGE_SIZE}.`);
            return false;
        }

        try {
            localStorage.setItem(key, serialized);
            return true;
        } catch (e) {
            if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
                // Free space by dropping the oldest sessions, then retry.
                while (this._evictOldest()) {
                    try {
                        localStorage.setItem(key, serialized);
                        return true;
                    } catch (retryError) {
                        if (!(retryError && (retryError.name === 'QuotaExceededError' || retryError.code === 22))) {
                            console.error(`Failed to write "${key}" after eviction:`, retryError);
                            return false;
                        }
                        // still full -> loop and evict another
                    }
                }
                console.error(`Storage full and nothing left to evict; could not write "${key}".`);
                return false;
            }
            console.error(`Failed to write "${key}" to localStorage:`, e);
            return false;
        }
    }

    /**
     * Removes a key.
     * @param {string} key
     * @private
     */
    _remove(key) {
        if (!this.available) return;
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error(`Failed to remove "${key}" from localStorage:`, e);
        }
    }

    /**
     * Evicts the single oldest session (by lastUpdated) to free space.
     * Never removes the last remaining session.
     * @returns {boolean} true if a session was evicted
     * @private
     */
    _evictOldest() {
        const index = this._read(STORAGE_KEYS.CHAT_INDEX) || [];
        if (index.length <= 1) return false;

        let oldest = index[0];
        for (const entry of index) {
            if ((entry.lastUpdated || 0) < (oldest.lastUpdated || 0)) oldest = entry;
        }

        this._remove(msgsKey(oldest.id));
        this._remove(pagesKey(oldest.id));

        const trimmed = index.filter(e => e.id !== oldest.id);
        try {
            localStorage.setItem(STORAGE_KEYS.CHAT_INDEX, JSON.stringify(trimmed));
        } catch (e) {
            console.error('Failed to update index during eviction:', e);
        }
        console.warn(`Storage quota exceeded. Evicted oldest session: "${oldest.title || oldest.id}".`);
        return true;
    }

    // --- Migration ----------------------------------------------------------

    /**
     * Migrates old single-blob chat data ("ai_sidebar_chats") into the new
     * per-session keys. Runs once; no-op afterwards.
     * @private
     */
    _migrateLegacyChats() {
        if (!this.available) return;
        const hasIndex = localStorage.getItem(STORAGE_KEYS.CHAT_INDEX) !== null;
        const legacy = localStorage.getItem(STORAGE_KEYS.LEGACY_CHATS);
        if (hasIndex || !legacy) return;

        try {
            const chats = JSON.parse(legacy) || [];
            this.saveChats(chats);
            localStorage.removeItem(STORAGE_KEYS.LEGACY_CHATS);
            console.log(`Migrated ${chats.length} chat(s) to per-session storage.`);
        } catch (e) {
            console.error('Failed to migrate legacy chats:', e);
        }
    }

    // --- Chat persistence (public API used by ChatStore) --------------------

    /**
     * Loads all chats, reconstructing full chat objects from the index and the
     * per-session message/page keys. Runs a one-time migration if needed.
     * @returns {Array} - Array of chat objects { id, title, lastUpdated, messages, pages }
     */
    getChats() {
        if (!this.available) return [];
        this._migrateLegacyChats();

        const index = this._read(STORAGE_KEYS.CHAT_INDEX) || [];
        return index.map(meta => ({
            id: meta.id,
            title: meta.title || 'New Chat',
            lastUpdated: meta.lastUpdated || 0,
            messages: this._read(msgsKey(meta.id)) || [],
            pages: this._read(pagesKey(meta.id)) || []
        }));
    }

    /**
     * Saves the lightweight index (id, title, lastUpdated, order). Cheap.
     * @param {Array} chats - The full chats array (order preserved)
     * @returns {boolean}
     */
    saveIndex(chats) {
        const index = (chats || []).map(c => ({
            id: c.id,
            title: c.title,
            lastUpdated: c.lastUpdated || 0
        }));
        return this._write(STORAGE_KEYS.CHAT_INDEX, JSON.stringify(index));
    }

    /**
     * Saves ONE chat's messages (leaves its pages untouched).
     * @param {Object} chat
     * @returns {boolean}
     */
    saveChatMessages(chat) {
        if (!chat || !chat.id) return false;
        return this._write(msgsKey(chat.id), JSON.stringify(chat.messages || []));
    }

    /**
     * Saves ONE chat's pages (leaves its messages untouched).
     * @param {Object} chat
     * @returns {boolean}
     */
    saveChatPages(chat) {
        if (!chat || !chat.id) return false;
        return this._write(pagesKey(chat.id), JSON.stringify(chat.pages || []));
    }

    /**
     * Saves every chat (index + each session's messages and pages).
     * Used for migration and bulk saves; individual changes should use the
     * granular methods above so they don't rewrite everything.
     * @param {Array} chats
     * @returns {boolean}
     */
    saveChats(chats) {
        let ok = this.saveIndex(chats);
        (chats || []).forEach(c => {
            ok = this.saveChatMessages(c) && ok;
            ok = this.saveChatPages(c) && ok;
        });
        return ok;
    }

    /**
     * Removes one session's messages and pages keys. The caller is responsible
     * for updating the index (e.g. via saveIndex).
     * @param {string} chatId
     */
    removeChat(chatId) {
        if (!chatId) return;
        this._remove(msgsKey(chatId));
        this._remove(pagesKey(chatId));
    }

    /**
     * Removes ALL chat data (every session's keys and the index).
     * Settings are left intact.
     */
    clearAllChats() {
        if (!this.available) return;
        try {
            Object.keys(localStorage)
                .filter(k => k === STORAGE_KEYS.CHAT_INDEX || k.startsWith(CHAT_PREFIX))
                .forEach(k => this._remove(k));
        } catch (e) {
            console.error('Failed to clear chat data:', e);
        }
    }

    // --- Settings -----------------------------------------------------------

    /**
     * Gets settings
     * @returns {Object} - Settings object
     */
    getSettings() {
        return this._read(STORAGE_KEYS.SETTINGS) || {};
    }

    /**
     * Saves settings
     * @param {Object} settings - Settings object
     * @returns {boolean} - True if successful
     */
    saveSettings(settings) {
        return this._write(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }

    // --- Misc ---------------------------------------------------------------

    /**
     * Removes any key from localStorage (generic helper).
     * @param {string} key
     */
    removeItem(key) {
        this._remove(key);
    }

    /**
     * Gets the approximate storage usage across all keys.
     * @returns {Object} - { used, total } in bytes
     */
    getStorageInfo() {
        if (!this.available) return { used: 0, total: MAX_STORAGE_SIZE };

        let used = 0;
        for (const key in localStorage) {
            if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
                used += getStringSize(localStorage[key]);
            }
        }
        return { used, total: MAX_STORAGE_SIZE };
    }
}

// Export singleton instance
export const storageService = new StorageService();
export default StorageService;
