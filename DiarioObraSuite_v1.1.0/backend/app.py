from __future__ import annotations

import csv
import io
import json
import os
import shutil
import socket
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .database import APP_VERSION, Database
from .import_service import DiaryImporter
from .models import ApprovalUpdate, FieldConfig
from .pdf_tools import generate_contingency_pdf

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("DIARIO_DATA_DIR", ROOT / "data"))
STATIC_DIR = ROOT / "app" / "static"
DB_PATH = DATA_DIR / "diario_obra.sqlite3"
DOWNLOADS_DIR = STATIC_DIR / "downloads"

DATA_DIR.mkdir(parents=True, exist_ok=True)
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
CONTINGENCY_PATH = DOWNLOADS_DIR / "Modelo_Diario_Obra_Contingencia.pdf"
if not CONTINGENCY_PATH.exists():
    generate_contingency_pdf(CONTINGENCY_PATH)

db = Database(DB_PATH)
importer = DiaryImporter(db, DATA_DIR)
app = FastAPI(title="Diário de Obra Suite", version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def row_to_dict(row: Any, full: bool = False) -> dict[str, Any]:
    data = dict(row)
    if full:
        data["dados"] = json.loads(data.pop("dados_json"))
        data["validacao"] = json.loads(data.pop("validacao_json"))
    else:
        data.pop("dados_json", None)
        data["validacao"] = json.loads(data.pop("validacao_json"))
    data["possui_pdf"] = bool(data.pop("pdf_path", ""))
    data["possui_pacote"] = bool(data.pop("package_path", ""))
    return data


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "app": "Diário de Obra Suite", "version": APP_VERSION, "time": datetime.now().isoformat()}


@app.get("/api/system")
def system_info() -> dict[str, Any]:
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
    except OSError:
        hostname, local_ip = "computador", "127.0.0.1"
    return {
        "version": APP_VERSION,
        "hostname": hostname,
        "local_ip": local_ip,
        "campo_path": "/campo/",
        "contingency_pdf": "/downloads/Modelo_Diario_Obra_Contingencia.pdf",
    }


@app.get("/api/dashboard")
def dashboard() -> dict[str, Any]:
    today = date.today()
    last_30 = (today - timedelta(days=29)).isoformat()
    with db.connect() as con:
        totals = con.execute(
            """
            SELECT COUNT(*) total_diarios,
                   COALESCE(SUM(homens_hora),0) homens_hora,
                   COALESCE(SUM(atividades_count),0) atividades,
                   COALESCE(SUM(impedimentos_count),0) impedimentos,
                   COALESCE(SUM(horas_perdidas),0) horas_perdidas,
                   COALESCE(SUM(fotos_count),0) fotos,
                   COALESCE(SUM(total_despesas),0) total_despesas,
                   COALESCE(SUM(km_rodado),0) km_rodado,
                   SUM(CASE WHEN status_aprovacao='pendente' THEN 1 ELSE 0 END) pendentes
            FROM diarios WHERE data >= ?
            """,
            (last_30,),
        ).fetchone()
        by_project = con.execute(
            """
            SELECT projeto_id, projeto_nome, COUNT(*) diarios,
                   ROUND(SUM(homens_hora),1) homens_hora,
                   ROUND(SUM(quantidade_total),1) quantidade,
                   ROUND(SUM(horas_perdidas),1) horas_perdidas,
                   ROUND(SUM(total_despesas),2) total_despesas,
                   ROUND(SUM(km_rodado),1) km_rodado
            FROM diarios GROUP BY projeto_id, projeto_nome ORDER BY diarios DESC LIMIT 10
            """
        ).fetchall()
        recent = con.execute(
            """
            SELECT * FROM diarios ORDER BY data DESC, importado_em DESC LIMIT 8
            """
        ).fetchall()
        daily = con.execute(
            """
            SELECT data, COUNT(*) diarios, ROUND(SUM(homens_hora),1) homens_hora,
                   ROUND(SUM(horas_perdidas),1) horas_perdidas,
                   ROUND(SUM(total_despesas),2) total_despesas,
                   ROUND(SUM(km_rodado),1) km_rodado
            FROM diarios WHERE data >= ? GROUP BY data ORDER BY data
            """,
            (last_30,),
        ).fetchall()
    return {
        "periodo": {"inicio": last_30, "fim": today.isoformat()},
        "totais": dict(totals),
        "por_projeto": [dict(row) for row in by_project],
        "recentes": [row_to_dict(row) for row in recent],
        "serie_diaria": [dict(row) for row in daily],
    }


@app.get("/api/diarios")
def list_diaries(
    query: str = "",
    project: str = "",
    status: str = "",
    date_from: str = "",
    date_to: str = "",
    limit: int = Query(default=200, ge=1, le=1000),
) -> list[dict[str, Any]]:
    clauses = ["1=1"]
    params: list[Any] = []
    if query:
        clauses.append("(diario_id LIKE ? OR projeto_nome LIKE ? OR equipe_nome LIKE ? OR encarregado LIKE ?)")
        term = f"%{query}%"
        params.extend([term, term, term, term])
    if project:
        clauses.append("projeto_id=?")
        params.append(project)
    if status:
        clauses.append("status_aprovacao=?")
        params.append(status)
    if date_from:
        clauses.append("data>=?")
        params.append(date_from)
    if date_to:
        clauses.append("data<=?")
        params.append(date_to)
    params.append(limit)
    sql = f"SELECT * FROM diarios WHERE {' AND '.join(clauses)} ORDER BY data DESC, importado_em DESC LIMIT ?"
    with db.connect() as con:
        rows = con.execute(sql, params).fetchall()
    return [row_to_dict(row) for row in rows]


@app.get("/api/diarios/{registro_id}")
def get_diary(registro_id: int) -> dict[str, Any]:
    with db.connect() as con:
        row = con.execute("SELECT * FROM diarios WHERE registro_id=?", (registro_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Diário não encontrado")
    return row_to_dict(row, full=True)


@app.get("/api/diarios/{registro_id}/pdf")
def get_diary_pdf(registro_id: int) -> FileResponse:
    with db.connect() as con:
        row = con.execute("SELECT pdf_path, diario_id, revisao FROM diarios WHERE registro_id=?", (registro_id,)).fetchone()
    if not row or not row["pdf_path"] or not Path(row["pdf_path"]).exists():
        raise HTTPException(404, "PDF não disponível")
    return FileResponse(row["pdf_path"], media_type="application/pdf", filename=f"{row['diario_id']}_R{row['revisao']}.pdf")


@app.post("/api/import")
async def import_files(files: list[UploadFile] = File(...)) -> list[dict[str, Any]]:
    results = []
    for upload in files:
        content = await upload.read()
        if len(content) > 80 * 1024 * 1024:
            results.append({"ok": False, "status": "rejeitado", "mensagens": [f"{upload.filename}: arquivo maior que 80 MB."]})
            continue
        result = importer.import_bytes(upload.filename or "arquivo", content)
        results.append(result.model_dump(mode="json"))
    return results


@app.patch("/api/diarios/{registro_id}/approval")
def update_approval(registro_id: int, update: ApprovalUpdate) -> dict[str, Any]:
    with db.connect() as con:
        current = con.execute("SELECT diario_id FROM diarios WHERE registro_id=?", (registro_id,)).fetchone()
        if not current:
            raise HTTPException(404, "Diário não encontrado")
        con.execute(
            "UPDATE diarios SET status_aprovacao=?, observacao_aprovacao=? WHERE registro_id=?",
            (update.status, update.observacao, registro_id),
        )
    db.log("aprovar", "diario", str(registro_id), update.model_dump())
    return get_diary(registro_id)


@app.delete("/api/diarios/{registro_id}")
def delete_diary(registro_id: int) -> dict[str, Any]:
    with db.connect() as con:
        row = con.execute("SELECT * FROM diarios WHERE registro_id=?", (registro_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Diário não encontrado")
        for key in ("pdf_path", "package_path"):
            path = row[key]
            if path:
                Path(path).unlink(missing_ok=True)
        con.execute("DELETE FROM diarios WHERE registro_id=?", (registro_id,))
    db.log("excluir", "diario", str(registro_id), {"diario_id": row["diario_id"]})
    return {"ok": True}


@app.get("/api/config")
def get_config() -> dict[str, Any]:
    return db.get_config()


@app.put("/api/config")
def put_config(config: FieldConfig) -> dict[str, Any]:
    return db.save_config(config.model_dump(mode="json"))


@app.get("/api/config/export")
def export_config() -> Response:
    content = json.dumps(db.get_config(), ensure_ascii=False, indent=2).encode("utf-8")
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=configuracao_campo.json"},
    )


@app.get("/api/export/csv")
def export_csv() -> Response:
    with db.connect() as con:
        rows = con.execute("SELECT * FROM diarios ORDER BY data DESC").fetchall()
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "ID Diário", "Revisão", "Data", "Projeto", "Cliente", "Equipe", "Encarregado",
        "Pessoas", "Homens-hora", "Atividades", "Quantidade", "Impedimentos",
        "Horas perdidas", "Fotos", "Despesas (R$)", "Km rodado", "Status", "Importado em",
    ])
    for row in rows:
        writer.writerow([
            row["diario_id"], row["revisao"], row["data"], row["projeto_nome"], row["cliente"],
            row["equipe_nome"], row["encarregado"], row["pessoas_count"], row["homens_hora"],
            row["atividades_count"], row["quantidade_total"], row["impedimentos_count"],
            row["horas_perdidas"], row["fotos_count"], row["total_despesas"], row["km_rodado"],
            row["status_aprovacao"], row["importado_em"],
        ])
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=diarios_obra.csv"},
    )


@app.get("/api/backup")
def backup() -> StreamingResponse:
    memory = io.BytesIO()
    with zipfile.ZipFile(memory, "w", zipfile.ZIP_DEFLATED) as archive:
        if DB_PATH.exists():
            archive.write(DB_PATH, "diario_obra.sqlite3")
        for folder in ("pdfs", "packages", "attachments"):
            source = DATA_DIR / folder
            if source.exists():
                for path in source.rglob("*"):
                    if path.is_file():
                        archive.write(path, str(path.relative_to(DATA_DIR)))
        archive.writestr("configuracao_campo.json", json.dumps(db.get_config(), ensure_ascii=False, indent=2))
        archive.writestr("backup_info.json", json.dumps({"app_version": APP_VERSION, "created_at": datetime.now().isoformat()}, indent=2))
    memory.seek(0)
    filename = f"backup_diario_obra_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    return StreamingResponse(memory, media_type="application/zip", headers={"Content-Disposition": f"attachment; filename={filename}"})


@app.get("/api/audit")
def audit(limit: int = Query(default=100, ge=1, le=1000)) -> list[dict[str, Any]]:
    with db.connect() as con:
        rows = con.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item["detalhes"] = json.loads(item.pop("detalhes_json"))
        result.append(item)
    return result


@app.get("/downloads/Modelo_Diario_Obra_Contingencia.pdf")
def contingency_pdf() -> FileResponse:
    return FileResponse(CONTINGENCY_PATH, media_type="application/pdf", filename=CONTINGENCY_PATH.name)


@app.get("/campo")
def redirect_campo() -> HTMLResponse:
    return HTMLResponse('<meta http-equiv="refresh" content="0; url=/campo/">')


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "gestao" / "index.html")


app.mount("/gestao", StaticFiles(directory=STATIC_DIR / "gestao", html=True), name="gestao")
app.mount("/campo", StaticFiles(directory=STATIC_DIR / "campo", html=True), name="campo")
app.mount("/vendor", StaticFiles(directory=STATIC_DIR / "vendor"), name="vendor")
app.mount("/downloads", StaticFiles(directory=DOWNLOADS_DIR), name="downloads")
