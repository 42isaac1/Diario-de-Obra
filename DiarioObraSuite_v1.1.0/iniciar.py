from __future__ import annotations

import socket
import threading
import time
import webbrowser
from pathlib import Path

import uvicorn


def free_port(start: int = 8765, end: int = 8795) -> int:
    for port in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("Não foi encontrada uma porta livre entre 8765 e 8795.")


def open_browser(url: str) -> None:
    time.sleep(1.4)
    webbrowser.open(url, new=1)


if __name__ == "__main__":
    port = free_port()
    url = f"http://127.0.0.1:{port}"
    print("=" * 62)
    print("  DIÁRIO DE OBRA SUITE v1.1.0")
    print("=" * 62)
    print(f"Gestor: {url}")
    print(f"Aplicativo de campo: {url}/campo/")
    print("Feche esta janela para encerrar o sistema.")
    threading.Thread(target=open_browser, args=(url,), daemon=True).start()
    uvicorn.run("backend.app:app", host="0.0.0.0", port=port, reload=False, log_level="info")
