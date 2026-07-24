from __future__ import annotations

import hashlib
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "app" / "static" / "vendor"
VENDOR.mkdir(parents=True, exist_ok=True)

FILES = {
    "react.production.min.js": {
        "min_size": 8_000,
        "urls": [
            "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
            "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js",
            "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
        ],
    },
    "react-dom.production.min.js": {
        "min_size": 90_000,
        "urls": [
            "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
            "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js",
            "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
        ],
    },
    "pdf-lib.min.js": {
        "min_size": 300_000,
        "urls": [
            "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js",
            "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js",
            "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js",
        ],
    },
    "jszip.min.js": {
        "min_size": 70_000,
        "urls": [
            "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
            "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
            "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js",
        ],
    },
}


def valid(path: Path, minimum: int) -> bool:
    return path.is_file() and path.stat().st_size >= minimum


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "DiarioObraSuite/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
    return data


def main() -> int:
    failures: list[str] = []
    for filename, spec in FILES.items():
        target = VENDOR / filename
        minimum = int(spec["min_size"])
        if valid(target, minimum):
            print(f"[OK] {filename} ({target.stat().st_size:,} bytes)")
            continue
        errors: list[str] = []
        for url in spec["urls"]:
            try:
                print(f"[DOWNLOAD] {filename} <- {url}")
                data = download(str(url))
                if len(data) < minimum:
                    raise ValueError(f"arquivo inesperadamente pequeno ({len(data)} bytes)")
                temp = target.with_suffix(target.suffix + ".tmp")
                temp.write_bytes(data)
                temp.replace(target)
                digest = hashlib.sha256(data).hexdigest()[:12]
                print(f"[OK] {filename} ({len(data):,} bytes, sha256 {digest})")
                break
            except (OSError, urllib.error.URLError, ValueError) as exc:
                errors.append(f"{url}: {exc}")
        else:
            failures.append(filename)
            print(f"[ERRO] Não foi possível baixar {filename}.")
            for error in errors:
                print(f"       {error}")
    if failures:
        print("\nBibliotecas pendentes: " + ", ".join(failures))
        print("Verifique internet, proxy ou antivírus e execute este script novamente.")
        return 1
    print("\nBibliotecas web prontas para operação offline.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
