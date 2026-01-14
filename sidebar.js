// Deprecated config keys removed


// State
let chats = [];
let currentChatId = null;
let isHistoryOpen = false;
let currentAttachment = null;

// PDF.js Worker Configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

// DOM Elements
const historyDrawer = document.getElementById('historyDrawer');
const historyList = document.getElementById('historyList');
const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
const historyCloseBtn = document.getElementById('historyCloseBtn');
const historyOverlay = document.getElementById('historyOverlay');
const newChatBtn = document.getElementById('newChatBtn');
const chatContainer = document.getElementById('chatContainer');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const dragDropOverlay = document.getElementById('dragDropOverlay');
const inputContainer = document.getElementById('inputContainer');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxClose = document.querySelector('.lightbox-close');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadChats();
    if (chats.length === 0) {
        createNewChat();
    } else {
        // Load the most recent chat
        switchChat(chats[0].id);
    }

    setupEventListeners();
    setupInputAutoResize();
});

// OpenAITTS Class Definition
class OpenAITTS {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.audioContext = null;
        this.currentSource = null;
        this.currentAudioBuffer = null;
        this.isPlaying = false;

        // Cache audio buffers by text
        this.audioCache = new Map();
        this.MAX_CACHE_SIZE = 10; // Limit cache to prevent memory issues

        // Seek State
        this.currentOffset = 0;
        this.startTime = 0;

        // Track current text for resume functionality
        this.currentText = null;
    }

    async initAudioContext() {
        if (!this.audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    async prepare() {
        await this.initAudioContext();
    }

    // Cleanup old cache entries to prevent memory issues
    cleanupCache() {
        if (this.audioCache.size > this.MAX_CACHE_SIZE) {
            const keys = Array.from(this.audioCache.keys());
            // Remove oldest entries (first 3)
            keys.slice(0, 3).forEach(key => this.audioCache.delete(key));
            console.log(`TTS cache cleaned: ${this.audioCache.size} entries remaining`);
        }
    }

    async generateSpeech(text) {
        if (!text || !text.trim()) {
            throw new Error('TTS received empty text');
        }

        if (this.audioCache.has(text)) {
            return this.audioCache.get(text);
        }

        const url = 'https://api.openai.com/v1/audio/speech';

        // Strip URLs to prevent reading them aloud
        // 1. Remove Markdown links [text](url) -> text
        let cleanText = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        // 2. Remove http/https URLs
        cleanText = cleanText.replace(/https?:\/\/[^\s)]+/g, '');
        // 3. Remove parenthesized domains often used as citations e.g. (example.com)
        cleanText = cleanText.replace(/\([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\)/g, '');

        const payload = {
            model: "gpt-4o-mini-tts-2025-12-15",
            input: cleanText,
            voice: "alloy"
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || 'TTS generation failed');
            }

            const arrayBuffer = await response.arrayBuffer();

            // Decode Audio
            await this.initAudioContext();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            this.audioCache.set(text, audioBuffer);
            this.cleanupCache(); // Prevent memory leaks
            return audioBuffer;
        } catch (error) {
            console.error('OpenAI TTS Error:', error);
            throw error;
        }
    }

    play(audioBuffer, offset = 0, onEnded) {
        this.stop(false);

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        this.lastOnEnded = onEnded; // Save for seek functionality

        source.onended = () => {
            if (this.currentSource === source) {
                this.isPlaying = false;
                this.currentSource = null;
                this.currentOffset = 0;
                if (onEnded) onEnded();
            }
        };

        this.currentAudioBuffer = audioBuffer;
        this.startTime = this.audioContext.currentTime - offset;
        this.currentOffset = offset;

        source.start(0, offset);
        this.currentSource = source;
        this.isPlaying = true;
    }

    pause() {
        if (!this.isPlaying) return;
        const elapsed = this.audioContext.currentTime - this.startTime;
        this.currentOffset = elapsed;

        if (this.currentSource) {
            try { this.currentSource.stop(); } catch (e) { }
            this.currentSource = null;
        }
        this.isPlaying = false;
    }

    seek(delta) {
        if (!this.currentAudioBuffer) return;

        let baseTime = this.isPlaying
            ? (this.audioContext.currentTime - this.startTime)
            : this.currentOffset;

        let newTime = baseTime + delta;
        newTime = Math.max(0, Math.min(newTime, this.currentAudioBuffer.duration));

        if (this.isPlaying) {
            this.play(this.currentAudioBuffer, newTime, this.lastOnEnded);
        } else {
            this.currentOffset = newTime;
        }
    }

    stop(fullReset = true) {
        if (this.currentSource) {
            try { this.currentSource.stop(); } catch (e) { }
            this.currentSource = null;
        }
        this.isPlaying = false;
        if (fullReset) {
            this.currentOffset = 0;
        }
    }
}

// TTS Initialization
const tts = new OpenAITTS(CONFIG.OPENAI_API_KEY);

// Event Listeners
function setupEventListeners() {
    toggleHistoryBtn.addEventListener('click', toggleHistory);
    historyCloseBtn.addEventListener('click', toggleHistory); // Close from inside drawer
    historyOverlay.addEventListener('click', toggleHistory); // Close by clicking outside
    newChatBtn.addEventListener('click', createNewChat);

    sendBtn.addEventListener('click', sendMessage);

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // File Upload (Click)
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelection);

    // Paste Support
    chatInput.addEventListener('paste', handlePaste);

    // Drag & Drop Support
    setupDragAndDrop();

    // Lightbox Controls
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target !== lightboxImg) closeLightbox();
    });

    // Delegate click for zoomable images
    chatContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('sent-image')) {
            openLightbox(e.target.src);
        }
    });

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Keyboard Shortcuts Handler
function handleKeyboardShortcuts(e) {
    // Check if user is typing in input (don't trigger shortcuts)
    const isTyping = document.activeElement === chatInput;

    // Ctrl/Cmd + Enter: Send message (works even while typing)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (chatInput.value.trim()) {
            sendMessage();
        }
        return;
    }

    // Don't process other shortcuts if user is typing in input
    if (isTyping) return;

    // Ctrl/Cmd + K: Focus input
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        chatInput.focus();
        return;
    }

    // Ctrl/Cmd + N: New chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNewChat();
        return;
    }

    // Ctrl/Cmd + H: Toggle history
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        toggleHistory();
        return;
    }

    // Ctrl/Cmd + L: Clear input
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        chatInput.value = '';
        autoResizeInput();
        return;
    }

    // Esc: Close overlays
    if (e.key === 'Escape') {
        // Close lightbox if open
        if (lightbox.classList.contains('active')) {
            closeLightbox();
            return;
        }
        // Close history if open
        if (isHistoryOpen) {
            toggleHistory();
            return;
        }
    }
}


// Lightbox Logic
function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.classList.add('active');
}

function closeLightbox() {
    lightbox.classList.remove('active');
    lightboxImg.src = '';
}

// Drag & Drop Logic
function setupDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        inputContainer.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    inputContainer.addEventListener('dragenter', highlight, false);
    inputContainer.addEventListener('dragover', highlight, false);
    inputContainer.addEventListener('dragleave', unhighlight, false);
    inputContainer.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    inputContainer.classList.add('drag-over');
    dragDropOverlay.classList.add('active');
}

function unhighlight() {
    inputContainer.classList.remove('drag-over');
    dragDropOverlay.classList.remove('active');
}

function handleDrop(e) {
    unhighlight();
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

// Paste Logic
function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.kind === 'file') {
            const file = item.getAsFile();
            processFile(file);
        }
    }
}

// File Processing
function processFile(file) {
    // Re-use existing handleFileSelection logic by mocking event or extracting core logic
    // Refactoring handleFileSelection to processFileCore to share logic
    const mockEvent = { target: { files: [file] } };
    handleFileSelection(mockEvent);
}

// Input Auto-Resize
function setupInputAutoResize() {
    chatInput.addEventListener('input', autoResizeInput);
}

function autoResizeInput() {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
    if (chatInput.value === '') {
        chatInput.style.height = 'auto';
    }
}

// File Handling
async function handleFileSelection(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset current attachment
    currentAttachment = null;

    // Show processing indicator
    const processingId = showFileProcessing(file.name);

    try {
        if (file.type.startsWith('image/')) {
            const base64 = await convertFileToBase64(file);
            currentAttachment = {
                type: 'image',
                content: base64,
                name: file.name
            };
        } else if (file.type === 'application/pdf') {
            // PDF handling
            const text = await extractTextFromPDF(file);
            currentAttachment = {
                type: 'text',
                content: text,
                name: file.name
            };
        } else {
            // Text/Code handling
            const text = await readFileAsText(file);
            currentAttachment = {
                type: 'text',
                content: text,
                name: file.name
            };
        }
        renderPreview();
    } catch (e) {
        displayError(`Failed to process file "${file.name}": ${e.message}`, ErrorTypes.FILE);
    } finally {
        hideFileProcessing(processingId);
    }

    // Reset input so same file can be selected again
    fileInput.value = '';
}

// This function is not used in the current implementation
// TTS is handled directly in the message rendering via ttsBtn.onclick
// Keeping for potential future use

function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
}

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
    }
    return fullText;
}

function renderPreview() {
    if (!currentAttachment) {
        imagePreviewContainer.style.display = 'none';
        imagePreviewContainer.innerHTML = '';
        return;
    }

    imagePreviewContainer.style.display = 'flex';
    imagePreviewContainer.innerHTML = '';

    const item = document.createElement('div');
    item.className = 'preview-item';

    if (currentAttachment.type === 'image') {
        const img = document.createElement('img');
        img.src = currentAttachment.content;
        item.appendChild(img);
    } else {
        const icon = document.createElement('div');
        icon.className = 'file-icon';
        icon.textContent = '📄'; // Generic doc icon
        item.appendChild(icon);
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'preview-remove-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.onclick = () => {
        currentAttachment = null;
        renderPreview();
    };

    item.appendChild(removeBtn);
    imagePreviewContainer.appendChild(item);
}

// History Management
function loadChats() {
    const storedChats = localStorage.getItem('gemini_chats');
    if (storedChats) {
        try {
            chats = JSON.parse(storedChats);
        } catch (e) {
            console.error('Failed to parse chat history:', e);
            chats = [];
            localStorage.removeItem('gemini_chats'); // Reset corrupted data
        }
    }
}

function saveChats() {
    localStorage.setItem('gemini_chats', JSON.stringify(chats));
    renderHistory();
}

function createNewChat() {
    const newChat = {
        id: Date.now().toString(),
        title: 'New Chat',
        messages: [],
        lastUpdated: Date.now()
    };

    chats.unshift(newChat);
    currentChatId = newChat.id;
    saveChats();
    renderMessages();

    // Close drawer on mobile/small screens if needed, or just keep open
    if (window.innerWidth < 600) {
        isHistoryOpen = false;
        updateHistoryDrawerToggle();
    }
}

function deleteChat(e, chatId) {
    e.stopPropagation(); // Prevent switching to chat when clicking delete

    if (confirm('Delete this chat?')) {
        chats = chats.filter(c => c.id !== chatId);

        if (chats.length === 0) {
            createNewChat();
        } else if (currentChatId === chatId) {
            currentChatId = chats[0].id;
            renderMessages();
        }

        saveChats();
    }
}

function switchChat(chatId) {
    currentChatId = chatId;
    renderMessages();
    renderHistory(); // To update active state

    // Close drawer on mobile
    if (window.innerWidth < 600 && isHistoryOpen) {
        toggleHistory();
    }
}

function updateChatTitle(chatId, firstMessage) {
    const chat = chats.find(c => c.id === chatId);
    if (chat && chat.title === 'New Chat') {
        // Simple title generation: first 30 chars of message
        chat.title = firstMessage.substring(0, 30) + (firstMessage.length > 30 ? '...' : '');
        saveChats();
    }
}

// UI Rendering
function toggleHistory() {
    isHistoryOpen = !isHistoryOpen;
    updateHistoryDrawerToggle();
}

function updateHistoryDrawerToggle() {
    if (isHistoryOpen) {
        historyDrawer.classList.add('open');
        if (historyOverlay) historyOverlay.classList.add('open');
    } else {
        historyDrawer.classList.remove('open');
        if (historyOverlay) historyOverlay.classList.remove('open');
    }
}

function renderHistory() {
    historyList.innerHTML = '';

    chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
        item.onclick = () => switchChat(chat.id);

        const titleSpan = document.createElement('span');
        titleSpan.textContent = chat.title;
        item.appendChild(titleSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-chat-btn';
        deleteBtn.innerHTML = '&times;'; // Simple X icon
        deleteBtn.onclick = (e) => deleteChat(e, chat.id);
        item.appendChild(deleteBtn);

        historyList.appendChild(item);
    });
}

function renderMessages() {
    chatContainer.innerHTML = '';

    const currentChat = chats.find(c => c.id === currentChatId);
    if (!currentChat) return;

    if (currentChat.messages.length === 0) {
        chatContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">✨</div>
                <h2>How can AI Sidebar help you today?</h2>
            </div>
        `;
        return;
    }

    currentChat.messages.forEach(msg => {
        appendMessageToUI(msg.role, msg.content);
    });

    scrollToBottom();
}

function appendMessageToUI(role, content, id = null, attachment = null) {
    // Remove welcome message if present
    const welcome = chatContainer.querySelector('.welcome-message');
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
        bubble.appendChild(img);
    }

    // Display Text Content
    if (content) {
        if (role === 'System') {
            bubble.textContent = content; // System messages (like URL info)
            bubble.style.backgroundColor = 'transparent';
            bubble.style.color = '#888';
            bubble.style.fontSize = '12px';
            bubble.style.padding = '4px 12px';
        } else {
            // Parse Markdown
            let parsedContent = sanitizeHTML(marked.parse(content));

            // Code Block Injection for Copy Button
            // We use a temporary div to manipulate the HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = parsedContent;

            const preTags = tempDiv.querySelectorAll('pre');
            preTags.forEach(pre => {
                const codeContent = pre.innerText; // Get raw code

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

                // Wrap existing pre
                const newPre = pre.cloneNode(true);
                // Hide the original data property for potential recovery if needed, but innerText works
                newPre.dataset.code = codeContent;

                wrapper.appendChild(header);
                wrapper.appendChild(newPre);

                pre.replaceWith(wrapper);
            });

            // Append parsed text content after any images
            const textDiv = document.createElement('div');
            textDiv.innerHTML = tempDiv.innerHTML;
            bubble.appendChild(textDiv);
        }
    }

    messageDiv.appendChild(bubble);

    // Add Actions (Copy + TTS) for AI messages
    if (role === 'AI') {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        // 1. Copy Button
        const copyMsgBtn = document.createElement('button');
        copyMsgBtn.className = 'action-btn copy-msg-btn';
        copyMsgBtn.title = 'Copy Message';
        copyMsgBtn.innerHTML = `
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        copyMsgBtn.onclick = () => copyTextToClipboard(content, copyMsgBtn);

        // 2. TTS Button
        // TTS Controls Container
        const ttsControls = document.createElement('div');
        ttsControls.className = 'tts-controls';

        // Helper to create icon buttons
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
                e.preventDefault(); // Prevent focus jump
                await tts.prepare();
                tts.seek(-15);
            }
        );

        // Forward Button (+15s)
        const forwardBtn = createBtn(
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 19l9-7-9-7v14z"></path><path d="M2 19l9-7-9-7v14z"></path></svg>`,
            "Forward 15s",
            async (e) => {
                e.preventDefault();
                await tts.prepare();
                tts.seek(15);
            }
        );

        // Play/Stop Button (Logic from before)
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
                // User clicked "Pause" (was Playing)
                tts.pause();
                ttsBtn.classList.remove('playing');
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
            } else {
                // User clicked "Play" or "Resume"
                await tts.prepare();

                // Stop any other buttons
                document.querySelectorAll('.tts-btn.playing').forEach(btn => {
                    // Logic to find other buttons and force stop them if we wanted exclusive play
                    // For now, assume single playback focus or that TTS class handles single stream
                });

                ttsBtn.classList.add('loading');

                try {
                    // Check if we are resuming the SAME message
                    let offsetToUse = 0;
                    if (tts.currentText === content && tts.currentOffset > 0) {
                        offsetToUse = tts.currentOffset;
                    }

                    // Update currentText tracking if new
                    tts.currentText = content;

                    const audioBuffer = await tts.generateSpeech(content);

                    ttsBtn.classList.remove('loading');
                    ttsBtn.classList.add('playing');

                    // Change icon to Pause
                    ttsBtn.querySelector('.tts-icon').innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                             <rect x="6" y="4" width="4" height="16"></rect>
                             <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                    `;

                    tts.play(audioBuffer, offsetToUse, () => {
                        ttsBtn.classList.remove('playing');
                        // Reset icon to Play
                        ttsBtn.querySelector('.tts-icon').innerHTML = `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                        `;
                    });
                } catch (e) {
                    console.error(e);
                    ttsBtn.classList.remove('loading');
                    ttsBtn.style.color = '#ef4444';
                    setTimeout(() => ttsBtn.style.color = '', 2000);
                    // Show user-friendly error message
                    const errorMsg = e.message?.includes('401') || e.message?.includes('403')
                        ? 'TTS authentication failed. Check your OpenAI API key.'
                        : `TTS failed: ${e.message || 'Unknown error'}`;
                    displayError(errorMsg, ErrorTypes.TTS);
                }
            }
        };

        ttsControls.appendChild(rewindBtn);
        ttsControls.appendChild(ttsBtn);
        ttsControls.appendChild(forwardBtn);

        actionsDiv.appendChild(copyMsgBtn);
        // Replace direct ttsBtn append with the controls container
        actionsDiv.appendChild(ttsControls);
        messageDiv.appendChild(actionsDiv);
    }

    chatContainer.appendChild(messageDiv);

    scrollToBottom();
}

// Global Copy Function
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
        console.error('Failed to copy class: ', err);
    });
};

// Helper for copying raw text
function copyTextToClipboard(text, btn) {
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

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Pending Action State
let pendingAction = null;

// Helper Functions for Intent
function isAffirmative(text) {
    return /^(yes|yeah|yep|sure|ok|okay|do it|go ahead|please do|yup|i would|yes please)$/i.test(text.trim());
}

function isNegative(text) {
    return /^(no|nah|nope|stop|cancel|don't|no thanks)$/i.test(text.trim());
}

// Detect Pending Action from AI Response
function detectPendingAction(aiText) {
    // Regex to capture various forms of offers to search
    // Matches:
    // "Would you like me to search for..."
    // "Should I check..."
    // "I can find that information for you with a quick search..."
    // "I can search for..."
    const searchRegex = /(?:would you like me to|should i|do you want me to|i can|i can certainly) (?:search|check|look up|find) (?:for )?(.+?)(\?|$|\.|,| with a quick search| if you'd like)/i;
    const match = aiText.match(searchRegex);

    if (match && match[1]) {
        let query = match[1].trim();
        // Clean up query common suffixes
        query = query.replace(/ for you$/i, '')
            .replace(/ with a quick search$/i, '')
            .replace(/ if you'd like$/i, '')
            .replace(/ that information$/i, '');

        // If the query is vague like "that" or "it", we might need to rely on the user's previous input or context.
        // But for now, let's try to capture the specific noun if possible.
        // If the regex captured "that information", it's not a good query.
        if (query.toLowerCase().includes('that information') || query.toLowerCase() === 'it' || query.toLowerCase() === 'that') {
            // Fallback: If the offer is vague ("I can find that"), we can't easily extract the query from the *answer*.
            // We might need to look at the *previous user message* or just set a generic "search" flag.
            // For this specific case "I can certainly find that information...", the "that information" refers to "Tesla headquarters".
            // A simple fix is to check if the query is too vague, and if so, use the *last user message* as the query context?
            // Or better: The AI usually repeats the topic.
            // Let's keep it simple: If vague, we might fail to extract a perfect query.
            // However, in the screenshot, the AI said: "It doesn't actually mention where Tesla's headquarters is located. I can certainly find that information..."
            // The regex might capture "that information". 
            // Let's refine the regex to capture the *intent* to search, even if the query is vague.
        }

        // Refined Regex for the specific case in the screenshot:
        // "I can certainly find that information for you with a quick search if you'd like!"
        // The regex above captures "that information".

        // If we capture "that information", we should probably use the *previous* user query if available?
        // Actually, if the user says "Yes", we can just send "Search for [Previous User Query]"?
        // Let's try to be smarter.

        pendingAction = {
            type: 'search_web',
            params: { query: query }
        };
        console.log('Pending Action Set:', pendingAction);
    } else {
        pendingAction = null;
    }
}

// Execute Pending Action
async function executePendingAction(action) {
    if (action.type === 'search_web') {
        let query = action.params.query;

        // Handle vague queries like "that information" or "it"
        const vagueTerms = ['that information', 'that', 'it', 'the info', 'this'];
        if (vagueTerms.includes(query.toLowerCase()) || query.length < 3) {
            // Fallback to the last user message if available
            // We need to find the last user message from the chat history
            const currentChat = chats.find(c => c.id === currentChatId);
            if (currentChat && currentChat.messages.length > 0) {
                // Find the last message that was from the User
                const lastUserMsg = [...currentChat.messages].reverse().find(m => m.role === 'User');
                if (lastUserMsg) {
                    query = lastUserMsg.content;
                    console.log('Refined vague query using history:', query);
                }
            }
        }

        appendMessageToUI('User', `Yes, search for "${query}"`); // Show confirmation

        // Trigger search via background script
        // We send the query as the question, but with a flag to force search
        await sendToAI(`Search for ${query}`, { forceSearchQuery: query });
    }
}

// Messaging Logic
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text && !currentAttachment) return;

    // Validate config first
    try {
        validateConfig();
    } catch (err) {
        displayError(err.message, ErrorTypes.VALIDATION);
        return;
    }

    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Capture attachment and clear state
    const attachment = currentAttachment;
    currentAttachment = null;
    renderPreview();

    // Check for Pending Action Interception
    if (pendingAction) {
        if (isAffirmative(text)) {
            const action = pendingAction;
            pendingAction = null; // Clear immediately
            await executePendingAction(action);
            return;
        } else if (isNegative(text)) {
            pendingAction = null;
            appendMessageToUI('User', text);
            setTimeout(() => appendMessageToUI('AI', "Okay, I won't do that."), 500);
            return;
        }
    }

    // Add user message to state
    const currentChat = chats.find(c => c.id === currentChatId);
    if (!currentChat) {
        displayError('No active chat found. Please create a new chat.', ErrorTypes.VALIDATION);
        return;
    }

    // Store message in history
    // If it's a file content, we might append it to text or just store metadata?
    // For simplicity, if it's text file, append to content. If image, store separately or as base64?
    // Storing large base64 in local storage is risky (quota). 
    // Let's truncate image for history or just mark it.
    // For now, valid JSON history is crucial.

    let storedContent = text;
    if (attachment) {
        if (attachment.type === 'text') {
            storedContent += `\n\n[File: ${attachment.name}]\n${attachment.content}`;
        } else {
            // Image: For now, we won't store large base64 in localStorage history to avoid quota issues quickly.
            // We'll just note it.
            storedContent += `\n\n[Uploaded Image: ${attachment.name}]`;
        }
    }

    currentChat.messages.push({ role: 'User', content: storedContent });
    currentChat.lastUpdated = Date.now();

    // Update title if needed
    updateChatTitle(currentChatId, text || "File Upload");

    // Save with error handling
    try {
        saveChats();
    } catch (err) {
        displayError('Failed to save chat history. Storage may be full.', ErrorTypes.VALIDATION);
        // Continue anyway - the message is already in memory
    }

    // UI Display
    appendMessageToUI('User', text, null, attachment);

    // Set loading state
    setLoadingState(true);

    // Send payload with retry logic
    try {
        await withRetry(() => sendToAI(text, { attachment }), 2, 1000);
    } catch (err) {
        const retryCallback = () => sendToAI(text, { attachment });

        if (err.message?.includes('401') || err.message?.includes('403')) {
            displayError('Authentication failed. Please check your OpenAI API key in config.js.', ErrorTypes.AUTH);
        } else if (err.message?.includes('429')) {
            displayError('Rate limit exceeded. Please wait a moment before trying again.', ErrorTypes.API, retryCallback);
        } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
            displayError('Network error. Please check your internet connection.', ErrorTypes.NETWORK, retryCallback);
        } else {
            displayError(err.message || 'Failed to communicate with AI.', ErrorTypes.API, retryCallback);
        }
    } finally {
        setLoadingState(false);
    }
}

async function sendToAI(text, options = {}) {
    const currentChat = chats.find(c => c.id === currentChatId);

    // Get Page Metadata
    // CRITICAL FIX: Target 'normal' window to ignore Side Panel focus
    // This ensures we get the actual browser tab, not the extension context
    const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
    const [tab] = await chrome.tabs.query({ active: true, windowId: currentWindow.id });

    if (!tab) throw new Error("No active tab found in main window");
    console.log(`Targeting Real Tab: [${tab.id}] "${tab.title}"`);

    let metadata = { url: tab.url, title: tab.title };

    // Force FRESH content extraction via direct injection
    // This avoids message passing failures or stale content from cached scripts
    try {
        if (tab.url && tab.url.startsWith('http')) {
            // 1. Inject Readability.js library first
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['Readability.js']
            });

            // 2. Run extraction logic using the now-available Readability object
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    try {
                        // Try Readability first
                        // We need to clone the document to avoid modifying the tailored page
                        const documentClone = document.cloneNode(true);
                        // Readability might not be defined if injection failed, so check
                        if (typeof Readability !== 'undefined') {
                            const reader = new Readability(documentClone);
                            const article = reader.parse();
                            if (article && article.textContent) {
                                return {
                                    url: window.location.href,
                                    title: article.title || document.title,
                                    domain: window.location.hostname,
                                    mainContent: article.textContent.replace(/\s+/g, ' ').trim().substring(0, 15000)
                                };
                            }
                        }

                        // Fallback to raw innerText
                        const raw = document.body.innerText.replace(/\s+/g, ' ').trim().substring(0, 15000);
                        return {
                            url: window.location.href,
                            title: document.title,
                            domain: window.location.hostname,
                            mainContent: raw || "No readable content found."
                        };
                    } catch (e) {
                        return null;
                    }
                }
            });

            if (result && result[0] && result[0].result) {
                metadata = result[0].result;
                console.log('Fresh content extracted via script injection');
            }
        }
    } catch (e) {
        console.warn('Script injection failed (likely restricted page):', e);
    }

    // Prepare History (Last 10 messages for context)
    const history = currentChat.messages.slice(-10).map(m => ({
        role: m.role === 'User' ? 'user' : 'assistant',
        content: m.content
    }));

    // Send to Background
    const loadingId = 'loading-' + Date.now();
    appendMessageToUI('System', 'Thinking...', loadingId);

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'ASK_AI',
            apiKey: null, // RefConfig: Handled in background.js
            question: text,
            metadata: metadata,
            history: history,
            attachment: options.attachment // Pass attachment to background
        });

        if (response.error) {
            throw new Error(response.error);
        }

        const aiResponse = response.answer;
        currentChat.messages.push({ role: 'AI', content: aiResponse });
        saveChats();
        appendMessageToUI('AI', aiResponse);
    } finally {
        const loadingMsg = document.getElementById(loadingId);
        if (loadingMsg) loadingMsg.remove();
    }
}
// Basic HTML Sanitizer
function sanitizeHTML(html) {
    const template = document.createElement('div');
    template.innerHTML = html;

    // Remove scripts
    const scripts = template.querySelectorAll('script');
    scripts.forEach(script => script.remove());

    // Remove event handlers (onclick, etc)
    const all = template.querySelectorAll('*');
    all.forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on') || attr.name.startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return template.innerHTML;
}

// --- Enhanced Error Handling System ---

// Error types for categorization
const ErrorTypes = {
    NETWORK: 'Network Error',
    API: 'API Error',
    AUTH: 'Authentication Error',
    CONTENT: 'Content Extraction Error',
    FILE: 'File Processing Error',
    TTS: 'TTS Error',
    VALIDATION: 'Validation Error'
};

// Display error message to user with consistent styling
function displayError(message, type = 'Error', retryCallback = null) {
    const errorId = 'error-' + Date.now();
    const errorContent = `**${type}**\n\n${message}`;

    appendMessageToUI('System', errorContent, errorId);

    // Add retry button if callback provided
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
                        displayError(err.message || 'Retry failed', type);
                    }
                };
                errorElement.appendChild(retryBtn);
            }
        }, 100);
    }

    console.error(`[${type}] ${message}`);
}

// Retry wrapper for API calls
async function withRetry(asyncFn, maxRetries = 2, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await asyncFn();
        } catch (error) {
            if (attempt === maxRetries) throw error;

            // Don't retry on certain errors
            if (error.message?.includes('401') || error.message?.includes('403')) {
                throw error;
            }

            console.warn(`Attempt ${attempt} failed, retrying...`, error);
            await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
    }
}

// Validate API key exists
function validateConfig() {
    if (!CONFIG || !CONFIG.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not found. Please create a config.js file with your API key.');
    }
}

// --- Loading State Management ---

// Show/hide send button loading state
function setLoadingState(isLoading) {
    const sendBtn = document.getElementById('sendBtn');
    if (!sendBtn) return;

    if (isLoading) {
        sendBtn.classList.add('loading');
        sendBtn.disabled = true;
        // Replace icon with spinner
        sendBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.2"></circle>
                <path d="M12 2a10 10 0 0 1 10 10">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                </path>
            </svg>
        `;
    } else {
        sendBtn.classList.remove('loading');
        sendBtn.disabled = false;
        // Restore original icon
        sendBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
        `;
    }
}

// Show file processing indicator
function showFileProcessing(filename) {
    const processingId = 'file-processing-' + Date.now();
    appendMessageToUI('System', `Processing file: ${filename}...`, processingId);
    return processingId;
}

function hideFileProcessing(processingId) {
    const element = document.getElementById(processingId);
    if (element) element.remove();
}

// Show global loading overlay (for critical operations)
function showGlobalLoading(message) {
    let overlay = document.getElementById('globalLoadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'globalLoadingOverlay';
        overlay.className = 'global-loading-overlay';
        overlay.innerHTML = `
            <div class="global-loading-content">
                <div class="global-loading-spinner"></div>
                <div class="global-loading-text">${message}</div>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        const text = overlay.querySelector('.global-loading-text');
        if (text) text.textContent = message;
    }
}

function hideGlobalLoading() {
    const overlay = document.getElementById('globalLoadingOverlay');
    if (overlay) overlay.remove();
}

// Safe file reading with error handling
async function safeFileRead(file, method = 'readAsText') {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
        reader.onabort = () => reject(new Error(`File read aborted: ${file.name}`));

        // Timeout after 30 seconds
        const timeout = setTimeout(() => {
            reader.abort();
            reject(new Error(`File read timeout: ${file.name}`));
        }, 30000);

        try {
            if (method === 'readAsText') reader.readAsText(file);
            else if (method === 'readAsDataURL') reader.readAsDataURL(file);
            else if (method === 'readAsArrayBuffer') reader.readAsArrayBuffer(file);
        } catch (err) {
            clearTimeout(timeout);
            reject(err);
        }
    });
}
