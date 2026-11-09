"""Inspect encoded Counterclaim footage, all frames, source-audio alignment and metadata."""
import hashlib
import json
import os
import pathlib
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw
import pyloudnorm as pyln
from scipy.signal import correlate

ROOT = pathlib.Path(__file__).resolve().parents[1]
VIDEO = ROOT / "out" / "counterclaim-42s.mp4"
FFMPEG = pathlib.Path(os.environ.get("FFMPEG_EXECUTABLE", "C:/Users/yyzar/.codex/toolchains/motion-studio/python/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"))
FFPROBE = pathlib.Path(os.environ.get("FFPROBE_EXECUTABLE", str(ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe")))


def main():
    probe = subprocess.run([str(FFPROBE), "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", str(VIDEO)], check=True, capture_output=True, text=True)
    metadata = json.loads(probe.stdout)
    stream = next(s for s in metadata["streams"] if s["codec_type"] == "video")
    audio_meta = next(s for s in metadata["streams"] if s["codec_type"] == "audio")
    assert int(stream["width"]) == 1920 and int(stream["height"]) == 1080
    assert int(stream["nb_read_frames"]) == 1260 and stream["avg_frame_rate"] == "30/1"
    assert abs(float(stream["duration"]) - 42.0) < .001
    assert audio_meta["codec_name"] == "aac" and int(audio_meta["sample_rate"]) == 48000
    assert float(audio_meta.get("start_time", 0)) == 0.0

    out = ROOT / "out" / "encoded-qa"
    out.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(VIDEO))
    choose = set(range(0, 1260, 60)) | {119, 120, 305, 306, 365, 366, 390, 485, 486, 665, 666, 695, 725, 726, 935, 936, 1097, 1098, 1259}
    frames = []
    diffs = []
    lows = []
    previous = None
    index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        small = cv2.resize(frame, (320, 180), interpolation=cv2.INTER_AREA)
        lows.append(float(np.mean(small)))
        if previous is not None:
            diffs.append({"frame": index, "mean_absolute_rgb_change": float(np.mean(cv2.absdiff(small, previous)))})
        previous = small
        if index in choose:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            name = "f%04d.jpg" % index
            Image.fromarray(rgb).save(out / name, quality=94)
            frames.append((index, Image.fromarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB))))
        index += 1
    cap.release()
    assert index == 1260 and min(lows) > 5, "Decoded frame count or black-frame check failed"
    cols, tilew, tileh = 5, 384, 240
    contact = Image.new("RGB", (cols * tilew, ((len(frames) + cols - 1) // cols) * tileh), "#282920")
    draw = ImageDraw.Draw(contact)
    for slot, (number, image) in enumerate(frames):
        x, y = (slot % cols) * tilew, (slot // cols) * tileh
        image = image.resize((tilew, 216), Image.Resampling.LANCZOS)
        contact.paste(image, (x, y))
        draw.text((x + 8, y + 221), "f%04d / %.2fs" % (number, number / 30), fill="white")
    contact.save(out / "encoded-contact-sheet.jpg", quality=94)

    decoded = subprocess.run([str(FFMPEG), "-v", "error", "-i", str(VIDEO), "-vn", "-f", "f32le", "-acodec", "pcm_f32le", "-ar", "48000", "-ac", "2", "pipe:1"], check=True, capture_output=True).stdout
    actual = np.frombuffer(decoded, dtype="<f4").reshape(-1, 2).astype(float)
    source = subprocess.run([str(FFMPEG), "-v", "error", "-i", str(ROOT / "public/audio/mix.flac"), "-f", "f32le", "-acodec", "pcm_f32le", "-ar", "48000", "-ac", "2", "pipe:1"], check=True, capture_output=True).stdout
    expected = np.frombuffer(source, dtype="<f4").reshape(-1, 2).astype(float)
    alignments = []
    for moment in [4.0, 12.2, 16.2, 24.2, 36.6]:
        start, end = int((moment - .2) * 48000), int((moment + .45) * 48000)
        a, b = actual[start:end].mean(axis=1), expected[start:end].mean(axis=1)
        corr = correlate(a, b, mode="full", method="fft")
        center = len(b) - 1
        offset = int(np.argmax(corr[center - 4096:center + 4097]) - 4096)
        alignments.append({"source_event_seconds": moment, "encoded_lag_samples": offset, "encoded_lag_frames": offset / 1600})
    assert max(abs(row["encoded_lag_samples"]) for row in alignments) <= 16, "Encoded audio has a systematic timing shift"
    peak = float(np.max(np.abs(actual)))
    assert peak < 1.0, "Encoded audio clips"
    meter = pyln.Meter(48000)
    loudness = float(meter.integrated_loudness(actual))
    assert -20 <= loudness <= -14, "Unexpected delivery loudness"
    nominal = {120, 306, 366, 486, 936, 1098}
    offcut = [row for row in diffs if all(abs(row["frame"] - cut) > 4 for cut in nominal)]
    report = {"file": str(VIDEO.relative_to(ROOT)).replace("\\", "/"), "sha256": hashlib.sha256(VIDEO.read_bytes()).hexdigest(),
              "decoded_frames": index, "width": 1920, "height": 1080, "fps": 30, "video_seconds": float(stream["duration"]),
              "format_seconds": float(metadata["format"]["duration"]), "minimum_thumbnail_mean": min(lows),
              "sample_peak_dbfs": float(20 * np.log10(peak)), "integrated_lufs": loudness,
              "audio_alignment": alignments, "largest_noncut_changes_for_visual_review": sorted(offcut, key=lambda x:x["mean_absolute_rgb_change"], reverse=True)[:12],
              "contact_sheet": "out/encoded-qa/encoded-contact-sheet.jpg", "review_boundary": "Full decode and measured checks; independent visual/motion review is separate from these metrics."}
    (ROOT / "out/encoded-qa.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
