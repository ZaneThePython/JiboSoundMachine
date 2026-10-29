'use strict';

const duration = require('./controls').duration;

// Sleep timer set to any length (0 = off) in the Clock-style editor.
class SleepTimer {
    constructor() { this.minutes = 0; this.endsAt = null; }
    set(minutes, now, playing) { this.minutes = minutes; this.arm(now, playing); }
    // (Re)start the countdown from now; only counts while something plays.
    arm(now, playing) { this.endsAt = this.minutes && playing ? now + this.minutes * 60000 : null; }
    left(now) { return this.endsAt === null ? null : Math.max(0, this.endsAt - now); }
    expired(now) { return this.endsAt !== null && now >= this.endsAt; }
    label() { return duration(this.minutes); }
}

module.exports = SleepTimer;
