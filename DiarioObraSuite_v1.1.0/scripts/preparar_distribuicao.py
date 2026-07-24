from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "app" / "static"
TARGET = ROOT / "distribuicao" / "Campo_Netlify"
ZIP_PATH = ROOT / "distribuicao" / "Campo_Netlify.zip"
REQUIRED = [
    SOURCE / "vendor" / "react.production.min.js",
    SOURCE / "vendor" / "react-dom.production.min.js",
    SOURCE / "vendor" / "pdf-lib.min.js",
    SOURCE / "vendor" / "jszip.min.js",
]


def main() -> int:
    missing = [path.name for path in REQUIRED if not path.exists()]
    if missing:
        print("Distribuição não criada. Bibliotecas ausentes: " + ", ".join(missing))
        print("Execute scripts/baixar_bibliotecas.py primeiro.")
        return 1
    if TARGET.exists():
        shutil.rmtree(TARGET)
    TARGET.mkdir(parents=True)
    shutil.copytree(SOURCE / "campo", TARGET / "campo")
    shutil.copytree(SOURCE / "vendor", TARGET / "vendor")
    (TARGET / "index.html").write_text(
        '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/campo/">'
        '<title>Diário de Obra</title><a href="/campo/">Abrir aplicativo de campo</a>',
        encoding="utf-8",
    )
    (TARGET / "netlify.toml").write_text(
        '[[headers]]\n  for = "/*"\n  [headers.values]\n    X-Content-Type-Options = "nosniff"\n'
        '    Referrer-Policy = "same-origin"\n\n[[redirects]]\n  from = "/"\n  to = "/campo/"\n  status = 302\n',
        encoding="utf-8",
    )
    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    ZIP_PATH.unlink(missing_ok=True)
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in TARGET.rglob("*"):
            if path.is_file():
                archive.write(path, path.relative_to(TARGET))
    print(f"Distribuição criada: {ZIP_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
