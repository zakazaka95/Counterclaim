# Edit and render the recorded product film

The project is in `media/`. Its source, official marks, licensed fonts, actual UI
captures, immutable proof and original compressed audio stems are committed.
The render reads the recorded proof, not a live changing API response. It refuses
missing or mismatched proof, missing captures, an unclosed session or an allocation
that does not conserve the agreed 100 demo credits.

```sh
npm --prefix media ci
npm --prefix media run typecheck
npm --prefix media run dev
```

Open http://localhost:5201/CounterclaimFilm. The preview is editable Remotion,
not the final encoded MP4. The exact story and source boundaries are documented
in `media/PRODUCTION.md`.

## Renderer prerequisites

Set `REMOTION_BROWSER_EXECUTABLE` to a compatible installed Chrome Headless Shell
and `FFMPEG_EXECUTABLE` to FFmpeg. The saved Windows default uses the tested
Chrome 149 / Remotion 4.0.484 combination; replace the machine-specific path on
another computer. Do not mix different `@remotion/*` package versions.

Example PowerShell:

```powershell
$env:REMOTION_BROWSER_EXECUTABLE = 'C:/path/to/chrome-headless-shell.exe'
$env:FFMPEG_EXECUTABLE = 'C:/path/to/ffmpeg.exe'
npm --prefix media run render
```

Example macOS/Linux:

```sh
REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell FFMPEG_EXECUTABLE=ffmpeg npm --prefix media run render
```

The final exports are `media/out/counterclaim-42s.mp4` and an SFX-only alternative.
The source renderer keeps 1260 frames at 30 fps: **42 seconds**, below the mission's
45-second maximum. Output dimensions are 1920×1080, H.264/AAC, with an original score.
No paid generative-video service or remote voice model is required.

To film a new run, capture its actual states chronologically and use its own exact
proof. Do not mix one session's screenshots with another's verdict or identifiers.
`media/scripts/capture-app.mjs`, `ingest-proof.mjs` and `qa-film.py` retain the
production and verification helpers. The committed original recording is an
immutable example, not a claim that a newly generated case has the same outcome.
