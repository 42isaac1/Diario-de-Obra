from __future__ import annotations

import base64
import hashlib
import json
import sys
import zipfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pypdf import PdfReader, PdfWriter

from backend.pdf_tools import generate_contingency_pdf

OUT = ROOT / "docs" / "exemplos"
TEMPLATE = ROOT / "app" / "static" / "downloads" / "Modelo_Diario_Obra_Contingencia.pdf"

PAYLOAD = {
    "schema_version": "1.1",
    "app_version": "1.1.0-exemplo",
    "diario_id": "DO-20260723-OBR-001-EQ-01",
    "revisao": 1,
    "projeto": {"id": "OBR-001", "nome": "Ampliação de Subestação", "cliente": "Cliente Demonstração", "local": "Divinópolis/MG", "contrato": "CT-2026-001", "centro_custo": "CC-1001"},
    "data": "2026-07-23",
    "equipe": {"id": "EQ-01", "nome": "Equipe Elétrica 01"},
    "encarregado": "João da Silva",
    "turno_inicio": "07:00",
    "turno_fim": "17:00",
    "intervalo_minutos": 60,
    "clima": "Ensolarado",
    "equipe_presente": [
        {"funcionario_id": "FUN-001", "nome": "João da Silva", "funcao": "Encarregado", "presente": True, "horas_normais": 9, "horas_extras": 0},
        {"funcionario_id": "FUN-002", "nome": "Carlos Souza", "funcao": "Eletricista", "presente": True, "horas_normais": 9, "horas_extras": 0},
        {"funcionario_id": "FUN-004", "nome": "Paulo Santos", "funcao": "Ajudante", "presente": True, "horas_normais": 9, "horas_extras": 0},
    ],
    "atividades": [
        {"id": "A1", "codigo": "ATV-001", "descricao": "Montagem de eletrocalhas", "local": "Sala elétrica", "quantidade": 38, "unidade": "m", "percentual_conclusao": 70, "observacao": "Trecho liberado."},
        {"id": "A2", "codigo": "ATV-002", "descricao": "Lançamento de cabos", "local": "Subestação", "quantidade": 120, "unidade": "m", "percentual_conclusao": 35, "observacao": "Sem intercorrências."},
    ],
    "materiais": [{"id": "M1", "descricao": "Eletrocalha 200 x 100 mm", "tipo": "utilizado", "quantidade": 12, "unidade": "un", "observacao": ""}],
    "equipamentos": [{"id": "E1", "descricao": "Plataforma elevatória", "status": "utilizado", "horas": 6, "observacao": ""}],
    "despesas": {
        "cafe_manha": {"quantidade": 3, "valor_unitario": 8.5},
        "almoco": {"quantidade": 3, "valor_unitario": 25},
        "cafe_tarde": {"quantidade": 3, "valor_unitario": 7},
        "jantar": {"quantidade": 0, "valor_unitario": 0},
        "extras": [{"id": "D1", "descricao": "Pedágio", "valor": 12}],
        "abastecimento": 250,
        "observacao": "Comprovantes anexados"
    },
    "deslocamento": {"veiculo": "Veículo 01", "placa": "ABC1D23", "km_inicial": 48120, "km_final": 48276, "observacao": "Deslocamento obra-base"},
    "seguranca": {"dds_realizado": True, "apr_disponivel": True, "epis_conformes": True, "isolamento_area": True, "permissao_trabalho": True, "houve_ocorrencia": False, "descricao_ocorrencia": ""},
    "impedimentos": [{"id": "I1", "categoria": "Aguardando cliente", "descricao": "Liberação parcial de acesso", "impacto": "parcial", "inicio": "10:00", "fim": "11:30", "horas_perdidas": 1.5, "responsavel": "Fiscal da obra", "acao_necessaria": "Liberar área B", "prazo": "2026-07-24", "status": "aberto"}],
    "fotos": [{"id": "F1", "nome": "foto_exemplo.png", "legenda": "Trecho de eletrocalha executado", "vinculo_tipo": "atividade", "vinculo_id": "A1", "data_hora": "2026-07-23T15:10:00"}],
    "assinatura_encarregado": {"nome": "João da Silva", "funcao": "Encarregado", "data_hora": "2026-07-23T17:10:00"},
    "observacoes_gerais": "Diário de demonstração para validação da importação.",
    "status": "finalizado",
    "finalizado_em": "2026-07-23T17:10:00",
    "origem": "exemplo_distribuicao",
}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fill_contingency(target: Path) -> None:
    reader = PdfReader(str(TEMPLATE))
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    values = {
        "diario_id": PAYLOAD["diario_id"], "revisao": "1", "data": PAYLOAD["data"],
        "projeto_id": "OBR-001", "projeto_nome": "Ampliação de Subestação", "cliente": "Cliente Demonstração",
        "local": "Divinópolis/MG", "contrato": "CT-2026-001", "centro_custo": "CC-1001",
        "equipe_id": "EQ-01", "equipe_nome": "Equipe Elétrica 01", "encarregado": "João da Silva",
        "turno_inicio": "07:00", "turno_fim": "17:00", "intervalo_minutos": "60", "clima": "Ensolarado",
        "pessoa_1_id": "FUN-001", "pessoa_1_nome": "João da Silva", "pessoa_1_funcao": "Encarregado", "pessoa_1_horas": "9",
        "pessoa_2_id": "FUN-002", "pessoa_2_nome": "Carlos Souza", "pessoa_2_funcao": "Eletricista", "pessoa_2_horas": "9",
        "atividade_1_codigo": "ATV-001", "atividade_1_descricao": "Montagem de eletrocalhas", "atividade_1_local": "Sala elétrica", "atividade_1_quantidade": "38", "atividade_1_unidade": "m", "atividade_1_percentual": "70",
        "cafe_manha_quantidade": "3", "cafe_manha_valor_unitario": "8,50", "almoco_quantidade": "3", "almoco_valor_unitario": "25,00",
        "cafe_tarde_quantidade": "3", "cafe_tarde_valor_unitario": "7,00", "despesa_extra_1_descricao": "Pedágio", "despesa_extra_1_valor": "12,00",
        "abastecimento_valor": "250,00", "veiculo": "Veículo 01", "placa": "ABC1D23", "km_inicial": "48120", "km_final": "48276",
        "seg_dds": "/Yes", "seg_apr": "/Yes", "seg_epi": "/Yes", "seg_isolamento": "/Yes", "seg_pt": "/Yes", "seg_ocorrencia": "/Off",
        "impedimento_1_categoria": "Aguardando cliente", "impedimento_1_descricao": "Liberação parcial de acesso", "impedimento_1_impacto": "parcial", "impedimento_1_horas": "1,5", "impedimento_1_responsavel": "Fiscal da obra", "impedimento_1_acao": "Liberar área B",
        "observacoes_gerais": "PDF preenchido de demonstração.", "assinatura_data": "2026-07-23 17:10",
    }
    for page in writer.pages:
        writer.update_page_form_field_values(page, values, auto_regenerate=False)
    with target.open("wb") as stream:
        writer.write(stream)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    generate_contingency_pdf(TEMPLATE)
    json_bytes = json.dumps(PAYLOAD, ensure_ascii=False, indent=2).encode("utf-8")
    (OUT / "diario_exemplo.json").write_bytes(json_bytes)
    pdf_path = OUT / "Diario_Exemplo_Preenchido.pdf"
    fill_contingency(pdf_path)
    pdf_bytes = pdf_path.read_bytes()
    png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
    manifest = {
        "schema_version": "1.1", "diario_id": PAYLOAD["diario_id"], "revisao": 1,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "files": ["diario.json", "diario.pdf", "fotos/foto_exemplo.png"],
        "hashes": {"diario_json": sha(json_bytes), "diario_pdf": sha(pdf_bytes)},
    }
    with zipfile.ZipFile(OUT / "Pacote_Diario_Exemplo.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("diario.json", json_bytes)
        archive.writestr("diario.pdf", pdf_bytes)
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        archive.writestr("fotos/foto_exemplo.png", png)
    print(f"Exemplos gerados em {OUT}")


if __name__ == "__main__":
    main()
