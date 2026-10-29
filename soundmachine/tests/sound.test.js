'use strict';
// node tests/sound.test.js  (Node 6 compatible)
const assert = require('assert');
const sounds = require('../sounds'), SleepTimer = require('../sleep');

const fs = require('fs');
assert.deepStrictEqual(sounds.SOUNDS.map(s => s.id), ['rain', 'ocean', 'fan', 'brown', 'white']);
sounds.SOUNDS.forEach(s => assert.strictEqual(fs.readFileSync(sounds.file(s.id)).toString('latin1', 0, 4), 'OggS', s.id + ' is bundled'));

// Fake Web Audio: decodes resolve on the next tick, and node calls are recorded.
function fakeContext(fail) {
    const started = [];
    const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
    return { started: started, ctor: function () {
        this.currentTime = 0; this.destination = {};
        this.createGain = () => ({ gain: param(), connect() {}, disconnect() {} });
        this.createBufferSource = () => ({ connect() {}, start() { started.push(this.buffer); }, stop() {} });
        this.decodeAudioData = (data, ok, bad) => setImmediate(() => fail ? bad(new Error('bad')) : ok({ bytes: data.byteLength }));
    } };
}
const read = () => Buffer.from('OggS-fake');
const rain = sounds.SOUNDS[0], ocean = sounds.SOUNDS[1];

const audio = fakeContext(false), player = new sounds.Player(audio.ctor, read);
const stale = player.play(rain), fresh = player.play(ocean); // second tap before the first decode finishes
Promise.all([stale, fresh]).then(() => {
    assert.strictEqual(audio.started.length, 1, 'only the newest tap plays');
    assert.strictEqual(player.playing, 'ocean');
    const broken = new sounds.Player(fakeContext(true).ctor, read);
    return broken.play(rain).then(() => assert.fail('decode error must reject'), () => {
        assert.strictEqual(broken.playing, null, 'a failed decode clears the playing sound');
        console.log('sound machine tests passed');
    });
}).catch(error => { console.error(error); process.exit(1); });

// Sleep timer only counts while playing; 0 minutes means off.
const t = new SleepTimer();
assert.strictEqual(t.label(), 'Off');
t.set(15, 0, false); assert.strictEqual(t.label(), '15 min'); assert.strictEqual(t.left(0), null);
t.arm(1000, true); assert.strictEqual(t.left(1000), 15 * 60000);
assert.ok(!t.expired(1000 + 15 * 60000 - 1)); assert.ok(t.expired(1000 + 15 * 60000));
t.set(0, 0, true); assert.strictEqual(t.label(), 'Off'); assert.strictEqual(t.left(0), null);
t.set(90, 0, true); assert.strictEqual(t.label(), '1 h 30 min');
t.set(120, 0, true); assert.strictEqual(t.label(), '2 h');

// Clock-style editor steps: hours / tens / ones of minutes, clamped to 0..24 h.
const c = require('../controls');
assert.strictEqual(c.stepMinutes(0, 1, true), 10);
assert.strictEqual(c.stepMinutes(5, 1, false), 5, 'cannot go below zero');
assert.strictEqual(c.stepMinutes(65, 0, false), 5);
assert.strictEqual(c.stepMinutes(c.MAX_MINUTES - 1, 0, true), c.MAX_MINUTES);
assert.deepStrictEqual(c.digits(90), { hours: '1', tens: '3', ones: '0' });
assert.deepStrictEqual(c.digits(7), { hours: '0', tens: '0', ones: '7' });

// Radio slider geometry round-trips and clamps at the ends.
for (let v = 1; v <= 10; v++) assert.strictEqual(c.volumeAt(c.knobX(v, 1, 10), 1, 10), v);
assert.strictEqual(c.volumeAt(0, 1, 10), 1); assert.strictEqual(c.volumeAt(5000, 1, 10), 10);

