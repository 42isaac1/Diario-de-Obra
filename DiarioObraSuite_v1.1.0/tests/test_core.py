from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
import zipfile
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from backend.database import Database, default_config
from backend.import_service import DiaryImporter
from backend.models import DiaryPayload, FieldConfig
from backend.pdf_tools import extract_payload_from_pdf, generate_contingency_pdf


def sample_payload(revision: int = 1) -> dict:
    return {
        "schema_version": "1.1",
        "app_version": "1.1.0-test",
        "diario_id": "DO-20260723-OBR-TST-EQ-TST",
        "revisao": revision,
        "projeto": {"id": "OBR-TST", "nome": "Obra de Teste", "cliente": "Cliente", "local": "Divinópolis/MG", "contrato": "CT-TST", "centro_custo": "CC-TST"},
        "data": "2026-07-23",
        "equipe": {"id": "EQ-TST", "nome": "Equipe Teste"},
        "encarregado": "Responsável Teste",
        "turno_inicio": "07:00",
        "turno_fim": "17:00",
        "intervalo_minutos": 60,
        "clima": "Ensolarado",
        "equipe_presente": [
            {"funcionario_id": "FUN-1", "nome": "Responsável Teste", "funcao": "Encarregado", "presente": True, "horas_normais": 9, "horas_extras": 1},
            {"funcionario_id": "FUN-2", "nome": "Eletricista Teste", "funcao": "Eletricista", "presente": True, "horas_normais": 9, "horas_extras": 0},
        ],
        "atividades": [{"id": "A1", "codigo": "ATV-1", "descricao": "Montagem", "local": "Área A", "quantidade": 20, "unidade": "m", "percentual_conclusao": 50, "observacao": ""}],
        "materiais": [],
        "equipamentos": [],
        "despesas": {
            "cafe_manha": {"quantidade": 2, "valor_unitario": 8.5},
            "almoco": {"quantidade": 2, "valor_unitario": 25},
            "cafe_tarde": {"quantidade": 2, "valor_unitario": 7},
            "jantar": {"quantidade": 0, "valor_unitario": 0},
            "extras": [{"id": "D1", "descricao": "Pedágio", "valor": 12}],
            "abastecimento": 100,
            "observacao": "Comprovantes anexados"
        },
        "deslocamento": {"veiculo": "Veículo Teste", "placa": "ABC1D23", "km_inicial": 1000, "km_final": 1120, "observacao": ""},
        "seguranca": {"dds_realizado": True, "apr_disponivel": True, "epis_conformes": True, "isolamento_area": True, "permissao_trabalho": True, "houve_ocorrencia": False, "descricao_ocorrencia": ""},
        "impedimentos": [{"id": "I1", "categoria": "Aguardando cliente", "descricao": "Liberação", "impacto": "parcial", "horas_perdidas": 1.5, "responsavel": "Cliente", "acao_necessaria": "Liberar", "status": "aberto"}],
        "fotos": [{"id": "F1", "nome": "foto.png", "legenda": "Teste", "vinculo_tipo": "atividade", "vinculo_id": "A1", "data_hora": "2026-07-23T15:00:00"}],
        "assinatura_encarregado": {"nome": "Responsável Teste", "funcao": "Encarregado", "data_hora": "2026-07-23T17:10:00"},
        "observacoes_gerais": "Teste automatizado.",
        "status": "finalizado",
        "finalizado_em": "2026-07-23T17:10:00",
        "origem": "teste",
    }


def package_bytes(payload: dict, pdf: bytes = b"%PDF-1.4\n% teste\n") -> bytes:
    json_data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    manifest = {
        "hashes": {
            "diario_json": hashlib.sha256(json_data).hexdigest(),
            "diario_pdf": hashlib.sha256(pdf).hexdigest(),
        }
    }
    memory = BytesIO()
    with zipfile.ZipFile(memory, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("diario.json", json_data)
        archive.writestr("diario.pdf", pdf)
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("fotos/foto.png", b"PNG")
    return memory.getvalue()


class ModelTests(unittest.TestCase):
    def test_default_config_is_valid(self) -> None:
        config = FieldConfig.model_validate(default_config())
        self.assertGreaterEqual(len(config.projetos), 1)
        self.assertGreaterEqual(len(config.funcionarios), 1)

    def test_diary_model_and_percent_clamp(self) -> None:
        data = sample_payload()
        data["atividades"][0]["percentual_conclusao"] = 120
        payload = DiaryPayload.model_validate(data)
        self.assertEqual(payload.atividades[0].percentual_conclusao, 100)


class PdfTests(unittest.TestCase):
    def test_contingency_pdf_generation_and_extraction(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            template = Path(folder) / "modelo.pdf"
            filled = Path(folder) / "preenchido.pdf"
            generate_contingency_pdf(template)
            reader = PdfReader(str(template))
            self.assertEqual(len(reader.pages), 4)
            self.assertIn("projeto_id", reader.get_fields())
            writer = PdfWriter()
            writer.clone_document_from_reader(reader)
            values = {
                "diario_id": "DO-TESTE-PDF",
                "revisao": "2",
                "data": "2026-07-23",
                "projeto_id": "OBR-PDF",
                "projeto_nome": "Obra PDF",
                "cliente": "Cliente PDF",
                "equipe_id": "EQ-PDF",
                "equipe_nome": "Equipe PDF",
                "encarregado": "Encarregado PDF",
                "pessoa_1_nome": "Encarregado PDF",
                "pessoa_1_horas": "8,5",
                "atividade_1_descricao": "Atividade PDF",
                "atividade_1_quantidade": "12,5",
                "atividade_1_percentual": "40",
                "impedimento_1_categoria": "Acesso não liberado",
                "impedimento_1_impacto": "totalmente",
                "impedimento_1_horas": "2,5",
                "cafe_manha_quantidade": "2",
                "cafe_manha_valor_unitario": "8,50",
                "almoco_quantidade": "2",
                "almoco_valor_unitario": "25,00",
                "despesa_extra_1_descricao": "Pedágio",
                "despesa_extra_1_valor": "12,00",
                "abastecimento_valor": "100,00",
                "veiculo": "Veículo Teste",
                "placa": "ABC1D23",
                "km_inicial": "1000",
                "km_final": "1120",
                "seg_dds": "SIM",
            }
            for page in writer.pages:
                writer.update_page_form_field_values(page, values, auto_regenerate=False)
            with filled.open("wb") as stream:
                writer.write(stream)
            raw, messages = extract_payload_from_pdf(filled.read_bytes())
            self.assertIsNotNone(raw)
            self.assertEqual(raw["diario_id"], "DO-TESTE-PDF")
            self.assertEqual(raw["revisao"], 2)
            self.assertEqual(raw["equipe_presente"][0]["horas_normais"], 8.5)
            self.assertEqual(raw["atividades"][0]["quantidade"], 12.5)
            self.assertEqual(raw["impedimentos"][0]["impacto"], "total")
            self.assertEqual(raw["despesas"]["cafe_manha"]["quantidade"], 2)
            self.assertEqual(raw["deslocamento"]["km_final"], 1120)
            self.assertTrue(messages)


class ImportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.db = Database(root / "db.sqlite3")
        self.importer = DiaryImporter(self.db, root / "data")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_zip_import_metrics_duplicate_conflict_and_revision(self) -> None:
        first_payload = sample_payload(1)
        first_content = package_bytes(first_payload)
        first = self.importer.import_bytes("pacote.zip", first_content)
        self.assertTrue(first.ok)
        self.assertEqual(first.status, "importado")
        duplicate = self.importer.import_bytes("pacote.zip", first_content)
        self.assertFalse(duplicate.ok)
        self.assertEqual(duplicate.status, "duplicado")

        conflicting = sample_payload(1)
        conflicting["observacoes_gerais"] = "Conteúdo diferente"
        conflict = self.importer.import_bytes("pacote_alterado.zip", package_bytes(conflicting))
        self.assertFalse(conflict.ok)
        self.assertEqual(conflict.status, "conflito")

        revision = self.importer.import_bytes("pacote_r2.zip", package_bytes(sample_payload(2)))
        self.assertTrue(revision.ok)
        with self.db.connect() as con:
            rows = con.execute("SELECT * FROM diarios ORDER BY revisao").fetchall()
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["pessoas_count"], 2)
        self.assertEqual(rows[0]["homens_hora"], 19)
        self.assertEqual(rows[0]["horas_perdidas"], 1.5)
        self.assertEqual(rows[0]["fotos_count"], 1)
        self.assertAlmostEqual(rows[0]["total_despesas"], 193.0)
        self.assertEqual(rows[0]["km_rodado"], 120)

    def test_manifest_tampering_is_rejected(self) -> None:
        payload = sample_payload()
        json_data = json.dumps(payload).encode()
        memory = BytesIO()
        with zipfile.ZipFile(memory, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("diario.json", json_data)
            archive.writestr("manifest.json", json.dumps({"hashes": {"diario_json": "0" * 64}}))
        result = self.importer.import_bytes("adulterado.zip", memory.getvalue())
        self.assertFalse(result.ok)
        self.assertEqual(result.status, "rejeitado")
        self.assertTrue(any("hash" in message.lower() for message in result.mensagens))

    def test_unsafe_zip_path_is_rejected(self) -> None:
        memory = BytesIO()
        with zipfile.ZipFile(memory, "w") as archive:
            archive.writestr("../diario.json", json.dumps(sample_payload()))
        result = self.importer.import_bytes("inseguro.zip", memory.getvalue())
        self.assertFalse(result.ok)
        self.assertEqual(result.status, "rejeitado")


if __name__ == "__main__":
    unittest.main()
