'use strict';

// Pure helpers for the two borrowed editors, kept separate so they can be tested.

// Clock's timer editor: arrows step the total by 60, 10 or 1 minutes (hours,
// tens of minutes, ones of minutes), clamped to 0..24 hours.
const STEPS = [60, 10, 1], MAX_MINUTES = 24 * 60;
function stepMinutes(total, digit, up) {
    const step = STEPS[digit];
    if (up) return Math.min(MAX_MINUTES, total + step);
    return total >= step ? total - step : total;
}
// { hours: '1', tens: '3', ones: '0' } for the timeline's three counters.
function digits(total) {
    const minutes = ('0' + total % 60).slice(-2);
    return { hours: String(Math.floor(total / 60)), tens: minutes[0], ones: minutes[1] };
}

// Radio's volume slider geometry: the knob runs from x=140 across 1000 pixels.
const MIN_POS = 140, SLIDER_WIDTH = 1000;
function volumeAt(x, min, max) {
    const clamped = Math.max(MIN_POS, Math.min(MIN_POS + SLIDER_WIDTH, x));
    return min + Math.round((clamped - MIN_POS) / (SLIDER_WIDTH / (max - min)));
}
function knobX(volume, min, max) { return MIN_POS + (volume - min) / (max - min) * SLIDER_WIDTH; }

function duration(total) {
    if (!total) return 'Off';
    const h = Math.floor(total / 60), m = total % 60;
    return (h ? h + ' h' : '') + (h && m ? ' ' : '') + (m ? m + ' min' : '');
}

module.exports = { stepMinutes, digits, volumeAt, knobX, duration, MAX_MINUTES };
