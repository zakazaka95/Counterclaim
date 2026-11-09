"""Package the editable film and the source file its proof gate verifies."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
target = ROOT / "out" / "counterclaim-editable-film.zip"
exclude = {"node_modules", "out", ".cache", "__pycache__"}
files = [p for p in ROOT.rglob("*") if p.is_file()
         and not any(part in exclude for part in p.relative_to(ROOT).parts)
         and p.suffix.lower() not in {".wav", ".mp3", ".mp4", ".pyc"}]
records = []
with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(files):
        name = "Counterclaim/media/" + file.relative_to(ROOT).as_posix()
        archive.write(file, name)
        records.append({"file": name, "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
    contract = ROOT.parent / "contracts" / "CounterclaimCourt.py"
    name = "Counterclaim/contracts/CounterclaimCourt.py"
    archive.write(contract, name)
    records.append({"file": name, "sha256": hashlib.sha256(contract.read_bytes()).hexdigest()})
    archive.writestr("START-HERE.txt", "Extract this archive, then open Counterclaim/media/README.md.\nRun npm ci from Counterclaim/media.\nThe adjacent contracts file is retained because the film's evidence gate verifies its exact source hash.\nFull integration repository: https://github.com/zakazaka95/Counterclaim\n")
    archive.writestr("FILES-SHA256.json", json.dumps(records, indent=2) + "\n")
record = {"file": str(target.relative_to(ROOT)).replace("\\", "/"),
          "bytes": target.stat().st_size,
          "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
          "source_file_count": len(records),
          "includes": "Editable media source, official assets/licenses, original FLAC audio, actual UI captures, archived public proof, source-matched contract reference; excludes dependency caches and generated movies"}
(ROOT / "out" / "editable-package.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(json.dumps(record, indent=2))
