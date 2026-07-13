/**
 * Chat Store
 * Centralized state management for the AI Sidebar application
 */

import { storageService } from '../services/StorageService.js';
import { generateId, truncateText, stripAttachmentContent } from '../utils/helpers.js';

// Note: session page memory now lives on the bridge (on-disk files it greps),
// not in the browser. localStorage here holds only lightweight chat messages,
// so the 5MB quota is no longer a concern. See StorageService for the layout.

/**
 * Event types for store subscriptions
 */
export const StoreEvents = {
    CHATS_CHANGED: 'chats_changed',
    CURRENT_CHAT_CHANGED: 'current_chat_changed',
    HISTORY_TOGGLED: 'history_toggled',
    ATTACHMENT_CHANGED: 'attachment_changed',
    MESSAGE_ADDED: 'message_added',
    SESSION_DELETED: 'session_deleted'
};

/**
 * Chat Store class for managing application state
 */
class ChatStore {
    constructor() {
        // State
        this.state = {
            chats: [],
            currentChatId: null,
            isHistoryOpen: false,
            currentAttachment: null
        };

        // Subscribers
        this.subscribers = new Map();

        // Initialize
        this._initialize();
    }

    /**
     * Initializes the store with persisted data
     * @private
     */
    _initialize() {
        this.state.chats = storageService.getChats();
        if (this.state.chats.length === 0) {
            this.createChat();
        } else {
            this.state.currentChatId = this.state.chats[0].id;
        }
    }

    /**
     * Gets the current state
     * @returns {Object} - Current state object
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Gets the current chat object
     * @returns {Object|null} - Current chat object or null
     */
    getCurrentChat() {
        return this.state.chats.find(c => c.id === this.state.currentChatId) || null;
    }

    /**
     * Updates state and notifies subscribers
     * @param {Object} newState - Partial state to merge
     * @param {string} eventType - Event type for subscribers
     * @private
     */
    _setState(newState, eventType = null) {
        this.state = { ...this.state, ...newState };
        if (eventType) {
            this._notify(eventType);
        }
    }

    /**
     * Notifies subscribers of an event
     * @param {string} eventType - The event type
     * @param {*} data - Additional data to pass to subscribers
     * @private
     */
    _notify(eventType, data = null) {
        const subscribers = this.subscribers.get(eventType) || [];
        subscribers.forEach(callback => {
            try {
                callback(this.state, data);
            } catch (e) {
                console.error(`Error in subscriber for ${eventType}:`, e);
            }
        });
    }

    /**
     * Subscribes to store events
     * @param {string} eventType - The event type to subscribe to
     * @param {Function} callback - Callback function
     * @returns {Function} - Unsubscribe function
     */
    subscribe(eventType, callback) {
        if (!this.subscribers.has(eventType)) {
            this.subscribers.set(eventType, []);
        }
        this.subscribers.get(eventType).push(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(eventType);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Creates a new chat
     * @returns {Object} - The newly created chat
     */
    createChat() {
        const newChat = {
            id: generateId(),
            title: 'New Chat',
            messages: [],
            lastUpdated: Date.now()
        };

        this.state.chats.unshift(newChat);
        this.state.currentChatId = newChat.id;
        this._persistChat(newChat);

        this._notify(StoreEvents.CHATS_CHANGED);
        this._notify(StoreEvents.CURRENT_CHAT_CHANGED);

        return newChat;
    }

    /**
     * Deletes a chat
     * @param {string} chatId - The ID of the chat to delete
     */
    deleteChat(chatId) {
        this.state.chats = this.state.chats.filter(c => c.id !== chatId);

        if (this.state.chats.length === 0) {
            this.createChat();
        } else if (this.state.currentChatId === chatId) {
            this.state.currentChatId = this.state.chats[0].id;
        }

        storageService.removeChat(chatId);
        this._persistIndex();
        // Let listeners drop this session's server-side memory files.
        this._notify(StoreEvents.SESSION_DELETED, chatId);
        this._notify(StoreEvents.CHATS_CHANGED);
        this._notify(StoreEvents.CURRENT_CHAT_CHANGED);
    }

    /**
     * Switches to a different chat
     * @param {string} chatId - The ID of the chat to switch to
     */
    switchChat(chatId) {
        const chat = this.state.chats.find(c => c.id === chatId);
        if (!chat) {
            console.warn(`Chat ${chatId} not found`);
            return;
        }

        this.state.currentChatId = chatId;
        this._notify(StoreEvents.CURRENT_CHAT_CHANGED);
        this._notify(StoreEvents.CHATS_CHANGED); // For active state update
    }

    /**
     * Adds a message to the current chat
     * @param {string} role - The role (User, AI, System)
     * @param {string} content - The message content
     * @param {Object} attachment - Optional attachment object
     * @returns {Object} - The added message object
     */
    addMessage(role, content, attachment = null, meta = null) {
        const currentChat = this.getCurrentChat();
        if (!currentChat) {
            throw new Error('No active chat found');
        }

        let storedContent = content;
        if (attachment) {
            storedContent += `\n\n[File: ${attachment.name}]\n${attachment.content}`;
        }

        const message = {
            role,
            content: storedContent,
            timestamp: Date.now()
        };
        if (meta) message.meta = meta;

        currentChat.messages.push(message);
        currentChat.lastUpdated = Date.now();

        // Update title if this is the first user message
        if (role === 'User' && currentChat.title === 'New Chat') {
            currentChat.title = truncateText(content || "File Upload", 30);
        }

        this._persistChat(currentChat);
        this._notify(StoreEvents.MESSAGE_ADDED, message);
        this._notify(StoreEvents.CHATS_CHANGED);

        return message;
    }

    /**
     * Sets (or clears) the thumbs rating on a message
     * @param {number} index - The message index in the current chat
     * @param {string|null} rating - 'up', 'down', or null to clear
     */
    setMessageRating(index, rating) {
        const currentChat = this.getCurrentChat();
        if (!currentChat || !currentChat.messages[index]) return;

        const message = currentChat.messages[index];
        message.meta = message.meta || {};
        message.meta.rating = rating;
        // Only this chat's messages changed (not its pages, title, or order).
        storageService.saveChatMessages(currentChat);
    }

    /**
     * Removes all messages from the given index onward (inclusive).
     * Used by "edit" and "restart conversation from here".
     * @param {number} fromIndex - Index of the first message to remove
     */
    truncateMessages(fromIndex) {
        const currentChat = this.getCurrentChat();
        if (!currentChat) return;

        currentChat.messages.splice(fromIndex);
        currentChat.lastUpdated = Date.now();

        this._persistChat(currentChat);
        this._notify(StoreEvents.CURRENT_CHAT_CHANGED);
        this._notify(StoreEvents.CHATS_CHANGED);
    }

    /**
     * Updates the title of a chat
     * @param {string} chatId - The ID of the chat
     * @param {string} title - The new title
     */
    updateChatTitle(chatId, title) {
        const chat = this.state.chats.find(c => c.id === chatId);
        if (chat) {
            chat.title = title;
            // Title lives in the index, so only the index needs rewriting.
            this._persistIndex();
            this._notify(StoreEvents.CHATS_CHANGED);
        }
    }

    /**
     * Toggles the history drawer open/closed state
     */
    toggleHistory() {
        this.state.isHistoryOpen = !this.state.isHistoryOpen;
        this._notify(StoreEvents.HISTORY_TOGGLED);
    }

    /**
     * Sets the history drawer state
     * @param {boolean} isOpen - Whether the drawer should be open
     */
    setHistoryOpen(isOpen) {
        if (this.state.isHistoryOpen !== isOpen) {
            this.state.isHistoryOpen = isOpen;
            this._notify(StoreEvents.HISTORY_TOGGLED);
        }
    }

    /**
     * Sets the current attachment
     * @param {Object|null} attachment - The attachment object or null
     */
    setAttachment(attachment) {
        this.state.currentAttachment = attachment;
        this._notify(StoreEvents.ATTACHMENT_CHANGED);
    }

    /**
     * Gets the current attachment
     * @returns {Object|null} - The current attachment or null
     */
    getAttachment() {
        return this.state.currentAttachment;
    }

    /**
     * Gets the conversation history to send as context: the FULL conversation
     * (no cap — these chats stay well within model limits) EXCLUDING the current
     * question. The current question is the last message (already added before
     * this runs) and is sent separately as [USER QUESTION], so dropping it here
     * avoids sending it twice.
     * @returns {Array} - Array of message objects for the API
     */
    getMessagesForContext() {
        const currentChat = this.getCurrentChat();
        if (!currentChat) return [];

        // slice(0, -1) drops the last message (the current question).
        // stripAttachmentContent removes any embedded file body so a past
        // attachment isn't re-sent in full on every turn (it lives on the
        // bridge as a file the model reads on demand).
        return currentChat.messages.slice(0, -1).map(m => ({
            role: m.role === 'User' ? 'user' : 'assistant',
            content: stripAttachmentContent(m.content)
        }));
    }

    /**
     * Clears all chats (with confirmation handled by caller)
     */
    clearAllChats() {
        const ids = this.state.chats.map(c => c.id);
        storageService.clearAllChats();
        this.state.chats = [];
        // Tell listeners (and thus the bridge) to forget each session's files,
        // so page/attachment folders aren't orphaned until the age prune.
        ids.forEach(id => this._notify(StoreEvents.SESSION_DELETED, id));
        this.createChat();
    }

    /**
     * Saves one chat's messages plus the index (title/order/lastUpdated).
     * Its heavy pages key is left untouched.
     * @param {Object} chat
     * @private
     */
    _persistChat(chat) {
        if (!chat) return;
        storageService.saveChatMessages(chat);
        this._persistIndex();
    }

    /**
     * Saves the lightweight session index (ids, titles, order, lastUpdated).
     * @private
     */
    _persistIndex() {
        storageService.saveIndex(this.state.chats);
    }

    /**
     * Gets storage information
     * @returns {Object} - Storage usage info
     */
    getStorageInfo() {
        return storageService.getStorageInfo();
    }
}

// Export singleton instance
let storeInstance = null;

export function getStore() {
    if (!storeInstance) {
        storeInstance = new ChatStore();
    }
    return storeInstance;
}

export default ChatStore;
