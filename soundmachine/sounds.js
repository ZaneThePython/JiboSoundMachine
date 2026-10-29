'use strict';
const fs = require('fs'), path = require('path');

// CC0 recordings from Freesound, pre-cut into seamless mono loops by tools/make-sounds.sh.
const SOUNDS = [
    { id: 'rain', name: 'Rain' },
    { id: 'ocean', name: 'Ocean' },
    { id: 'fan', name: 'Fan' },
    { id: 'brown', name: 'Brown noise' },
    { id: 'white', name: 'White noise' }
];
const file = id => path.join(__dirname, 'resources', 'sounds', id + '.ogg');

class Player {
    // `read` is injectable for tests. Only the playing sound is decoded, to keep memory low.
    constructor(AudioContext, read) {
        this.AudioContext = AudioContext; this.read = read || fs.readFileSync;
        this.ctx = null; this.current = null;
    }
    // Resolves once the sound starts; a newer play()/stop() wins over a slow decode.
    play(sound) {
        this.stop(0.3);
        const ctx = this.ctx = this.ctx || new this.AudioContext();
        const out = ctx.createGain();
        out.gain.value = 0; out.connect(ctx.destination);
        const current = this.current = { id: sound.id, out: out, source: null };
        return new Promise((resolve, reject) => {
            const data = this.read(file(sound.id)); // Node Buffers share a pool; decode needs its own ArrayBuffer
            ctx.decodeAudioData(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), resolve, reject);
        }).then(buffer => {
            if (this.current !== current) return;
            const source = current.source = ctx.createBufferSource();
            source.buffer = buffer; source.loop = true; source.connect(out);
            const now = ctx.currentTime;
            out.gain.setValueAtTime(0, now); out.gain.linearRampToValueAtTime(0.8, now + 2); // fade in, no pop
            source.start(now);
        }, error => { if (this.current === current) this.stop(0); throw error; });
    }
    // Fade out over `seconds`, then stop and disconnect.
    stop(seconds) {
        const current = this.current; if (!current) return; this.current = null;
        const ctx = this.ctx, now = ctx.currentTime, end = now + Math.max(0.05, seconds || 0);
        current.out.gain.cancelScheduledValues(now);
        current.out.gain.setValueAtTime(current.out.gain.value, now); current.out.gain.linearRampToValueAtTime(0, end);
        if (current.source) { try { current.source.stop(end + 0.05); } catch (_) {} }
        setTimeout(() => { try { current.out.disconnect(); } catch (_) {} }, (end - now) * 1000 + 200);
    }
    get playing() { return this.current && this.current.id; }
    close() {
        this.stop(0.1);
        const ctx = this.ctx; this.ctx = null;
        if (ctx && ctx.close) setTimeout(() => { try { ctx.close(); } catch (_) {} }, 300);
    }
}

module.exports = { SOUNDS, Player, file };
