"""Original royalty-free backing track for NextOwner ads, synthesized from scratch.
usage: python3 music.py SEED DURATION_SECONDS OUT.wav [cue,cue,...]
Cues are scene cut times in seconds; each gets a whoosh. The last cue gets a riser + impact."""
import sys, wave, numpy as np

SR = 44100
seed, dur, out = int(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
cues = [float(c) for c in sys.argv[4].split(',')] if len(sys.argv) > 4 and sys.argv[4] else []
rng = np.random.default_rng(seed)
BPM = 120.0
beat = 60 / BPM
n = int(SR * dur)
L = np.zeros(n); R = np.zeros(n)

def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= n: return
    s = sig[: n - i] * gain
    L[i:i + len(s)] += s * (1 - max(0, pan))
    R[i:i + len(s)] += s * (1 + min(0, pan))

def env(length, a=0.005, d=0.2):
    t = np.arange(int(length * SR)) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)

def kick():
    t = np.arange(int(0.45 * SR)) / SR
    f = 45 + 95 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 1.1

def noise(length):
    return rng.standard_normal(int(length * SR))

def hp(x, a=0.85):  # crude high-pass
    y = np.empty_like(x); p = 0; px = 0
    for i, v in enumerate(x):
        p = a * (p + v - px); px = v; y[i] = p
    return y

def lp(x, a):  # one-pole low-pass, a in (0,1), smaller = darker
    y = np.empty_like(x); p = 0.0
    for i, v in enumerate(x):
        p += a * (v - p); y[i] = p
    return y

HAT = lp(hp(noise(0.06)), 0.5) * env(0.06, 0.001, 0.018) * 0.22
CLAP = hp(noise(0.22), 0.6) * env(0.22, 0.002, 0.07) * 0.55
KICK = kick()

# Key + progression (semitones from root)
root = 45 + int(rng.integers(0, 7))          # A2..E3
progs = [[0, 8, 3, 10], [0, 5, 8, 7], [9, 5, 0, 7], [0, 7, 9, 5], [0, 3, 8, 10]]
prog = progs[int(rng.integers(0, len(progs)))]
minor = int(rng.integers(0, 2))
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)

def saw(freq, length, harm=8):
    t = np.arange(int(length * SR)) / SR
    return sum(np.sin(2 * np.pi * freq * k * t) / k for k in range(1, harm + 1))

def pad(chord, length):
    t = np.arange(int(length * SR)) / SR
    s = sum(np.sin(2 * np.pi * mtof(m) * t + 0.3 * np.sin(2 * np.pi * 0.3 * t)) +
            0.5 * np.sin(2 * np.pi * mtof(m) * 2.003 * t) for m in chord)
    e = np.minimum(1, t / 0.25) * np.minimum(1, (length - t) / 0.2).clip(0, 1)
    return s * e * 0.07

bar = 4 * beat
nbars = int(np.ceil(dur / bar))
first_cut = cues[0] if cues else 0
for b in range(nbars):
    deg = prog[b % 4]
    third = 3 if minor else 4
    chord = [root + 12 + deg, root + 12 + deg + third, root + 12 + deg + 7, root + 24 + deg]
    add(pad(chord, bar), b * bar, 1.0, 0)
    for e8 in range(8):                       # driving 8th-note bass
        t = b * bar + e8 * beat / 2
        if t < first_cut * 0.5: continue
        note = root - 12 + deg + (12 if e8 in (3, 7) else 0)
        s = lp(saw(mtof(note), beat / 2 * 0.9, 6), 0.08) * env(beat / 2 * 0.9, 0.004, 0.18) * 0.32
        add(s, t)
    for q in range(4):
        t = b * bar + q * beat
        add(KICK, t, 0.9)
        add(HAT, t + beat / 2, 0.8, 0.3)
        if q in (1, 3) and t >= first_cut: add(CLAP, t, 0.8, -0.1)
    for s16 in range(16):                       # light 16th hats in the busy middle
        t = b * bar + s16 * beat / 4
        if first_cut < t < (cues[-1] if cues else dur) and s16 % 2: add(HAT, t, 0.35, -0.3)

# Sidechain duck on every beat (classic pumping)
t = np.arange(n) / SR
ph = (t % beat) / beat
duck = 0.45 + 0.55 * np.minimum(1, ph / 0.35)
L *= duck; R *= duck

def whoosh(length=0.5):
    x = noise(length)
    k = np.linspace(0.02, 0.5, len(x))
    y = np.empty_like(x); p = 0
    for i, v in enumerate(x):
        p += k[i] * (v - p); y[i] = p
    e = np.sin(np.linspace(0, np.pi, len(x))) ** 2
    return y * e * 0.9

for c in cues[:-1]:
    add(whoosh(0.45), max(0, c - 0.3), 0.8, float(rng.uniform(-0.4, 0.4)))
if cues:
    last = cues[-1]
    rl = 1.5
    r = noise(rl) * np.linspace(0, 1, int(rl * SR)) ** 2
    add(hp(r, 0.95) * 0.3, max(0, last - rl))
    add(kick(), last, 1.4)
    add(lp(noise(1.2), 0.03) * env(1.2, 0.002, 0.35), last, 1.2)
    # sparkle on the logo
    sp = sum(np.sin(2 * np.pi * mtof(root + 36 + d) * np.arange(int(1.2 * SR)) / SR) for d in (0, 7, 12)) * env(1.2, 0.002, 0.4) * 0.06
    add(sp, last + 0.05, 1.0, 0.2)

# Fade out and master
fo = int(0.6 * SR)
L[-fo:] *= np.linspace(1, 0, fo); R[-fo:] *= np.linspace(1, 0, fo)
mix = np.stack([L, R], 1)
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.6) * 0.89
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('music', out, 'root', root, 'prog', prog, 'minor', minor)
