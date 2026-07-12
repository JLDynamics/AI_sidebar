/**
 * Input Component
 * Handles the chat input area and file upload
 */

import { getStore, StoreEvents } from '../store/store.js';
import { processFile, getFileIcon } from '../services/FileService.js';
import { validateMessage } from '../utils/validators.js';

/**
 * Input Component class
 */
class InputComponent {
    constructor(inputContainer, chatInput, sendBtn, fileInput, uploadBtn, previewContainer, dragDropOverlay, onSendMessage) {
        this.inputContainer = inputContainer;
        this.chatInput = chatInput;
        this.sendBtn = sendBtn;
        this.fileInput = fileInput;
        this.uploadBtn = uploadBtn;
        this.previewContainer = previewContainer;
        this.dragDropOverlay = dragDropOverlay;
        this.onSendMessage = onSendMessage;

        this._initialize();
    }

    /**
     * Initializes the component and sets up event listeners
     * @private
     */
    _initialize() {
        // Send button click
        this.sendBtn.addEventListener('click', () => this._handleSend());

        // Enter key to send (Shift+Enter for new line)
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._handleSend();
            }
        });

        // "+" opens the file picker directly (PDF / text / code files).
        this.uploadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (e) => this._handleFileSelection(e));

        // Paste support (files pasted into the input)
        this.chatInput.addEventListener('paste', (e) => this._handlePaste(e));

        // Drag and drop
        this._setupDragAndDrop();

        // Auto-resize textarea + send button visibility
        this.chatInput.addEventListener('input', () => {
            this._autoResizeInput();
            this._updateSendVisibility();
        });

        // Subscribe to attachment changes
        const store = getStore();
        store.subscribe(StoreEvents.ATTACHMENT_CHANGED, () => {
            this._renderPreview();
            this._updateSendVisibility();
        });

        this._updateSendVisibility();
    }

    /**
     * Handles sending a message
     * @private
     */
    async _handleSend() {
        const text = this.chatInput.value.trim();
        const store = getStore();
        const attachment = store.getAttachment();

        if (!text && !attachment) return;

        // Validate message
        if (text) {
            const validation = validateMessage(text);
            if (!validation.isValid) {
                console.error(validation.error);
                return;
            }
        }

        // Clear input
        this.chatInput.value = '';
        this._autoResizeInput();

        // Clear attachment
        store.setAttachment(null);
        this._updateSendVisibility();

        // Trigger send callback
        if (this.onSendMessage) {
            await this.onSendMessage(text, attachment);
        }
    }

    /**
     * Handles file selection from file input
     * @param {Event} event - The file input change event
     * @private
     */
    async _handleFileSelection(event) {
        const file = event.target.files[0];
        if (!file) return;

        await this._processFile(file);

        // Reset input so same file can be selected again
        this.fileInput.value = '';
    }

    /**
     * Handles paste events for files
     * @param {ClipboardEvent} event - The paste event
     * @private
     */
    async _handlePaste(event) {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                await this._processFile(file);
            }
        }
    }

    /**
     * Processes a file for attachment
     * @param {File} file - The file to process
     * @private
     */
    async _processFile(file) {
        const processingId = 'file-processing-' + Date.now();
        const store = getStore();

        // Show processing indicator
        store.addMessage('System', `Processing file: ${file.name}...`, processingId);

        try {
            const attachment = await processFile(file, window.pdfjsLib);
            store.setAttachment(attachment);
        } catch (e) {
            console.error('Failed to process file:', e);
            store.addMessage('System', `Failed to process file "${file.name}": ${e.message}`, 'error-' + Date.now());
        }
    }

    /**
     * Sets up drag and drop functionality
     * @private
     */
    _setupDragAndDrop() {
        const events = ['dragenter', 'dragover', 'dragleave', 'drop'];

        events.forEach(eventName => {
            this.inputContainer.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
            document.body.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        this.inputContainer.addEventListener('dragenter', () => this._highlight(), false);
        this.inputContainer.addEventListener('dragover', () => this._highlight(), false);
        this.inputContainer.addEventListener('dragleave', () => this._unhighlight(), false);
        this.inputContainer.addEventListener('drop', (e) => this._handleDrop(e), false);
    }

    /**
     * Highlights the drop zone
     * @private
     */
    _highlight() {
        this.inputContainer.classList.add('drag-over');
        this.dragDropOverlay.classList.add('active');
    }

    /**
     * Unhighlights the drop zone
     * @private
     */
    _unhighlight() {
        this.inputContainer.classList.remove('drag-over');
        this.dragDropOverlay.classList.remove('active');
    }

    /**
     * Handles file drop
     * @param {DragEvent} event - The drop event
     * @private
     */
    async _handleDrop(event) {
        this._unhighlight();
        const dt = event.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            await this._processFile(files[0]);
        }
    }

    /**
     * Shows the send button only when there is text or an attachment
     * @private
     */
    _updateSendVisibility() {
        const hasContent = this.chatInput.value.trim().length > 0 || !!getStore().getAttachment();
        this.sendBtn.classList.toggle('visible', hasContent);
    }

    /**
     * Auto-resizes the textarea based on content
     * @private
     */
    _autoResizeInput() {
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = (this.chatInput.scrollHeight) + 'px';
        if (this.chatInput.value === '') {
            this.chatInput.style.height = 'auto';
        }
    }

    /**
     * Renders the file preview
     * @private
     */
    _renderPreview() {
        const store = getStore();
        const attachment = store.getAttachment();

        if (!attachment) {
            this.previewContainer.style.display = 'none';
            this.previewContainer.innerHTML = '';
            return;
        }

        this.previewContainer.style.display = 'flex';
        this.previewContainer.innerHTML = '';

        const item = document.createElement('div');
        item.className = 'preview-item';

        const icon = document.createElement('div');
        icon.className = 'file-icon';
        icon.textContent = getFileIcon(attachment.name);
        item.appendChild(icon);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'preview-remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove attachment';
        removeBtn.setAttribute('aria-label', 'Remove attachment');
        removeBtn.onclick = () => {
            store.setAttachment(null);
        };

        item.appendChild(removeBtn);
        this.previewContainer.appendChild(item);
    }

    /**
     * Sets the loading state of the send button
     * @param {boolean} isLoading - Whether the button should show loading state
     */
    setLoadingState(isLoading) {
        if (isLoading) {
            this.sendBtn.classList.add('loading');
            this.sendBtn.disabled = true;
            this.sendBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.2"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10">
                        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                    </path>
                </svg>
            `;
        } else {
            this.sendBtn.classList.remove('loading');
            this.sendBtn.disabled = false;
            this.sendBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
            `;
            this._updateSendVisibility();
        }
    }

    /**
     * Focuses the chat input
     */
    focus() {
        this.chatInput.focus();
    }

    /**
     * Clears the chat input
     */
    clear() {
        this.chatInput.value = '';
        this._autoResizeInput();
        this._updateSendVisibility();
    }

    /**
     * Sets the chat input value (used by "edit message")
     * @param {string} text - The text to place in the input
     */
    setValue(text) {
        this.chatInput.value = text;
        this._autoResizeInput();
        this._updateSendVisibility();
        this.focus();
    }

    /**
     * Gets the current input value
     * @returns {string} - The input value
     */
    getValue() {
        return this.chatInput.value.trim();
    }
}

export default InputComponent;
