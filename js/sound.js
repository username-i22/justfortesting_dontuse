class SoundManager {
    constructor() {
        this.sounds = {};
        this.bgm = null;
        this.muted = false;
        this.audioCtx = null;
        this.synthFallbackEnabled = true;

        // Initialize Web Audio API on first user gesture
        this.initAudioContext();
        this.registerSoundList();
    }

    initAudioContext() {
        const unlock = () => {
            if (!this.audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    this.audioCtx = new AudioContext();
                }
            }
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            window.removeEventListener('click', unlock);
            window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('click', unlock);
        window.addEventListener('keydown', unlock);
    }

    registerSoundList() {
        // Defined sounds with placeholder filenames in the ./sounds/ directory
        const soundFiles = {
            move: 'sounds/move.mp3',
            rotate: 'sounds/rotate.mp3',
            drop: 'sounds/drop.mp3',
            hardDrop: 'sounds/harddrop.mp3',
            hold: 'sounds/hold.mp3',
            lineClear: 'sounds/clear.mp3',
            tetris: 'sounds/tetris.mp3',
            attack: 'sounds/attack.mp3',
            receiveAttack: 'sounds/receive_attack.mp3',
            ko: 'sounds/ko.mp3',
            win: 'sounds/win.mp3',
            lose: 'sounds/lose.mp3',
            countdown: 'sounds/countdown.mp3',
            start: 'sounds/start.mp3'
        };

        for (const [key, path] of Object.entries(soundFiles)) {
            const audio = new Audio();
            audio.src = path;
            audio.preload = 'auto';
            // Flag to indicate if real file loaded or errored
            audio.dataset.ready = 'false';

            audio.addEventListener('canplaythrough', () => {
                audio.dataset.ready = 'true';
            });
            audio.addEventListener('error', () => {
                // If file does not exist, silent failure & fallback to Web Audio synth
                audio.dataset.ready = 'error';
            });

            this.sounds[key] = audio;
        }

        // BGM
        this.bgm = new Audio();
        this.bgm.src = 'sounds/bgm.mp3';
        this.bgm.loop = true;
        this.bgm.volume = 0.35;
        this.bgm.dataset.ready = 'false';
        this.bgm.addEventListener('canplaythrough', () => {
            this.bgm.dataset.ready = 'true';
        });
        this.bgm.addEventListener('error', () => {
            this.bgm.dataset.ready = 'error';
        });
    }

    play(name) {
        if (this.muted) return;

        const snd = this.sounds[name];
        if (snd && snd.dataset.ready === 'true') {
            try {
                const clone = snd.cloneNode();
                clone.volume = 0.5;
                clone.play().catch(() => {});
                return;
            } catch (e) {}
        }

        // Fallback: Web Audio synthesizer beep so game always has feedback!
        if (this.synthFallbackEnabled) {
            this.playSynthSound(name);
        }
    }

    playBGM() {
        if (this.muted || !this.bgm) return;
        if (this.bgm.dataset.ready === 'true') {
            this.bgm.currentTime = 0;
            this.bgm.play().catch(() => {});
        }
    }

    stopBGM() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            if (this.bgm) this.bgm.pause();
        } else {
            if (this.bgm && this.bgm.dataset.ready === 'true') {
                this.bgm.play().catch(() => {});
            }
        }
        return this.muted;
    }

    // Pleasant synthetic audio fallback when mp3 files are missing
    playSynthSound(type) {
        if (!this.audioCtx || this.audioCtx.state !== 'running') return;
        try {
            const ctx = this.audioCtx;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            switch (type) {
                case 'move':
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(260, now);
                    gain.gain.setValueAtTime(0.04, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                    osc.start(now);
                    osc.stop(now + 0.05);
                    break;
                case 'rotate':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(380, now);
                    osc.frequency.exponentialRampToValueAtTime(520, now + 0.07);
                    gain.gain.setValueAtTime(0.05, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                    osc.start(now);
                    osc.stop(now + 0.07);
                    break;
                case 'drop':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(160, now);
                    gain.gain.setValueAtTime(0.04, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                    osc.start(now);
                    osc.stop(now + 0.06);
                    break;
                case 'hardDrop':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(240, now);
                    osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    osc.start(now);
                    osc.stop(now + 0.12);
                    break;
                case 'hold':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(300, now);
                    osc.frequency.exponentialRampToValueAtTime(450, now + 0.08);
                    gain.gain.setValueAtTime(0.05, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                    osc.start(now);
                    osc.stop(now + 0.08);
                    break;
                case 'lineClear':
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(440, now);
                    osc.frequency.setValueAtTime(660, now + 0.06);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                    osc.start(now);
                    osc.stop(now + 0.18);
                    break;
                case 'tetris':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(523.25, now); // C5
                    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
                    osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
                    osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
                    gain.gain.setValueAtTime(0.09, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                    osc.start(now);
                    osc.stop(now + 0.45);
                    break;
                case 'attack':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(180, now);
                    osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
                    gain.gain.setValueAtTime(0.07, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    osc.start(now);
                    osc.stop(now + 0.15);
                    break;
                case 'receiveAttack':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(120, now);
                    gain.gain.setValueAtTime(0.09, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                    osc.start(now);
                    osc.stop(now + 0.2);
                    break;
                case 'ko':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.exponentialRampToValueAtTime(100, now + 0.35);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                    osc.start(now);
                    osc.stop(now + 0.35);
                    break;
                case 'win':
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(440, now);
                    osc.frequency.setValueAtTime(554, now + 0.12);
                    osc.frequency.setValueAtTime(659, now + 0.24);
                    osc.frequency.setValueAtTime(880, now + 0.36);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                    osc.start(now);
                    osc.stop(now + 0.6);
                    break;
                case 'lose':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(320, now);
                    osc.frequency.setValueAtTime(280, now + 0.15);
                    osc.frequency.setValueAtTime(220, now + 0.3);
                    osc.frequency.setValueAtTime(160, now + 0.45);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
                    osc.start(now);
                    osc.stop(now + 0.7);
                    break;
                case 'countdown':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, now);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    osc.start(now);
                    osc.stop(now + 0.12);
                    break;
                case 'start':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(880, now);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                    osc.start(now);
                    osc.stop(now + 0.25);
                    break;
            }
        } catch (e) {
            // Audio error ignored safely
        }
    }
}

window.soundManager = new SoundManager();
