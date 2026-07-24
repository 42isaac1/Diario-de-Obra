from __future__ import annotations

import hashlib
import json
import zipfile
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from .database import Database
from .models import DiaryPayload, ImportResult
from .pdf_tools import extract_payload_from_pdf


class DiaryImporter:
    def __init__(self, db: Database, data_dir: Path):
        self.db = db
        self.data_dir = data_dir
        for folder in ("uploads", "pdfs", "packages", "attachments"):
            (data_dir / folder).mkdir(parents=True, exist_ok=True)

    @staticmethod
    def sha256(content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    @staticmethod
    def safe_name(name: str) -> str:
        allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_."
        cleaned = "".join(ch if ch in allowed else "_" for ch in name)
        return cleaned[:180] or "arquivo"

    def validate_payload(self, raw: dict[str, Any]) -> tuple[DiaryPayload | None, list[str]]:
        messages: list[str] = []
        try:
            payload = DiaryPayload.model_validate(raw)
        except ValidationError as exc:
            return None, [f"Falha de validação: {err['loc']} — {err['msg']}" for err in exc.errors()]

        if not payload.equipe_presente:
            messages.append("Aviso: diário sem integrantes presentes.")
        if not payload.atividades:
            messages.append("Aviso: diário sem atividades executadas.")
        if payload.seguranca.houve_ocorrencia and not payload.seguranca.descricao_ocorrencia.strip():
            messages.append("Aviso: ocorrência de segurança marcada sem descrição.")
        if not payload.assinatura_encarregado.nome.strip():
            messages.append("Aviso: assinatura do encarregado não identificada.")
        if payload.deslocamento.km_final and payload.deslocamento.km_inicial and payload.deslocamento.km_final < payload.deslocamento.km_inicial:
            messages.append("Aviso: quilometragem final menor que a inicial; o valor rodado foi considerado zero.")
        if payload.despesas.total() > 0 and not payload.despesas.observacao.strip() and payload.despesas.extras:
            if any(not item.descricao.strip() for item in payload.despesas.extras):
                messages.append("Aviso: existe despesa extra sem descrição.")
        return payload, messages

    def _extract_zip(self, content: bytes) -> tuple[dict[str, Any] | None, bytes | None, list[str], dict[str, bytes]]:
        messages: list[str] = []
        attachments: dict[str, bytes] = {}
        with zipfile.ZipFile(BytesIO(content)) as archive:
            infos = archive.infolist()
            if len(infos) > 300:
                return None, None, ["Pacote rejeitado: mais de 300 itens compactados."], attachments
            expanded_size = sum(info.file_size for info in infos)
            if expanded_size > 120 * 1024 * 1024:
                return None, None, ["Pacote rejeitado: conteúdo descompactado maior que 120 MB."], attachments
            if any(info.file_size > 35 * 1024 * 1024 for info in infos):
                return None, None, ["Pacote rejeitado: contém item individual maior que 35 MB."], attachments
            names = [info.filename for info in infos if not info.is_dir()]
            if any(name.startswith(("/", "\\")) or ".." in Path(name).parts for name in names):
                return None, None, ["Pacote rejeitado: caminho interno inseguro."], attachments
            json_candidates = [n for n in names if n.lower().endswith(".json") and "manifest" not in n.lower()]
            pdf_candidates = [n for n in names if n.lower().endswith(".pdf")]
            if not json_candidates:
                return None, None, ["Pacote ZIP não contém o arquivo JSON do diário."], attachments
            raw_json = archive.read(json_candidates[0])
            raw = json.loads(raw_json.decode("utf-8-sig"))
            pdf_content = archive.read(pdf_candidates[0]) if pdf_candidates else None
            for name in names:
                lowered = name.lower()
                if lowered.endswith((".jpg", ".jpeg", ".png", ".webp")):
                    attachments[name] = archive.read(name)
            manifest_candidates = [n for n in names if "manifest" in n.lower() and n.lower().endswith(".json")]
            if manifest_candidates:
                try:
                    manifest = json.loads(archive.read(manifest_candidates[0]).decode("utf-8-sig"))
                    hashes = manifest.get("hashes", {})
                    expected_json = hashes.get("diario_json")
                    if expected_json and expected_json != self.sha256(raw_json):
                        messages.append("Falha: hash do JSON não confere com o manifesto.")
                    if expected_json and expected_json == self.sha256(raw_json):
                        messages.append("Integridade do JSON confirmada pelo manifesto.")
                    if pdf_content and hashes.get("diario_pdf"):
                        if hashes["diario_pdf"] == self.sha256(pdf_content):
                            messages.append("Integridade do PDF confirmada pelo manifesto.")
                        else:
                            messages.append("Falha: hash do PDF não confere com o manifesto.")
                except Exception as exc:  # noqa: BLE001
                    messages.append(f"Manifesto não pôde ser validado: {exc}")
            else:
                messages.append("Aviso: pacote sem manifesto de integridade.")
            if any(message.lower().startswith("falha:") for message in messages):
                return None, None, messages, attachments
            return raw, pdf_content, messages, attachments

    def import_bytes(self, filename: str, content: bytes) -> ImportResult:
        filename = self.safe_name(filename)
        suffix = Path(filename).suffix.lower()
        checksum = self.sha256(content)
        messages: list[str] = []
        pdf_content: bytes | None = None
        attachments: dict[str, bytes] = {}

        try:
            if suffix == ".zip":
                raw, pdf_content, zip_messages, attachments = self._extract_zip(content)
                messages.extend(zip_messages)
                if raw is None:
                    return ImportResult(ok=False, status="rejeitado", mensagens=messages)
                origin = "zip"
            elif suffix == ".pdf":
                raw, pdf_messages = extract_payload_from_pdf(content)
                messages.extend(pdf_messages)
                pdf_content = content
                if raw is None:
                    return ImportResult(ok=False, status="rejeitado", mensagens=messages)
                origin = "pdf"
            elif suffix == ".json":
                raw = json.loads(content.decode("utf-8-sig"))
                origin = "json"
            else:
                return ImportResult(ok=False, status="rejeitado", mensagens=["Formato não suportado. Use ZIP, PDF ou JSON."])
        except (json.JSONDecodeError, zipfile.BadZipFile, ValueError) as exc:
            return ImportResult(ok=False, status="rejeitado", mensagens=[f"Arquivo inválido: {exc}"])

        payload, validation_messages = self.validate_payload(raw)
        messages.extend(validation_messages)
        if payload is None:
            return ImportResult(ok=False, status="rejeitado", mensagens=messages)

        people_count = sum(1 for p in payload.equipe_presente if p.presente)
        people_hours = sum((p.horas_normais + p.horas_extras) for p in payload.equipe_presente if p.presente)
        quantity_total = sum(a.quantidade for a in payload.atividades)
        lost_hours = sum(i.horas_perdidas for i in payload.impedimentos)
        total_expenses = payload.despesas.total()
        km_travelled = payload.deslocamento.km_rodado()
        now = datetime.now().isoformat(timespec="seconds")
        base = self.safe_name(f"{payload.diario_id}_R{payload.revisao}")

        with self.db.connect() as con:
            existing = con.execute(
                "SELECT registro_id, checksum FROM diarios WHERE diario_id=? AND revisao=?",
                (payload.diario_id, payload.revisao),
            ).fetchone()
            if existing:
                if existing["checksum"] == checksum:
                    return ImportResult(
                        ok=False,
                        registro_id=existing["registro_id"],
                        diario_id=payload.diario_id,
                        revisao=payload.revisao,
                        status="duplicado",
                        mensagens=["Este mesmo arquivo já foi importado."],
                    )
                return ImportResult(
                    ok=False,
                    registro_id=existing["registro_id"],
                    diario_id=payload.diario_id,
                    revisao=payload.revisao,
                    status="conflito",
                    mensagens=["Já existe um diário com o mesmo ID e revisão, mas conteúdo diferente. Gere uma nova revisão."],
                )

            pdf_path = ""
            if pdf_content:
                target = self.data_dir / "pdfs" / f"{base}.pdf"
                target.write_bytes(pdf_content)
                pdf_path = str(target)

            package_path = ""
            original_target = self.data_dir / ("packages" if suffix == ".zip" else "uploads") / f"{base}{suffix}"
            original_target.write_bytes(content)
            package_path = str(original_target)

            attachment_dir = self.data_dir / "attachments" / base
            if attachments:
                attachment_dir.mkdir(parents=True, exist_ok=True)
                for original_name, attachment_content in attachments.items():
                    target_name = self.safe_name(Path(original_name).name)
                    (attachment_dir / target_name).write_bytes(attachment_content)

            validation = {
                "mensagens": messages,
                "integridade": not any(m.lower().startswith("falha:") for m in messages),
                "anexos_extraidos": len(attachments),
            }
            cursor = con.execute(
                """
                INSERT INTO diarios(
                    diario_id, revisao, projeto_id, projeto_nome, cliente, data,
                    equipe_id, equipe_nome, encarregado, turno_inicio, turno_fim,
                    pessoas_count, homens_hora, atividades_count, quantidade_total,
                    impedimentos_count, horas_perdidas, fotos_count, total_despesas,
                    km_rodado, status_aprovacao, origem_formato, importado_em, checksum,
                    dados_json, validacao_json, pdf_path, package_path
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    payload.diario_id, payload.revisao, payload.projeto.id, payload.projeto.nome,
                    payload.projeto.cliente, payload.data, payload.equipe.id, payload.equipe.nome,
                    payload.encarregado, payload.turno_inicio, payload.turno_fim, people_count,
                    people_hours, len(payload.atividades), quantity_total, len(payload.impedimentos),
                    lost_hours, len(payload.fotos), total_expenses, km_travelled,
                    "pendente", origin, now, checksum, payload.model_dump_json(),
                    json.dumps(validation, ensure_ascii=False), pdf_path, package_path,
                ),
            )
            registro_id = int(cursor.lastrowid)

        self.db.log("importar", "diario", str(registro_id), {"diario_id": payload.diario_id, "revisao": payload.revisao})
        return ImportResult(
            ok=True,
            registro_id=registro_id,
            diario_id=payload.diario_id,
            revisao=payload.revisao,
            status="importado_com_ressalva" if validation_messages else "importado",
            mensagens=messages or ["Diário importado com sucesso."],
            dados={"projeto": payload.projeto.nome, "data": payload.data, "equipe": payload.equipe.nome},
        )
