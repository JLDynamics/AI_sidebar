/**
 * AI Sidebar Extension - Main Application Entry Point
 * Initializes the store, components, and wires everything together
 */

import MessageComponent from './components/MessageComponent.js';
import HistoryComponent from './components/HistoryComponent.js';
import InputComponent from './components/InputComponent.js';
import ModelPickerComponent from './components/ModelPickerComponent.js';
import { getStore, StoreEvents } from './store/store.js';
import { validateConfig, ErrorTypes } from './utils/validators.js';
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
        const historyOverlay = document.getElementById('historyOverlay');
        const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
        const historyCloseBtn = document.getElementById('historyCloseBtn');
        const newChatBtn = document.getElementById('newChatBtn');
        const factCheckBtn = document.getElementById('factCheckBtn');

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
            factCheckBtn,
            historyOverlay,
            chatContainer
        };

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

        // Fact-check button
        if (this.elements.factCheckBtn) {
            this.elements.factCheckBtn.addEventListener('click', () => {
                this._handleFactCheck();
            });
        }

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

        // When a session is deleted, drop its remembered pages on the bridge.
        this.store.subscribe(StoreEvents.SESSION_DELETED, (_state, chatId) => {
            if (!chatId) return;
            chrome.runtime.sendMessage({ type: 'FORGET_SESSION', sessionId: chatId })
                .catch(() => { /* bridge may be down; age-based prune covers it */ });
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
     * Fact-checks the current page, or the claim typed in the input, with
     * cited sources. Runs through the agent's web-search tools (bridge).
     * @private
     */
    async _handleFactCheck() {
        const claim = this.components.input.getValue().trim();
        const label = claim ? `Fact-check: ${claim}` : 'Fact-check this page';

        // Show the request as a user message
        this.store.addMessage('User', label);
        const chat = this.store.getCurrentChat();
        this.components.message.appendMessage('User', label, null, null, null, {
            timestamp: Date.now(),
            index: chat ? chat.messages.length - 1 : undefined
        });
        if (claim) this.components.input.clear();

        this.components.input.setLoadingState(true);
        try {
            await withRetry(() => this._sendToAI(claim, null, 'factcheck'), 2, 1000);
        } catch (err) {
            const retry = () => this._sendToAI(claim, null, 'factcheck');
            if (err.message?.includes('401') || err.message?.includes('403')) {
                this._displayError('Authentication failed. Check the API key (config.js or bridge/.env).', ErrorTypes.AUTH);
            } else if (err.message?.includes('429')) {
                this._displayError('Rate limit exceeded. Please wait a moment before trying again.', ErrorTypes.API, retry);
            } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
                this._displayError('Network error. Fact-checking needs the bridge server running.', ErrorTypes.NETWORK, retry);
            } else {
                this._displayError(err.message || 'Fact-check failed.', ErrorTypes.API, retry);
            }
        } finally {
            this.components.input.setLoadingState(false);
        }
    }

    /**
     * Sends a message to the AI via the background service worker
     * @param {string} text - The message text
     * @param {Object} attachment - Optional attachment
     * @param {string} mode - Optional mode ('factcheck')
     * @returns {Promise<string>} - The AI response
     * @private
     */
    async _sendToAI(text, attachment, mode = null) {
        const currentChat = this.store.getCurrentChat();
        if (!currentChat) {
            throw new Error('No active chat found');
        }

        // Get page metadata + readable content from the active tab
        const metadata = await getActivePageContent();

        // Record this page in the session's memory, then gather the OTHER pages
        // viewed this session. They're sent to the bridge, which writes them to
        // files the agent greps on demand (accurate + token-efficient).
        this.store.upsertPage(metadata);
        const sessionPages = this.store.getSessionPages(metadata.url)
            .map(p => ({ url: p.url, title: p.title, markdown: p.markdown }));

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
                attachment: attachment,
                mode: mode,
                sessionId: currentChat.id,
                sessionPages: sessionPages
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
