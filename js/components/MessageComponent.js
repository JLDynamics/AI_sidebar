/**
 * Message Component
 * Handles rendering of chat messages
 */

import { sanitizeHTML } from '../utils/sanitizer.js';
import { getStore, StoreEvents } from '../store/store.js';

// Global copy function for code blocks
window.copyToClipboard = function (btn) {
    const wrapper = btn.closest('.code-wrapper');
    const pre = wrapper.querySelector('pre');
    const code = pre.innerText;

    navigator.clipboard.writeText(code).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copied!
        `;
        btn.classList.add('copied');

        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
};

/**
 * Message Component class
 */
class MessageComponent {
    constructor(chatContainer, ttsService) {
        this.chatContainer = chatContainer;
        this.ttsService = ttsService;
        this.ttsButtons = new Map(); // Track TTS buttons by message content
    }

    /**
     * Renders all messages in the current chat
     */
    renderMessages() {
        const store = getStore();
        const currentChat = store.getCurrentChat();
        if (!currentChat) return;

        this.chatContainer.innerHTML = '';

        if (currentChat.messages.length === 0) {
            this._renderWelcomeMessage();
            return;
        }

        currentChat.messages.forEach(msg => {
            this.appendMessage(msg.role, msg.content);
        });

        this.scrollToBottom();
    }

    /**
     * Renders the welcome message
     * @private
     */
    _renderWelcomeMessage() {
        this.chatContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">✨</div>
                <h2>How can AI Sidebar help you today?</h2>
            </div>
        `;
    }

    /**
     * Appends a message to the chat container
     * @param {string} role - The role (User, AI, System)
     * @param {string} content - The message content
     * @param {string} id - Optional element ID
     * @param {Object} attachment - Optional attachment object
     */
    appendMessage(role, content, id = null, attachment = null) {
        // Remove welcome message if present
        const welcome = this.chatContainer.querySelector('.welcome-message');
        if (welcome) welcome.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role.toLowerCase()}`;
        if (id) messageDiv.id = id;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';

        // Display Attachment if present (User only usually)
        if (attachment && attachment.type === 'image') {
            const img = document.createElement('img');
            img.src = attachment.content;
            img.className = 'sent-image';
            img.alt = attachment.name;
            bubble.appendChild(img);
        }

        // Display Text Content
        if (content) {
            if (role === 'System') {
                bubble.textContent = content;
                bubble.style.backgroundColor = 'transparent';
                bubble.style.color = '#888';
                bubble.style.fontSize = '12px';
                bubble.style.padding = '4px 12px';
            } else {
                // Parse Markdown
                let parsedContent = sanitizeHTML(marked.parse(content));

                // Code Block Injection for Copy Button
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = parsedContent;

                const preTags = tempDiv.querySelectorAll('pre');
                preTags.forEach(pre => {
                    const codeContent = pre.innerText;

                    // Create Wrapper
                    const wrapper = document.createElement('div');
                    wrapper.className = 'code-wrapper';

                    // Create Header
                    const header = document.createElement('div');
                    header.className = 'code-header';
                    header.innerHTML = `
                        <span class="code-lang">Code</span>
                        <button class="copy-btn" onclick="copyToClipboard(this)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copy
                        </button>
                    `;

                    const newPre = pre.cloneNode(true);
                    newPre.dataset.code = codeContent;

                    wrapper.appendChild(header);
                    wrapper.appendChild(newPre);
                    pre.replaceWith(wrapper);
                });

                const textDiv = document.createElement('div');
                textDiv.innerHTML = tempDiv.innerHTML;
                bubble.appendChild(textDiv);
            }
        }

        messageDiv.appendChild(bubble);

        // Add Actions for AI messages
        if (role === 'AI') {
            this._addMessageActions(messageDiv, content);
        }

        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    /**
     * Adds action buttons (Copy, TTS) to AI messages
     * @param {HTMLElement} messageDiv - The message element
     * @param {string} content - The message content
     * @private
     */
    _addMessageActions(messageDiv, content) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        // Copy Button
        const copyMsgBtn = document.createElement('button');
        copyMsgBtn.className = 'action-btn copy-msg-btn';
        copyMsgBtn.title = 'Copy Message';
        copyMsgBtn.innerHTML = `
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        copyMsgBtn.onclick = () => this._copyTextToClipboard(content, copyMsgBtn);

        // TTS Controls
        const ttsControls = this._createTTSControls(content);
        actionsDiv.appendChild(copyMsgBtn);
        actionsDiv.appendChild(ttsControls);
        messageDiv.appendChild(actionsDiv);
    }

    /**
     * Creates TTS controls for a message
     * @param {string} content - The message content
     * @returns {HTMLElement} - TTS controls container
     * @private
     */
    _createTTSControls(content) {
        const ttsControls = document.createElement('div');
        ttsControls.className = 'tts-controls';

        const createBtn = (iconSvg, title, onClick) => {
            const btn = document.createElement('button');
            btn.className = 'action-btn tts-control-btn';
            btn.title = title;
            btn.innerHTML = iconSvg;
            btn.onclick = onClick;
            return btn;
        };

        // Rewind Button (-15s)
        const rewindBtn = createBtn(
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19l-9-7 9-7v14z"></path><path d="M22 19l-9-7 9-7v14z"></path></svg>`,
            "Rewind 15s",
            async (e) => {
                e.preventDefault();
                await this.ttsService.prepare();
                this.ttsService.seek(-15);
            }
        );

        // Forward Button (+15s)
        const forwardBtn = createBtn(
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 19l9-7-9-7v14z"></path><path d="M2 19l9-7-9-7v14z"></path></svg>`,
            "Forward 15s",
            async (e) => {
                e.preventDefault();
                await this.ttsService.prepare();
                this.ttsService.seek(15);
            }
        );

        // Play/Stop Button
        const ttsBtn = document.createElement('button');
        ttsBtn.className = 'action-btn tts-btn tts-main-btn';
        ttsBtn.title = 'Read aloud';
        ttsBtn.innerHTML = `
            <span class="tts-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
            </span>
            <span class="tts-spinner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
            </span>
        `;

        ttsBtn.onclick = async () => {
            if (ttsBtn.classList.contains('playing')) {
                this.ttsService.pause();
                this._updateTTSButton(ttsBtn, false);
            } else {
                await this._playTTS(ttsBtn, content);
            }
        };

        // Store reference
        this.ttsButtons.set(content, ttsBtn);

        ttsControls.appendChild(rewindBtn);
        ttsControls.appendChild(ttsBtn);
        ttsControls.appendChild(forwardBtn);

        return ttsControls;
    }

    /**
     * Plays TTS for a message
     * @param {HTMLElement} ttsBtn - The TTS button element
     * @param {string} content - The message content
     * @private
     */
    async _playTTS(ttsBtn, content) {
        await this.ttsService.prepare();

        // Stop all other TTS buttons
        this.ttsButtons.forEach((btn, key) => {
            if (btn !== ttsBtn && btn.classList.contains('playing')) {
                this._updateTTSButton(btn, false);
            }
        });

        ttsBtn.classList.add('loading');

        try {
            let offsetToUse = 0;
            if (this.ttsService.currentText === content && this.ttsService.currentOffset > 0) {
                offsetToUse = this.ttsService.currentOffset;
            }

            this.ttsService.currentText = content;

            const audioBuffer = await this.ttsService.generateSpeech(content);

            ttsBtn.classList.remove('loading');
            ttsBtn.classList.add('playing');

            this._updateTTSButton(ttsBtn, true, true);

            this.ttsService.play(audioBuffer, offsetToUse, () => {
                this._updateTTSButton(ttsBtn, false);
            });
        } catch (e) {
            console.error(e);
            ttsBtn.classList.remove('loading');
            ttsBtn.style.color = '#ef4444';
            setTimeout(() => ttsBtn.style.color = '', 2000);
        }
    }

    /**
     * Updates the TTS button appearance
     * @param {HTMLElement} ttsBtn - The TTS button element
     * @param {boolean} isPlaying - Whether the audio is playing
     * @param {boolean} showPause - Whether to show pause icon
     * @private
     */
    _updateTTSButton(ttsBtn, isPlaying, showPause = false) {
        if (isPlaying && showPause) {
            ttsBtn.querySelector('.tts-icon').innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                     <rect x="6" y="4" width="4" height="16"></rect>
                     <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
            `;
        } else {
            ttsBtn.querySelector('.tts-icon').innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
            `;
        }
    }

    /**
     * Copies text to clipboard
     * @param {string} text - The text to copy
     * @param {HTMLElement} btn - The button element
     * @private
     */
    _copyTextToClipboard(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            btn.classList.add('copied');

            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.classList.remove('copied');
            }, 2000);
        }).catch(console.error);
    }

    /**
     * Scrolls to the bottom of the chat container
     */
    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    /**
     * Removes a message element by ID
     * @param {string} id - The element ID
     */
    removeMessage(id) {
        const element = document.getElementById(id);
        if (element) element.remove();
    }
}

export default MessageComponent;
