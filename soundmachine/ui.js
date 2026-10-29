'use strict';

const path = require('path');
const SOUNDS = require('./sounds').SOUNDS;
const controls = require('./controls');

// Native Jibo face: black background, Proxima Nova labels and stock ActionButtons.
// Each sound has a gray and a cyan button at the same spot; the cyan one shows
// what is playing (the stock pattern for swapping a button's look).
// Two editors are borrowed from stock skills and shown in place of the main controls:
//  - sleep timer: Clock's timer editor (its timeline, chevrons, positions, Set/Cancel)
//  - volume: Radio's volume slider (its timeline and drag geometry)
const GRAY = [0x58586D, 0x282735], CYAN = [0x25F2FB, 0x107799];
const res = name => path.join(__dirname, 'resources', name);
const icon = name => res(name + '.png');
const centre = i => 640 + (i - 2) * 230;
// Clock_Timer_Edit chevron positions: [digit, upX, downX]
const ARROWS = [[0, 248, 296], [1, 547, 595], [2, 707, 755]];

class UI {
    constructor(actions) { this.actions = actions; this.mode = 'main'; this.editMinutes = 0; }
    config(views) {
        const components = [];
        const callback = fn => ({ type: views.ActionData.CALLBACK, data: { callback: fn } });
        const label = (id, x, y, size, font, color, anchor) => components.push({ type: 'Label', id: id, text: '',
            position: { x: x, y: y }, targetAnchor: anchor || { x: 0.5, y: 0.5 },
            style: { fontFamily: font, fontSize: size, fill: color || '#FFFFFF', fontWeight: size >= 100 ? 'bold' : 'normal' } });
        const button = (id, iconSrc, colors, x, y, fn) => components.push({ type: 'ActionButton', id: id, iconSrc: iconSrc,
            colors: colors, position: { x: x, y: y }, transform: { scaleX: 0.5, scaleY: 0.5 }, action: callback(fn) });

        // Main screen
        label('status', 'CENTER', 95, 45, 'Proxima Nova Soft');
        SOUNDS.forEach((sound, i) => {
            button(sound.id, icon(sound.id), GRAY, centre(i) - 66, 200, () => this.actions.toggle(sound));
            button(sound.id + 'On', icon(sound.id), CYAN, centre(i) - 66, 200, () => this.actions.toggle(sound));
            label(sound.id + 'Caption', centre(i), 370, 36, 'Proxima Nova Light');
        });
        button('volumeButton', icon('volume-button'), GRAY, 500 - 66, 470, () => this.actions.openVolume());
        label('volumeCaption', 500, 640, 36, 'Proxima Nova Light');
        button('sleep', icon('sleep'), GRAY, 780 - 66, 470, () => this.actions.openSleep());
        label('sleepCaption', 780, 640, 36, 'Proxima Nova Light');

        // Volume panel (Radio)
        label('volumeTitle', 'CENTER', 55, 50, 'Proxima Nova Soft');
        components.push({ id: 'volume', type: 'Clip', assets: [{ id: 'volume', src: res('volume/volume.js'), type: 'timeline' }],
            position: { x: 0, y: 0 } });

        // Sleep timer editor (Clock's timerEdit.json, same positions)
        components.push({ id: 'timerEdit', type: 'Clip', assets: [{ id: 'timerEdit', src: res('Clock_Timer_Edit.js'), type: 'timeline' }] });
        label('sleepTitle', 256, 50, 120, 'Proxima Nova Soft', undefined, { x: 0, y: 0 });
        ARROWS.forEach(a => {
            components.push({ id: 'arrowUp' + a[0], type: 'Button', assets: [{ id: 'chevron_up', src: icon('chevron'), type: 'texture' }],
                position: { x: a[1], y: 276 }, action: callback(() => this.step(a[0], true)) });
            components.push({ id: 'arrowDown' + a[0], type: 'Button', assets: [{ id: 'chevron_down', src: icon('chevron'), type: 'texture' }],
                position: { x: a[2], y: 590 }, action: callback(() => this.step(a[0], false)) });
        });
        button('set', 'jibo://resources/actionIcons/ok.png', 'confirm', 1068, 212, () => this.actions.setSleep(this.editMinutes));
        label('setCaption', 1132, 384, 45, 'Proxima Nova Light');
        button('cancel', 'jibo://resources/actionIcons/cancel.png', [0x545469, 0x2A2938], 1068, 468, () => this.actions.closeEditor());
        label('cancelCaption', 1132, 630, 45, 'Proxima Nova Light');

        return { viewConfig: { type: 'View', id: 'soundmachine', category: 'gui', ignoreSwipeDown: true, transitionStageOnly: true },
            componentConfigs: components };
    }
    decorate(view, PIXI, volumeApi) {
        this.view = view; this.volumeApi = volumeApi;
        const background = new PIXI.Graphics(); background.beginFill(0x000000); background.drawRect(0, 0, 1280, 720); background.endFill();
        view.stage.addChildAt(background, 0);
        // Clock's chevron hit areas and down-arrow rotation.
        ARROWS.forEach(a => {
            view.getComponentById('arrowUp' + a[0]).setupHitArea(new PIXI.Rectangle(-50, -37, 150, 150));
            const down = view.getComponentById('arrowDown' + a[0]);
            down.setupHitArea(new PIXI.Rectangle(-50, -37, 150, 150)); down.display.rotation = Math.PI;
        });
        this.timerClip = view.getComponentById('timerEdit').movieClip;
        // Radio's slider: drag (or tap) along the bar; a tap away from it closes the panel.
        const slider = this.slider = view.getComponentById('volume').movieClip;
        slider.interactive = true; slider.hitArea = new PIXI.Rectangle(0, 0, 1280, 720);
        const move = event => this.drag(event.data.global.x);
        slider.on('mousedown', event => {
            if (this.mode !== 'volume') return;
            const y = event.data.global.y;
            if (y < 200 || y > 500) { this.actions.closeEditor(); return; }
            this.dragging = true; move(event); slider.on('mousemove', move);
            slider.once('mouseup', () => {
                slider.off('mousemove', move); this.dragging = false;
                this.actions.setVolume(this.dragValue);
            });
        });
    }
    drag(x) {
        const api = this.volumeApi;
        this.dragValue = controls.volumeAt(x, api.MIN_VOLUME, api.MAX_VOLUME);
        this.knob(this.dragValue);
        this.actions.touchVolume();
    }
    knob(value) {
        const api = this.volumeApi, s = this.slider;
        s.button.x = s.blueBar.x = controls.knobX(value, api.MIN_VOLUME, api.MAX_VOLUME);
        s.button.value.text = String(Math.round(value));
    }
    step(digit, up) {
        this.editMinutes = controls.stepMinutes(this.editMinutes, digit, up);
        this.digits();
    }
    digits() {
        const d = controls.digits(this.editMinutes), clip = this.timerClip;
        clip.hourCounter.text = d.hours; clip.minuteTensCounter.text = d.tens; clip.minuteOnesCounter.text = d.ones;
    }
    // mode: 'main' | 'volume' | 'sleep'
    setMode(mode, minutes) {
        this.mode = mode;
        if (mode === 'sleep') { this.editMinutes = minutes || 0; this.digits(); }
    }
    text(id, value) { const c = this.view.getComponentById(id); if (c && c.text !== value) c.text = value; }
    show(id, visible) { const c = this.view.getComponentById(id); c.display.visible = visible; if (c.lockInput) c.lockInput(!visible); }
    render(playing, sleep, now) {
        if (!this.view) return;
        const main = this.mode === 'main', vol = this.mode === 'volume', edit = this.mode === 'sleep';
        ['status', 'volumeButton', 'volumeCaption', 'sleep', 'sleepCaption'].forEach(id => this.show(id, main));
        SOUNDS.forEach(s => {
            this.show(s.id, main && s.id !== playing); this.show(s.id + 'On', main && s.id === playing);
            this.show(s.id + 'Caption', main); this.text(s.id + 'Caption', s.name);
        });
        ['volumeTitle', 'volume'].forEach(id => this.show(id, vol));
        ['timerEdit', 'sleepTitle', 'set', 'setCaption', 'cancel', 'cancelCaption'].forEach(id => this.show(id, edit));
        ARROWS.forEach(a => { this.show('arrowUp' + a[0], edit); this.show('arrowDown' + a[0], edit); });

        const volume = Math.round(this.volumeApi.currentVolume);
        if (main) {
            const sound = SOUNDS.filter(s => s.id === playing)[0], left = sleep.left(now);
            this.text('status', !sound ? 'Tap a sound to start' : left === null ? sound.name : sound.name + ' · stops in ' + clock(left));
            this.text('volumeCaption', 'Volume ' + volume);
            this.text('sleepCaption', 'Sleep: ' + sleep.label());
        } else if (vol) {
            this.text('volumeTitle', 'Volume');
            if (!this.dragging) this.knob(volume);
        } else {
            this.text('sleepTitle', 'Sleep after?'); this.text('setCaption', 'Set'); this.text('cancelCaption', 'Cancel');
        }
    }
}

function clock(ms) {
    const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = ('0' + s % 60).slice(-2);
    return h ? h + ':' + ('0' + m).slice(-2) + ':' + sec : m + ':' + sec;
}

UI.clock = clock;
module.exports = UI;
