from __future__ import annotations

import compileall
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pypdf import PdfReader

from backend.pdf_tools import generate_contingency_pdf

def run() -> int:
    print("[1/4] Validando Python...")
    if not compileall.compile_dir(ROOT / "backend", quiet=1):
        return 1
    print("[2/4] Executando testes automatizados...")
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        return 1
    print("[3/4] Validando PDF preenchível...")
    pdf = ROOT / "app" / "static" / "downloads" / "Modelo_Diario_Obra_Contingencia.pdf"
    generate_contingency_pdf(pdf)
    reader = PdfReader(str(pdf))
    if len(reader.pages) != 4 or not reader.get_fields():
        print("PDF inválido.")
        return 1
    print(f"PDF: {len(reader.pages)} páginas, {len(reader.get_fields() or {})} campos.")
    print("[4/4] Validando JavaScript compilado...")
    node = shutil.which("node")
    if node:
        for script in [ROOT / "app" / "static" / "campo" / "app.js", ROOT / "app" / "static" / "gestao" / "app.js"]:
            subprocess.run([node, "--check", str(script)], check=True)
        print("JavaScript validado pelo Node.js.")
    else:
        print("Node.js não encontrado: verificação de sintaxe ignorada; arquivos já estão compilados.")
    print("\nVALIDAÇÃO CONCLUÍDA COM SUCESSO")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
