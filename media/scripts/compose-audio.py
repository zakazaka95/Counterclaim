"""Original deterministic score and tactile transition stems; no third-party samples."""
import hashlib
import json
import pathlib
import wave

import numpy as np
from scipy.signal import butter, sosfilt
import pyloudnorm as pyln

ROOT = pathlib.Path(__file__).resolve().parents[1]
SR = 48000
DURATION = 42.0
N = int(SR * DURATION)
RNG = np.random.default_rng(101261109)


def lowpass(values, hz):
    return sosfilt(butter(2, hz, fs=SR, output="sos"), values)


def bandpass(values, lo, hi):
    return sosfilt(butter(2, [lo, hi], fs=SR, btype="bandpass", output="sos"), values)


def place(target, at, value, gain=1.0, pan=0.0):
    start = int(round(at * SR))
    count = min(len(value), len(target) - start)
    if start < 0 or count <= 0:
        return
    mono = value[:count] * gain
    target[start:start + count, 0] += mono * np.sqrt((1.0 - pan) / 2.0)
    target[start:start + count, 1] += mono * np.sqrt((1.0 + pan) / 2.0)


def write(name, values):
    values = np.asarray(values, dtype=np.float64)
    peak = float(np.max(np.abs(values)))
    assert peak < 1.0, "Clipped source stem"
    pcm = (values * 32767.0).round().astype("<i2")
    folder = ROOT / "public" / "audio"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / name
    with wave.open(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SR)
        output.writeframes(pcm.tobytes())
    return {"file": "public/audio/" + name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "seconds": DURATION, "sample_rate": SR, "sample_peak_dbfs": float(20 * np.log10(max(1e-12, peak))),
            "integrated_lufs": float(pyln.Meter(SR).integrated_loudness(values))}


def main():
    score = np.zeros((N, 2), dtype=np.float64)
    sfx = np.zeros_like(score)
    t = np.arange(N) / SR

    # Warm, restrained minor-ninth bed; no game-like arpeggio or notification tones.
    for channel in range(2):
        pad = np.zeros(N)
        for index, frequency in enumerate([146.8324, 174.6141, 220.0, 261.6256, 329.6276]):
            drift = 1 + (channel * 2 - 1) * (0.0007 + index * 0.00012)
            phase = 2 * np.pi * frequency * drift * t
            pad += (np.sin(phase + index * .71) + .16 * np.sin(phase * 2 + .2)) / (5 + index)
        pad = lowpass(pad, 1400)
        breath = .68 + .16 * np.sin(2 * np.pi * .055 * t + channel * .4)
        fade = np.minimum(1, t / 1.4) * np.minimum(1, (DURATION - t) / 2.0)
        score[:, channel] += pad * breath * fade * .16

    # 150 BPM eighth-note grid, heard as a deliberate 75 BPM half-time pulse.
    for beat, at in enumerate(np.arange(4.0, 39.8, .8)):
        q = np.arange(int(.44 * SR)) / SR
        frequency = 44.0 + 88.0 * np.exp(-q * 42)
        phase = 2 * np.pi * np.cumsum(frequency) / SR
        kick = np.sin(phase) * np.exp(-q * 12) * (1 - np.exp(-q * 600))
        kick += lowpass(RNG.normal(0, 1, len(q)), 3000) * np.exp(-q * 120) * .035
        intensity = .7 if 16.2 <= at < 22.2 else .9 if at < 10.2 else 1.0
        place(score, float(at), kick, .24 * intensity)

        # Short bass notes sit under the physical low-end pulse.
        freq = [73.4162, 65.4064, 58.2705, 87.3071][(beat // 8) % 4]
        bass = (np.sin(2 * np.pi * freq * q) + .17 * np.sin(4 * np.pi * freq * q))
        bass *= (1 - np.exp(-q * 60)) * np.exp(-q * 7)
        place(score, float(at + .05), bass, .10 * intensity)

    for index, at in enumerate(np.arange(4.4, 39.0, .8)):
        q = np.arange(int(.22 * SR)) / SR
        body = .25 * np.sin(2 * np.pi * 178 * q) * np.exp(-q * 35)
        air = bandpass(RNG.normal(size=len(q)), 950, 8500) * np.exp(-q * 28)
        hit = (body + air * .37) * (1 - np.exp(-q * 1000))
        gain = .05 if 16.2 <= at < 22.2 else .085
        place(score, float(at), hit, gain, .08 if index % 2 else -.08)

    for index, at in enumerate(np.arange(10.2, 39.0, .2)):
        q = np.arange(int(.075 * SR)) / SR
        hat = bandpass(RNG.normal(size=len(q)), 6000, 14000) * np.exp(-q * 85)
        gain = .017 if index % 4 else .029
        if 16.2 <= at < 22.2:
            gain *= .5
        place(score, float(at), hat, gain, .24 if index % 2 else -.24)

    # Score resolves before the resting final brand card ends.
    score *= np.clip((42 - t) / 2.1, 0, 1)[:, None]
    score = pyln.normalize.loudness(score, pyln.Meter(SR).integrated_loudness(score), -19.0)
    score *= min(1.0, .78 / np.max(np.abs(score)))

    # Transition cues share the exact frame clock. All noises are generated here.
    cues = []
    for at, label, strength in [(4.0,"agreement reveal",.22),(10.2,"evidence cut",.18),(12.2,"actual TODO artifact opens",.12),
                                (16.2,"verdict entrance",.25),(24.2,"Yellow arrival",.23),
                                (31.2,"proof record",.18),(36.6,"brand close",.27)]:
        q = np.arange(int(.36 * SR)) / SR
        frequency = 57 + 25 * np.exp(-q * 24)
        thud = np.sin(2 * np.pi * np.cumsum(frequency) / SR) * np.exp(-q * 18)
        paper = bandpass(RNG.normal(size=len(q)), 400, 5000) * np.exp(-q * 36) * .18
        place(sfx, at, (thud + paper) * (1 - np.exp(-q * 1200)), strength)
        cues.append({"frame": int(round(at * 30)), "event": label, "kind": "original tactile impact"})
        # A short airy approach ends exactly at the cut, rather than trailing over UI.
        count = int(.34 * SR)
        u = np.arange(count) / count
        whoosh = bandpass(RNG.normal(size=count), 650, 7000) * np.sin(np.pi * u) ** 1.6
        place(sfx, at - .34, whoosh, .033, -.28)

    # One sustained paper/rail sweep during the continuous verdict-to-session pan.
    count = int(2 * SR)
    u = np.arange(count) / count
    friction = bandpass(RNG.normal(size=count), 200, 3500) * np.sin(np.pi * u) ** 1.5
    place(sfx, 22.2, friction, .036)
    cues.append({"frame": 666, "duration_frames": 60, "event": "verdict digest carried into Yellow", "kind": "original filtered paper/rail sweep"})
    # The initial docket settles; no fake UI-click or signature-success sound is added.
    q = np.arange(int(.18 * SR)) / SR
    paper = bandpass(RNG.normal(size=len(q)), 250, 6000) * np.exp(-q * 35)
    place(sfx, .73, paper, .06)
    cues.append({"frame": 22, "event": "opening paper settles", "kind": "original paper texture"})
    sfx *= 2.0 * min(1.0, .55 / max(1e-12, np.max(np.abs(sfx))))
    mix = score * .65 + sfx * .7
    mix = pyln.normalize.loudness(mix, pyln.Meter(SR).integrated_loudness(mix), -17.0)
    mix *= min(1.0, .88 / max(1e-12, np.max(np.abs(mix))))
    records = [write("score.wav", score), write("sfx.wav", sfx), write("mix.wav", mix)]
    manifest = {"created_date": "2026-11-09", "creator": "Original procedural composition for Counterclaim", "third_party_samples": False,
                "sample_clock": "48000 Hz stereo PCM; exact 42 seconds", "seed": 101261109,
                "music_grid": "150 BPM eighth-note grid / 75 BPM half-time pulse", "cues": sorted(cues, key=lambda x:x["frame"]), "files": records,
                "verification": "Source PCM loudness and peaks measured. Final encoded alignment and listening review are separate checks."}
    (ROOT / "AUDIO-PROVENANCE.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(records, indent=2))


if __name__ == "__main__":
    main()
