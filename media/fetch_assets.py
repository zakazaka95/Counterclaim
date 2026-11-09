"""Fetch official marks and open-licensed typography for the Partner Demo film."""
import hashlib
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
FILES = [
    ("internet-court-logo.svg", "https://internetcourt.org/logos/tic-logo-red.svg", "Internet Court official website logo; trademark belongs to its owner."),
    ("yellow-logo-light.svg", "https://www.yellow.org/images/header/yellow_logo_light.svg", "Yellow official website header mark; trademark belongs to its owner."),
    ("yellow-logo-footer.svg", "https://www.yellow.org/images/footer/logo.svg", "Yellow official website footer mark; trademark belongs to its owner."),
    ("yellow-partner.svg", "https://internetcourt.org/partners/yellow.svg", "Yellow mark distributed by the official Internet Court partner wall."),
    ("genlayer-logo-black.svg", "https://genlayer.com/brand/genlayer-logo-black.svg", "Official GenLayer brand page SVG; trademark belongs to its owner."),
    ("genlayer-logo-white.svg", "https://genlayer.com/brand/genlayer-logo-white-cropped.svg", "Official GenLayer brand page SVG; trademark belongs to its owner."),
    ("genlayer-partner.svg", "https://internetcourt.org/partners/genlayer.svg", "GenLayer mark distributed by the official Internet Court partner wall."),
    ("yellow-sdk-background.webp", "https://www.yellow.org/images/landing/yellow_sdk_background.webp", "Official Yellow SDK graphic; use only to illustrate the Yellow integration, without implied endorsement."),
    ("yellow-square.webp", "https://www.yellow.org/images/landing/yellow_square.webp", "Official Yellow website brand graphic; use only in contextual product demonstration."),
    ("InstrumentSerif-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentserif/InstrumentSerif-Regular.ttf", "SIL Open Font License; see InstrumentSerif-OFL.txt."),
    ("InstrumentSerif-OFL.txt", "https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentserif/OFL.txt", "SIL Open Font License."),
    ("DMSans.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/DMSans%5Bopsz,wght%5D.ttf", "SIL Open Font License; see DMSans-OFL.txt."),
    ("DMSans-OFL.txt", "https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/OFL.txt", "SIL Open Font License."),
]


def main():
    folder = ROOT / "assets"
    folder.mkdir(parents=True, exist_ok=True)
    manifest = {"retrieved_date": "2026-11-09", "purpose": "Mission 101: Internet Court Partner Demo Lab, Counterclaim × Yellow", "files": [], "failures": []}
    for name, url, rights in FILES:
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=45) as response:
                content = response.read()
                content_type = response.headers.get("Content-Type", "")
            assert len(content) > 20
            if name.endswith(".svg"):
                assert b"<svg" in content[:2000], "Not an SVG"
            (folder / name).write_bytes(content)
            manifest["files"].append({"file": name, "url": url, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest(), "content_type": content_type, "rights": rights})
            print(name, len(content))
        except Exception as error:
            manifest["failures"].append({"file": name, "url": url, "error": str(error)})
            print("Unavailable:", name, str(error))
    (ROOT / "ASSET-PROVENANCE.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
