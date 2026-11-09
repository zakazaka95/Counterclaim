# Counterclaim — editable demo film

A 42-second product film following one real Counterclaim case from a frozen
agreement to a GenLayer ruling and a cooperatively signed Yellow sandbox closure.
The native interface captures are recorded evidence, not a simulated success flow.

## Deliverables

After rendering, `out/counterclaim-42s.mp4` is the landscape master (1920×1080,
30 fps, H.264/AAC). `out/counterclaim-42s-sfx-only.mp4` keeps the same picture and
tactile sound effects without music. `out/counterclaim-poster.png` is a still cover.
Generated exports are intentionally excluded from Git.

The complete editable project is here: React/Remotion source, pinned dependency
lockfile, original audio stems, actual interface PNGs, recorded public proof,
official brand files, fonts and their licenses. No hosted render service is needed.

## Preview and export

Use Node.js 24 and install the exact dependency versions:

```sh
npm ci
npm run typecheck
npm run dev
```

The preview opens at `http://localhost:5201/CounterclaimFilm`. The renderer uses
Remotion 4.0.484 with a compatible Chrome Headless Shell. Set
`REMOTION_BROWSER_EXECUTABLE` to its executable on another computer; the local
default is recorded in `scripts/runtime.mjs`. The tested browser is Chrome 149.

Set `FFMPEG_EXECUTABLE` to a full FFmpeg build with FLAC decoding and AAC encoding
when exporting on another computer. Then run:

```sh
npm run qa:stills
npm run render
```

Rendering first revalidates the archived evidence and capture hashes. An absent
real ruling, mismatched receipt, unclosed session or changed screenshot prevents a
final export. It does not create any network transactions. Review stills in
`out/qa/` before encoding; use `npm run render -- --skip-stills` once those match.
To regenerate only the static cover without touching either movie, use
`npm run render -- --poster-only`.

## Recorded result and limits

The GenLayer case is **0**. Its three frozen milestones have weights 40/35/25.
The actual decision accepts the landing page and integration guide, but rejects a
TODO document as delivery of an executable regression suite. The resulting split
is **75 seller / 25 buyer nonmonetary demo credits**.

The recorded Yellow sandbox session reaches version 4, closed, with both participant
signatures. Its actual token allocation array is empty. **Zero funds moved.**
GenLayer supplies the judgment; both cooperative agents authorize the Yellow
update. This demo does not claim unilateral financial enforcement or a payment.

`public/recorded-demo-proof.json` is the archived source of truth.
`public/film-evidence.json` contains the allowlisted values displayed by the film.
`public/footage/*-capture.json` records the actual phase, time, native selector and
PNG hash. The TODO document was opened read-only after closure and compared to
the exact frozen artifact text; its contents are unchanged from the judged case.
The film edits time but does not invent transaction results or modify evidence.

To ingest an updated genuine record deliberately:

```sh
node scripts/ingest-proof.mjs ../proof/demo-proof.json
```

Do not replace archived captures with mockups or placeholders while retaining the
same capture manifests. `scripts/capture-app.mjs` can record the actual app, but
each stage checks the real coordinator state and does not replay a transaction.

## Sound and asset provenance

The restrained score and tactile effects are original, deterministic procedural
compositions for this exact timeline. Lossless FLAC stems are included in
`public/audio/`; no third-party music or stock samples are used. Audio can be
regenerated with Python, NumPy, SciPy and pyloudnorm using
`scripts/compose-audio.py`, followed by `node scripts/compress-audio.mjs`.
The checked local Python/FFmpeg paths are recorded in those scripts.

`ASSET-PROVENANCE.json` identifies the official Internet Court, GenLayer and Yellow
marks and source downloads by URL and SHA-256. The marks remain their owners'
trademarks. The film is an independent partner demo. Instrument Serif and DM Sans
include their SIL Open Font License files. See `THIRD-PARTY-NOTICES.md` for the
attributed Apache-2.0 reference helper. Downloaded Yellow art is retained as source
reference, but the film itself uses the official marks and the working product UI.

## Review records

`PRODUCTION.md` holds the brief, shot plan and visual rules. The full encoded
checks are produced by `scripts/qa-film.py`: frame count and duration, complete
decode, black-frame screening, audio sample peak/loudness, and source-to-encoded
sound alignment. These require OpenCV, Pillow, NumPy, SciPy and pyloudnorm.
They supplement human visual/motion and listening review, not substitute for it.

Reproduce the integration: https://github.com/zakazaka95/Counterclaim
