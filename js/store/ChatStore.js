/**
 * Chat Store
 * Centralized state management for the AI Sidebar application
 */

import { storageService } from '../services/StorageService.js';
import { generateId, truncateText } from '../utils/helpers.js';

/**
 * Event types for store subscriptions
 */
export const StoreEvents = {
    CHATS_CHANGED: 'chats_changed',
    CURRENT_CHAT_CHANGED: 'current_chat_changed',
    HISTORY_TOGGLED: 'history_toggled',
    ATTACHMENT_CHANGED: 'attachment_changed',
    MESSAGE_ADDED: 'message_added'
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
            currentAttachment: null,
            pendingAction: null
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
        this._persist();

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

        this._persist();
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
    addMessage(role, content, attachment = null) {
        const currentChat = this.getCurrentChat();
        if (!currentChat) {
            throw new Error('No active chat found');
        }

        let storedContent = content;
        if (attachment) {
            if (attachment.type === 'text') {
                storedContent += `\n\n[File: ${attachment.name}]\n${attachment.content}`;
            } else {
                // Image: For now, we won't store large base64 in localStorage history
                storedContent += `\n\n[Uploaded Image: ${attachment.name}]`;
            }
        }

        const message = {
            role,
            content: storedContent,
            timestamp: Date.now()
        };

        currentChat.messages.push(message);
        currentChat.lastUpdated = Date.now();

        // Update title if this is the first user message
        if (role === 'User' && currentChat.title === 'New Chat') {
            currentChat.title = truncateText(content || "File Upload", 30);
        }

        this._persist();
        this._notify(StoreEvents.MESSAGE_ADDED, message);
        this._notify(StoreEvents.CHATS_CHANGED);

        return message;
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
            this._persist();
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
     * Sets a pending action
     * @param {Object|null} action - The pending action or null
     */
    setPendingAction(action) {
        this.state.pendingAction = action;
    }

    /**
     * Gets the pending action
     * @returns {Object|null} - The pending action or null
     */
    getPendingAction() {
        return this.state.pendingAction;
    }

    /**
     * Gets messages for API context (last N messages)
     * @param {number} limit - Maximum number of messages to return
     * @returns {Array} - Array of message objects for API
     */
    getMessagesForContext(limit = 10) {
        const currentChat = this.getCurrentChat();
        if (!currentChat) return [];

        return currentChat.messages.slice(-limit).map(m => ({
            role: m.role === 'User' ? 'user' : 'assistant',
            content: m.content
        }));
    }

    /**
     * Clears all chats (with confirmation handled by caller)
     */
    clearAllChats() {
        this.state.chats = [];
        this.createChat();
    }

    /**
     * Persists the current state to localStorage
     * @private
     */
    _persist() {
        storageService.saveChats(this.state.chats);
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
