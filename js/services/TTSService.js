/**
 * TTS Service
 * Handles text-to-speech functionality using OpenAI API
 */

import { cleanTextForTTS } from '../utils/helpers.js';

/**
 * TTS Service class for managing audio playback
 */
class TTSService {
    /**
     * Creates a new TTSService instance
     * @param {string} apiKey - OpenAI API key
     */
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

    /**
     * Initializes the AudioContext
     */
    async initAudioContext() {
        if (!this.audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    /**
     * Prepares the TTS service for playback
     */
    async prepare() {
        await this.initAudioContext();
    }

    /**
     * Cleans up old cache entries to prevent memory issues
     */
    cleanupCache() {
        if (this.audioCache.size > this.MAX_CACHE_SIZE) {
            const keys = Array.from(this.audioCache.keys());
            // Remove oldest entries (first 3)
            keys.slice(0, 3).forEach(key => this.audioCache.delete(key));
            console.log(`TTS cache cleaned: ${this.audioCache.size} entries remaining`);
        }
    }

    /**
     * Generates speech from text using OpenAI API
     * @param {string} text - The text to convert to speech
     * @returns {Promise<AudioBuffer>} - The decoded audio buffer
     */
    async generateSpeech(text) {
        if (!text || !text.trim()) {
            throw new Error('TTS received empty text');
        }

        // Check cache first
        if (this.audioCache.has(text)) {
            return this.audioCache.get(text);
        }

        const url = 'https://api.openai.com/v1/audio/speech';

        // Strip URLs to prevent reading them aloud
        const cleanText = cleanTextForTTS(text);

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

    /**
     * Plays an audio buffer
     * @param {AudioBuffer} audioBuffer - The audio buffer to play
     * @param {number} offset - The offset in seconds to start playback from
     * @param {Function} onEnded - Callback when playback ends
     */
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

    /**
     * Pauses the current playback
     */
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

    /**
     * Seeks forward or backward in the current audio
     * @param {number} delta - The number of seconds to seek (positive or negative)
     */
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

    /**
     * Stops the current playback
     * @param {boolean} fullReset - Whether to reset the offset to zero
     */
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

    /**
     * Gets the current playback state
     * @returns {Object} - Object containing isPlaying, currentOffset, and duration
     */
    getState() {
        return {
            isPlaying: this.isPlaying,
            currentOffset: this.currentOffset,
            duration: this.currentAudioBuffer?.duration || 0
        };
    }
}

export default TTSService;
