/**
 * History Component
 * Handles the history drawer and chat list
 */

import { getStore, StoreEvents } from '../store/store.js';

/**
 * History Component class
 */
class HistoryComponent {
    constructor(drawerElement, listElement) {
        this.drawer = drawerElement;
        this.list = listElement;

        // Unsubscribe function for store events
        this.unsubscribe = null;

        this._initialize();
    }

    /**
     * Initializes the component and subscribes to store events
     * @private
     */
    _initialize() {
        const store = getStore();

        this.unsubscribe = store.subscribe(StoreEvents.CHATS_CHANGED, () => {
            this.render();
        });

        // Initial render
        this.render();
    }

    /**
     * Destroys the component and unsubscribes from events
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    /**
     * Renders the history list
     */
    render() {
        const store = getStore();
        const chats = store.getState().chats;
        const currentChatId = store.getState().currentChatId;

        this.list.innerHTML = '';

        chats.forEach(chat => {
            const item = this._createHistoryItem(chat, chat.id === currentChatId);
            this.list.appendChild(item);
        });
    }

    /**
     * Creates a history list item
     * @param {Object} chat - The chat object
     * @param {boolean} isActive - Whether this is the active chat
     * @returns {HTMLElement} - The list item element
     * @private
     */
    _createHistoryItem(chat, isActive) {
        const item = document.createElement('div');
        item.className = `history-item ${isActive ? 'active' : ''}`;
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', `Switch to chat: ${chat.title}`);
        item.onclick = () => this._onChatClick(chat.id);
        item.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._onChatClick(chat.id);
            }
        };

        const titleSpan = document.createElement('span');
        titleSpan.className = 'history-item-title';
        titleSpan.textContent = chat.title;
        item.appendChild(titleSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-chat-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Delete chat';
        deleteBtn.setAttribute('aria-label', 'Delete this chat');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this._onDeleteChat(chat.id);
        };
        item.appendChild(deleteBtn);

        return item;
    }

    /**
     * Handles chat item click
     * @param {string} chatId - The chat ID
     * @private
     */
    _onChatClick(chatId) {
        const store = getStore();
        store.switchChat(chatId);

        // Close drawer on mobile
        if (window.innerWidth < 600 && store.getState().isHistoryOpen) {
            store.toggleHistory();
        }
    }

    /**
     * Handles chat delete
     * @param {string} chatId - The chat ID
     * @private
     */
    _onDeleteChat(chatId) {
        if (confirm('Delete this chat?')) {
            const store = getStore();
            store.deleteChat(chatId);
        }
    }

    /**
     * Updates the open/closed state of the drawer
     * @param {boolean} isOpen - Whether the drawer should be open
     */
    setOpenState(isOpen) {
        if (isOpen) {
            this.drawer.classList.add('open');
        } else {
            this.drawer.classList.remove('open');
        }
    }
}

export default HistoryComponent;
