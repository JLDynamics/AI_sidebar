/**
 * AI Sidebar Extension - Main Application Entry Point
 * Initializes the store, components, and wires everything together
 */

import MessageComponent from './components/MessageComponent.js';
import HistoryComponent from './components/HistoryComponent.js';
import InputComponent from './components/InputComponent.js';
import LightboxComponent from './components/LightboxComponent.js';
import ModelPickerComponent from './components/ModelPickerComponent.js';
import { getStore, StoreEvents } from './store/store.js';
import { validateConfig, isAffirmative, isNegative, ErrorTypes } from './utils/validators.js';
import { withRetry } from './utils/helpers.js';
import { getActivePageContent } from './services/PageService.js';
import { HISTORY_CONTEXT_MESSAGES } from './utils/constants.js';

// PDF.js Worker Configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

/**
 * Application class
 */
class App {
    constructor() {
        this.store = null;
        this.components = {};
        this.initialized = false;
    }

    /**
     * Initializes the application
     */
    async init() {
        if (this.initialized) return;

        try {
            // Validate configuration
            validateConfig(CONFIG);

            // Initialize store
            this.store = getStore();

            // Initialize components
            this._initComponents();

            // Setup event handlers
            this._setupEventHandlers();

            // Setup keyboard shortcuts
            this._setupKeyboardShortcuts();

            this.initialized = true;
            console.log('AI Sidebar initialized successfully');
        } catch (error) {
            console.error('Failed to initialize AI Sidebar:', error);
            this._showInitError(error.message);
        }
    }

    /**
     * Initializes all UI components
     * @private
     */
    _initComponents() {
        // Get DOM elements
        const chatContainer = document.getElementById('chatContainer');
        const historyDrawer = document.getElementById('historyDrawer');
        const historyList = document.getElementById('historyList');
        const inputContainer = document.getElementById('inputContainer');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadBtn');
        const previewContainer = document.getElementById('imagePreviewContainer');
        const dragDropOverlay = document.getElementById('dragDropOverlay');
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightboxImg');
        const lightboxClose = document.querySelector('.lightbox-close');
        const historyOverlay = document.getElementById('historyOverlay');
        const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
        const historyCloseBtn = document.getElementById('historyCloseBtn');
        const newChatBtn = document.getElementById('newChatBtn');

        // Initialize components
        this.components.message = new MessageComponent(chatContainer);
        this.components.message.onUserAction = (action, index, content) =>
            this._handleUserAction(action, index, content);
        this.components.message.onAIRating = (index, rating) =>
            this.store.setMessageRating(index, rating);
        this.components.message.onAIAction = (action, index) =>
            this._handleAIAction(action, index);
        this.components.history = new HistoryComponent(historyDrawer, historyList);
        this.components.input = new InputComponent(
            inputContainer,
            chatInput,
            sendBtn,
            fileInput,
            uploadBtn,
            previewContainer,
            dragDropOverlay,
            (text, attachment) => this._handleSendMessage(text, attachment)
        );
        this.components.lightbox = new LightboxComponent(lightbox, lightboxImg, lightboxClose);

        // Model picker (button in chat box + popup panel)
        const modelBtn = document.getElementById('modelBtn');
        const modelPanel = document.getElementById('modelPanel');
        if (modelBtn && modelPanel) {
            this.components.modelPicker = new ModelPickerComponent(modelBtn, modelPanel, CONFIG);
        }

        // Store button references
        this.elements = {
            toggleHistoryBtn,
            historyCloseBtn,
            newChatBtn,
            historyOverlay,
            chatContainer
        };

        // Setup image click handlers for lightbox
        chatContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('sent-image')) {
                this.components.lightbox.open(e.target.src);
            }
        });

        // Initial render
        this.components.message.renderMessages();
        this._updateHistoryState();
    }

    /**
     * Sets up all event handlers
     * @private
     */
    _setupEventHandlers() {
        // History toggle button
        this.elements.toggleHistoryBtn.addEventListener('click', () => {
            this.store.toggleHistory();
        });

        // History close button
        this.elements.historyCloseBtn.addEventListener('click', () => {
            this.store.toggleHistory();
        });

        // History overlay click
        this.elements.historyOverlay.addEventListener('click', () => {
            this.store.toggleHistory();
        });

        // New chat button
        this.elements.newChatBtn.addEventListener('click', () => {
            this.store.createChat();
            if (window.innerWidth < 600) {
                this.store.setHistoryOpen(false);
            }
        });

        // Subscribe to store events
        this.store.subscribe(StoreEvents.CURRENT_CHAT_CHANGED, () => {
            this.components.message.renderMessages();
            this.components.history.render();
        });

        this.store.subscribe(StoreEvents.HISTORY_TOGGLED, () => {
            this._updateHistoryState();
        });

        this.store.subscribe(StoreEvents.MESSAGE_ADDED, () => {
            this.components.history.render();
        });
    }

    /**
     * Sets up keyboard shortcuts
     * @private
     */
    _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const isTyping = document.activeElement === this.components.input.chatInput;

            // Ctrl/Cmd + Enter: Send message (works even while typing)
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (this.components.input.getValue()) {
                    this.components.input._handleSend();
                }
                return;
            }

            // Don't process other shortcuts if user is typing
            if (isTyping) return;

            // Ctrl/Cmd + K: Focus input
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.components.input.focus();
                return;
            }

            // Ctrl/Cmd + N: New chat
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.store.createChat();
                return;
            }

            // Ctrl/Cmd + H: Toggle history
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                this.store.toggleHistory();
                return;
            }

            // Ctrl/Cmd + L: Clear input
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                this.components.input.clear();
                return;
            }

            // Esc: Close overlays
            if (e.key === 'Escape') {
                if (this.components.lightbox.isOpen()) {
                    this.components.lightbox.close();
                    return;
                }
                if (this.store.getState().isHistoryOpen) {
                    this.store.toggleHistory();
                    return;
                }
            }
        });
    }

    /**
     * Handles sending a message
     * @param {string} text - The message text
     * @param {Object} attachment - Optional attachment
     * @private
     */
    async _handleSendMessage(text, attachment) {
        // Check for pending action interception
        const pendingAction = this.store.getPendingAction();
        if (pendingAction) {
            if (isAffirmative(text)) {
                this.store.setPendingAction(null);
                await this._executePendingAction(pendingAction);
                return;
            } else if (isNegative(text)) {
                this.store.setPendingAction(null);
                this.store.addMessage('User', text);
                setTimeout(() => {
                    this.store.addMessage('AI', "Okay, I won't do that.");
                }, 500);
                return;
            }
        }

        // Add user message to store
        this.store.addMessage('User', text, attachment);

        // Display user message (with attachment and actions row)
        const chat = this.store.getCurrentChat();
        this.components.message.appendMessage('User', text, null, attachment, null, {
            timestamp: Date.now(),
            index: chat ? chat.messages.length - 1 : undefined
        });

        // Set loading state
        this.components.input.setLoadingState(true);

        // Send to AI with retry logic
        try {
            await withRetry(() => this._sendToAI(text, attachment), 2, 1000);
        } catch (err) {
            const retryCallback = () => this._sendToAI(text, attachment);

            if (err.message?.includes('401') || err.message?.includes('403')) {
                this._displayError('Authentication failed. Please check the API key for the selected provider (config.js or bridge/.env).', ErrorTypes.AUTH);
            } else if (err.message?.includes('429')) {
                this._displayError('Rate limit exceeded. Please wait a moment before trying again.', ErrorTypes.API, retryCallback);
            } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
                this._displayError('Network error. Please check your internet connection.', ErrorTypes.NETWORK, retryCallback);
            } else {
                this._displayError(err.message || 'Failed to communicate with AI.', ErrorTypes.API, retryCallback);
            }
        } finally {
            this.components.input.setLoadingState(false);
        }
    }

    /**
     * Sends a message to the AI via the background service worker
     * @param {string} text - The message text
     * @param {Object} attachment - Optional attachment
     * @returns {Promise<string>} - The AI response
     * @private
     */
    async _sendToAI(text, attachment) {
        const currentChat = this.store.getCurrentChat();
        if (!currentChat) {
            throw new Error('No active chat found');
        }

        // Get page metadata + readable content from the active tab
        const metadata = await getActivePageContent();

        // Prepare history for context
        const history = this.store.getMessagesForContext(HISTORY_CONTEXT_MESSAGES);

        // Send to background service worker
        const loadingId = 'loading-' + Date.now();
        this.components.message.appendMessage('System', 'Thinking...', loadingId);

        try {
            const selection = this.components.modelPicker
                ? this.components.modelPicker.getSelection()
                : { providerId: CONFIG.DEFAULT_PROVIDER, model: CONFIG.DEFAULT_MODEL, effort: CONFIG.DEFAULT_EFFORT };

            const response = await chrome.runtime.sendMessage({
                type: 'ASK_AI',
                providerId: selection.providerId,
                model: selection.model,
                effort: selection.effort,
                question: text,
                metadata: metadata,
                history: history,
                attachment: attachment
            });

            if (response.error) {
                throw new Error(response.error);
            }

            const aiResponse = response.answer;
            const meta = response.meta || null;
            this.store.addMessage('AI', aiResponse, null, meta);

            const chatAfterAI = this.store.getCurrentChat();
            this.components.message.appendMessage('AI', aiResponse, null, null, meta, {
                timestamp: Date.now(),
                index: chatAfterAI ? chatAfterAI.messages.length - 1 : undefined
            });

            // Check for pending action in AI response
            this._detectPendingAction(aiResponse);

            return aiResponse;
        } finally {
            this.components.message.removeMessage(loadingId);
        }
    }

    /**
     * Handles actions on user messages (restart / edit)
     * @param {string} action - 'restart' or 'edit'
     * @param {number} index - The message index in the current chat
     * @param {string} content - The message content
     * @private
     */
    async _handleUserAction(action, index, content) {
        if (action === 'edit') {
            // Remove this message and everything after, put text in the input
            this.store.truncateMessages(index);
            this.components.input.setValue(content);
        } else if (action === 'restart') {
            // Remove this message and everything after, then re-send it
            this.store.truncateMessages(index);
            await this._handleSendMessage(content, null);
        }
    }

    /**
     * Handles actions on AI messages ("..." menu)
     * @param {string} action - The action ('regenerate')
     * @param {number} index - The AI message index
     * @private
     */
    async _handleAIAction(action, index) {
        if (action !== 'regenerate' || typeof index !== 'number') return;

        const chat = this.store.getCurrentChat();
        if (!chat) return;

        // Find the user message that triggered this AI response
        for (let i = index - 1; i >= 0; i--) {
            if (chat.messages[i].role === 'User') {
                const content = chat.messages[i].content;
                this.store.truncateMessages(i);
                await this._handleSendMessage(content, null);
                return;
            }
        }
    }

    /**
     * Detects pending action from AI response
     * @param {string} aiText - The AI response text
     * @private
     */
    _detectPendingAction(aiText) {
        const searchRegex = /(?:would you like me to|should i|do you want me to|i can|i can certainly) (?:search|check|look up|find) (?:for )?(.+?)(\?|$|\.|,| with a quick search| if you'd like)/i;
        const match = aiText.match(searchRegex);

        if (match && match[1]) {
            let query = match[1].trim();
            query = query.replace(/ for you$/i, '')
                .replace(/ with a quick search$/i, '')
                .replace(/ if you'd like$/i, '')
                .replace(/ that information$/i, '');

            this.store.setPendingAction({
                type: 'search_web',
                params: { query: query }
            });
        } else {
            this.store.setPendingAction(null);
        }
    }

    /**
     * Executes a pending action
     * @param {Object} action - The action to execute
     * @private
     */
    async _executePendingAction(action) {
        if (action.type === 'search_web') {
            let query = action.params.query;

            // Handle vague queries
            const vagueTerms = ['that information', 'that', 'it', 'the info', 'this'];
            if (vagueTerms.includes(query.toLowerCase()) || query.length < 3) {
                const currentChat = this.store.getCurrentChat();
                if (currentChat && currentChat.messages.length > 0) {
                    const lastUserMsg = [...currentChat.messages].reverse().find(m => m.role === 'User');
                    if (lastUserMsg) {
                        query = lastUserMsg.content;
                    }
                }
            }

            this.components.message.appendMessage('User', `Yes, search for "${query}"`);
            await this._sendToAI(`Search for ${query}`, null);
        }
    }

    /**
     * Displays an error message
     * @param {string} message - The error message
     * @param {string} type - The error type
     * @param {Function} retryCallback - Optional retry callback
     * @private
     */
    _displayError(message, type = 'Error', retryCallback = null) {
        const errorId = 'error-' + Date.now();
        const errorContent = `**${type}**\n\n${message}`;

        this.components.message.appendMessage('System', errorContent, errorId);

        if (retryCallback) {
            setTimeout(() => {
                const errorElement = document.getElementById(errorId);
                if (errorElement) {
                    const retryBtn = document.createElement('button');
                    retryBtn.textContent = '🔄 Retry';
                    retryBtn.className = 'retry-btn';
                    retryBtn.style.cssText = 'margin-top: 8px; padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;';
                    retryBtn.onclick = async () => {
                        errorElement.remove();
                        try {
                            await retryCallback();
                        } catch (err) {
                            this._displayError(err.message || 'Retry failed', type);
                        }
                    };
                    errorElement.appendChild(retryBtn);
                }
            }, 100);
        }

        console.error(`[${type}] ${message}`);
    }

    /**
     * Updates the history drawer open/closed state
     * @private
     */
    _updateHistoryState() {
        const isOpen = this.store.getState().isHistoryOpen;
        this.components.history.setOpenState(isOpen);

        if (isOpen) {
            this.elements.historyOverlay.classList.add('open');
        } else {
            this.elements.historyOverlay.classList.remove('open');
        }
    }

    /**
     * Shows initialization error
     * @param {string} message - The error message
     * @private
     */
    _showInitError(message) {
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
            chatContainer.innerHTML = `
                <div style="padding: 20px; color: #ef4444;">
                    <h3>Initialization Error</h3>
                    <p>${message}</p>
                    <p>Please check your config.js file and reload the extension.</p>
                </div>
            `;
        }
    }
}

// Initialize app when DOM is ready
let app = null;

document.addEventListener('DOMContentLoaded', async () => {
    app = new App();
    await app.init();
});

// Export for debugging
window.AIApp = app;
