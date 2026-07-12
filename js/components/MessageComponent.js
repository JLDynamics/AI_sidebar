/**
 * Message Component
 * Handles rendering of chat messages
 */

import { sanitizeHTML } from '../utils/sanitizer.js';
import { getStore } from '../store/store.js';

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
    constructor(chatContainer) {
        this.chatContainer = chatContainer;

        // Close any open "..." menus on outside click
        document.addEventListener('click', () => {
            this.chatContainer.querySelectorAll('.more-menu.open')
                .forEach(menu => menu.classList.remove('open'));
        });
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

        currentChat.messages.forEach((msg, index) => {
            this.appendMessage(msg.role, msg.content, null, null, msg.meta || null, {
                timestamp: msg.timestamp,
                index: index,
                rating: msg.meta ? msg.meta.rating : null
            });
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
     * @param {Object} _attachment - Unused (kept for call-site compatibility)
     * @param {Object} meta - Optional metadata (provider, model, cost) shown as a footer
     * @param {Object} opts - Optional {timestamp, index} for user message actions
     */
    appendMessage(role, content, id = null, _attachment = null, meta = null, opts = {}) {
        // Remove welcome message if present
        const welcome = this.chatContainer.querySelector('.welcome-message');
        if (welcome) welcome.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role.toLowerCase()}`;
        if (id) messageDiv.id = id;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';

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
                const parsedContent = sanitizeHTML(marked.parse(content));

                // Code Block Injection for Copy Button
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = parsedContent;

                // Make links (e.g. fact-check citations) open in a new tab
                // instead of navigating the side panel. Strip non-http links.
                tempDiv.querySelectorAll('a').forEach(a => {
                    const href = a.getAttribute('href') || '';
                    if (/^https?:\/\//i.test(href)) {
                        a.setAttribute('target', '_blank');
                        a.setAttribute('rel', 'noopener noreferrer');
                    } else {
                        a.removeAttribute('href');
                    }
                });

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

        // Add metadata footer for AI messages (provider · model · cost · time)
        if (role === 'AI' && meta) {
            const parts = [];
            if (meta.provider) parts.push(meta.provider);
            if (meta.model) parts.push(meta.model);
            if (meta.effort) parts.push(`effort:${meta.effort}`);
            if (typeof meta.num_turns === 'number' && meta.num_turns > 1) parts.push(`${meta.num_turns} turns`);
            if (typeof meta.cost_usd === 'number') parts.push(`~$${meta.cost_usd.toFixed(4)}`);
            if (typeof meta.duration_ms === 'number') parts.push(`${(meta.duration_ms / 1000).toFixed(1)}s`);

            if (parts.length > 0) {
                const metaDiv = document.createElement('div');
                metaDiv.className = 'message-meta';
                metaDiv.textContent = parts.join(' · ');
                messageDiv.appendChild(metaDiv);
            }
        }

        // Add Actions for AI messages
        if (role === 'AI') {
            this._addMessageActions(messageDiv, content, opts);
        }

        // Add actions row for user messages (time ago · restart · edit · copy)
        if (role === 'User' && typeof opts.index === 'number') {
            this._addUserActions(messageDiv, content, opts);
        }

        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    /**
     * Adds the action row under a user message
     * @param {HTMLElement} messageDiv - The message element
     * @param {string} content - The message content
     * @param {Object} opts - {timestamp, index}
     * @private
     */
    _addUserActions(messageDiv, content, opts) {
        const row = document.createElement('div');
        row.className = 'user-actions';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'time-ago';
        timeSpan.textContent = this._timeAgo(opts.timestamp || Date.now());
        row.appendChild(timeSpan);

        const createBtn = (title, svg, action) => {
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            btn.title = title;
            btn.innerHTML = svg;
            btn.onclick = () => {
                if (action === 'copy') {
                    this._copyTextToClipboard(content, btn);
                } else if (this.onUserAction) {
                    this.onUserAction(action, opts.index, content);
                }
            };
            return btn;
        };

        // Restart conversation from here
        row.appendChild(createBtn('Restart conversation from here',
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`,
            'restart'));

        // Edit
        row.appendChild(createBtn('Edit message',
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`,
            'edit'));

        // Copy
        row.appendChild(createBtn('Copy message',
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
            'copy'));

        messageDiv.appendChild(row);
    }

    /**
     * Formats a timestamp as relative time, e.g. "23 minutes ago"
     * @param {number} timestamp - Epoch milliseconds
     * @returns {string}
     * @private
     */
    _timeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    /**
     * Adds the action row to AI messages:
     * copy · thumbs up · thumbs down · "..." menu · time ago
     * @param {HTMLElement} messageDiv - The message element
     * @param {string} content - The message content
     * @param {Object} opts - {timestamp, index}
     * @private
     */
    _addMessageActions(messageDiv, content, opts = {}) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        // Copy
        const copyMsgBtn = document.createElement('button');
        copyMsgBtn.className = 'action-btn';
        copyMsgBtn.title = 'Copy message';
        copyMsgBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        copyMsgBtn.onclick = () => this._copyTextToClipboard(content, copyMsgBtn);
        actionsDiv.appendChild(copyMsgBtn);

        // Thumbs up / down
        const rating = opts.rating || null;
        const thumbUpBtn = document.createElement('button');
        thumbUpBtn.className = 'action-btn thumb-btn';
        thumbUpBtn.title = 'Good response';
        thumbUpBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
            </svg>
        `;
        const thumbDownBtn = document.createElement('button');
        thumbDownBtn.className = 'action-btn thumb-btn';
        thumbDownBtn.title = 'Bad response';
        thumbDownBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
            </svg>
        `;
        if (rating === 'up') thumbUpBtn.classList.add('active');
        if (rating === 'down') thumbDownBtn.classList.add('active');

        const handleThumb = (btn, other, value) => {
            const nowActive = !btn.classList.contains('active');
            btn.classList.toggle('active', nowActive);
            other.classList.remove('active');
            if (this.onAIRating && typeof opts.index === 'number') {
                this.onAIRating(opts.index, nowActive ? value : null);
            }
        };
        thumbUpBtn.onclick = () => handleThumb(thumbUpBtn, thumbDownBtn, 'up');
        thumbDownBtn.onclick = () => handleThumb(thumbDownBtn, thumbUpBtn, 'down');
        actionsDiv.appendChild(thumbUpBtn);
        actionsDiv.appendChild(thumbDownBtn);

        // "..." menu
        const moreWrap = document.createElement('div');
        moreWrap.className = 'more-wrap';
        const moreBtn = document.createElement('button');
        moreBtn.className = 'action-btn';
        moreBtn.title = 'More';
        moreBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.6"></circle>
                <circle cx="12" cy="12" r="1.6"></circle>
                <circle cx="19" cy="12" r="1.6"></circle>
            </svg>
        `;
        const moreMenu = document.createElement('div');
        moreMenu.className = 'more-menu';
        const regenItem = document.createElement('button');
        regenItem.className = 'more-item';
        regenItem.textContent = 'Regenerate response';
        regenItem.onclick = (e) => {
            e.stopPropagation();
            moreMenu.classList.remove('open');
            if (this.onAIAction) this.onAIAction('regenerate', opts.index);
        };
        moreMenu.appendChild(regenItem);
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            const isOpen = moreMenu.classList.contains('open');
            this.chatContainer.querySelectorAll('.more-menu.open')
                .forEach(menu => menu.classList.remove('open'));
            moreMenu.classList.toggle('open', !isOpen);
        };
        moreWrap.appendChild(moreBtn);
        moreWrap.appendChild(moreMenu);
        actionsDiv.appendChild(moreWrap);

        // Time ago
        const timeSpan = document.createElement('span');
        timeSpan.className = 'time-ago';
        timeSpan.textContent = this._timeAgo(opts.timestamp || Date.now());
        actionsDiv.appendChild(timeSpan);

        messageDiv.appendChild(actionsDiv);
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
