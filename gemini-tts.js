class GeminiTTS {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.audioContext = null;
        this.currentSource = null;
        this.currentAudioBuffer = null;
        this.isPlaying = false;

        // Cache audio buffers by text to avoid re-generating for same message
        this.audioCache = new Map();
    }

    async initAudioContext() {
        if (!this.audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass({ sampleRate: 24000 });
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    async generateSpeech(text) {
        // Check cache first
        if (this.audioCache.has(text)) {
            return this.audioCache.get(text);
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${this.apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: text }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: "Kore" }
                    }
                }
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || 'TTS generation failed');
            }

            const data = await response.json();
            const candidate = data.candidates?.[0];
            const inlineData = candidate?.content?.parts?.[0]?.inlineData;

            if (!inlineData || !inlineData.data) {
                throw new Error('No audio data received from Gemini');
            }

            // Decode base64 to audio buffer
            await this.initAudioContext();
            const binaryString = atob(inlineData.data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const audioBuffer = await this.decodeAudioData(bytes);

            // Cache the result
            this.audioCache.set(text, audioBuffer);

            return audioBuffer;
        } catch (error) {
            console.error('Gemini TTS Error:', error);
            throw error;
        }
    }

    async decodeAudioData(bytes) {
        // Custom decoding for raw PCM if needed, but Gemini API usually returns standard formats wrapable or raw
        // The previous analysis showed custom decoding for Mono 24kHz. 
        // Let's reuse the logic found in gemini-tts-studio/services/audioUtils.ts
        // which decodes raw PCM 16-bit.

        const dataInt16 = new Int16Array(bytes.buffer);
        const numChannels = 1;
        const sampleRate = 24000;
        const frameCount = dataInt16.length / numChannels;

        const buffer = this.audioContext.createBuffer(numChannels, frameCount, sampleRate);
        const channelData = buffer.getChannelData(0);

        for (let i = 0; i < frameCount; i++) {
            // Normalize Int16 to Float32 [-1.0, 1.0]
            channelData[i] = dataInt16[i] / 32768.0;
        }

        return buffer;
    }

    play(audioBuffer, onEnded) {
        this.stop(); // Stop any current playback

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        source.onended = () => {
            this.isPlaying = false;
            this.currentSource = null;
            if (onEnded) onEnded();
        };

        source.start(0);
        this.currentSource = source;
        this.isPlaying = true;
    }

    stop() {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            this.currentSource = null;
        }
        this.isPlaying = false;
    }
}
