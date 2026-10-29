'use strict';

const jibo = require('jibo'), BeSkill = require('@be/be-framework').BeSkill;
const lifecycle = require('./touch-lifecycle'), UI = require('./ui'), SleepTimer = require('./sleep');
const Player = require('./sounds').Player;

const SLEEP_FADE = 10;     // seconds of fade-out when the sleep timer ends
const VOLUME_IDLE = 4000;  // the volume panel closes this long after the last touch, like Radio's

class SoundMachineSkill extends BeSkill {
    constructor() { super(...arguments); this.generation = 0; this.view = null; this.closing = null; }
    open() {
        if (this.view) { this.close(error => { if (!error) this.open(); }); return; }
        const generation = ++this.generation, views = jibo.face.views;
        this.closing = null; this.leaving = false; this.sleep = new SleepTimer(); this.volumeTouched = 0;
        this.player = new Player(global.AudioContext || global.webkitAudioContext);
        const mode = (name, minutes) => { this.ui.setMode(name, minutes); this.render(); };
        this.ui = new UI({
            toggle: sound => {
                if (this.player.playing === sound.id) this.player.stop(1);
                else {
                    try { this.player.play(sound).catch(() => this.render()); } // player already stopped itself
                    catch (_) { this.player.stop(0); }
                }
                this.sleep.arm(Date.now(), !!this.player.playing); this.render();
            },
            openSleep: () => mode('sleep', this.sleep.minutes),
            setSleep: minutes => { this.sleep.set(minutes, Date.now(), !!this.player.playing); mode('main'); },
            openVolume: () => { this.volumeTouched = Date.now(); mode('volume'); },
            touchVolume: () => { this.volumeTouched = Date.now(); },
            setVolume: value => {
                this.volumeTouched = Date.now();
                try { jibo.volume.changeVolume('volumeToValue', value); } catch (_) {}
                this.render();
            },
            closeEditor: () => mode('main')
        });
        const view = this.view = lifecycle.prepareView(views.createView('View', this.ui.config(views)));
        view.addAction(views.ActionData.CALLBACK, { callback: () => this.leave() }, true, false, views.GESTURE.SWIPE_DOWN);
        const current = () => generation === this.generation && !this.leaving && !!this.view;
        views.changeView({ addView: view, transitionOpen: views.TRANSITION.IN, transitionClose: views.TRANSITION.OUT },
            () => { if (current()) this.interval = setInterval(() => this.tick(), 500); },
            () => { if (current()) this.leave(); },
            () => { if (current()) { this.ui.decorate(view, global.PIXI, jibo.volume); this.render(); } });
    }
    tick() {
        const now = Date.now();
        if (this.sleep.expired(now)) { this.player.stop(SLEEP_FADE); this.sleep.arm(now, false); }
        if (this.ui && this.ui.mode === 'volume' && !this.ui.dragging && now - this.volumeTouched > VOLUME_IDLE) this.ui.setMode('main');
        this.render();
    }
    render() { if (this.ui) this.ui.render(this.player.playing, this.sleep, Date.now()); }
    leave() { if (this.leaving) return; this.leaving = true; this.exit({ noElementsOfSurprise: true }); }
    close(done) {
        done = done || (() => {});
        if (this.closing) {
            if (this.closing.finished) done(this.closing.error); else this.closing.callbacks.push(done);
            return;
        }
        const closing = this.closing = { finished: false, error: null, callbacks: [done] };
        ++this.generation; this.leaving = true; clearInterval(this.interval); this.interval = null;
        if (this.player) { try { this.player.close(); } catch (_) {} }
        lifecycle.closeView(jibo.face.views, jibo.face.tween, this.view, require('timers'), 'soundmachine', error => {
            closing.finished = true; closing.error = error || null;
            if (!error) { this.view = null; this.ui = null; }
            closing.callbacks.splice(0).forEach(callback => callback(closing.error));
        });
    }
    destroy(done) { this.close(error => super.destroy(baseError => done(error || baseError))); }
}

module.exports = SoundMachineSkill;
