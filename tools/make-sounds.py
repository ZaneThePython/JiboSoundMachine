#!/usr/bin/env python3
"""Rebuild soundmachine/resources/sounds/*.ogg from CC0 Freesound recordings.

Each recording is cut to a seamless mono loop (the tail is crossfaded into the head),
levelled to a common loudness, and encoded as Vorbis. Needs ffmpeg and curl."""
import array, math, os, subprocess, sys, urllib.request

RATE = 44100
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'soundmachine', 'resources', 'sounds')
CACHE = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'sm-sounds')

# id, Freesound preview (id_user), start s, loop s, crossfade s, target RMS dBFS
SOURCES = [
    ('rain', '705164_2397507', 10, 60, 4, -22),
    ('ocean', '531015_9818404', 2, 60, 6, -22),
    ('fan', '797668_10938187', 1, 44, 4, -22),
    ('brown', '365932_5857547', 2, 60, 4, -22),
    ('white', '249313_4056007', 0.5, 27, 2, -27),
]


def decode(path, start, seconds):
    raw = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-ss', str(start), '-t', str(seconds), '-i', path,
                          '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return array.array('f', raw)


def seamless(x, n, fade):
    """Loop of n samples: the first `fade` samples blend x[n:] (fading out) into x[:fade] (fading in),
    so the wrap from x[n-1] back to the start continues straight into x[n]."""
    out = x[:n]
    for i in range(fade):
        t = i / fade  # equal-power curves, since the two ends are uncorrelated noise
        out[i] = x[i] * math.sin(t * math.pi / 2) + x[n + i] * math.cos(t * math.pi / 2)
    return out


def level(x, target_db, knee=0.5, ceiling=0.89):
    """Scale to the target RMS; rare loud peaks (close raindrops) are soft-clipped under -1 dBFS.
    Memoryless, so the loop seam stays intact."""
    gain = 10 ** (target_db / 20) / math.sqrt(sum(v * v for v in x) / len(x))
    span = ceiling - knee
    def shape(v):
        a = abs(v * gain)
        return math.copysign(a if a <= knee else knee + span * math.tanh((a - knee) / span), v)
    return array.array('f', map(shape, x))


def main():
    os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)
    for sid, preview, start, seconds, fade_s, target in SOURCES:
        mp3 = os.path.join(CACHE, preview + '.mp3')
        if not os.path.exists(mp3):
            urllib.request.urlretrieve(f'https://cdn.freesound.org/previews/{preview[:3]}/{preview}-hq.mp3', mp3)
        n, fade = int(seconds * RATE), int(fade_s * RATE)
        x = decode(mp3, start, seconds + fade_s)
        assert len(x) >= n + fade, f'{sid}: recording too short'
        loop = level(seamless(x, n, fade), target)
        dest = os.path.join(OUT, sid + '.ogg')
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'f32le', '-ac', '1', '-ar', str(RATE), '-i', '-',
                        '-c:a', 'libvorbis', '-q:a', '3', dest], input=loop.tobytes(), check=True)
        print(f'{sid}.ogg {os.path.getsize(dest)} bytes')


if __name__ == '__main__':
    sys.exit(main())
