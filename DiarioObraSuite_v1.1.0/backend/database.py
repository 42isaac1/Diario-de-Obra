from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

from .models import FieldConfig

APP_VERSION = "1.1.0"


def default_config() -> dict[str, Any]:
    return {
        "schema_version": "1.1",
        "empresa": "JR Instalações Elétricas",
        "projetos": [
            {
                "id": "OBR-001",
                "nome": "Ampliação de Subestação",
                "cliente": "Cliente Demonstração",
                "local": "Divinópolis/MG",
                "contrato": "CT-2026-001",
                "centro_custo": "CC-1001",
                "ativo": True,
            },
            {
                "id": "OBR-002",
                "nome": "Montagem de Painéis Elétricos",
                "cliente": "Cliente Industrial",
                "local": "Betim/MG",
                "contrato": "CT-2026-002",
                "centro_custo": "CC-1002",
                "ativo": True,
            },
        ],
        "funcionarios": [
            {"id": "FUN-001", "nome": "João da Silva", "funcao": "Encarregado", "ativo": True},
            {"id": "FUN-002", "nome": "Carlos Souza", "funcao": "Eletricista", "ativo": True},
            {"id": "FUN-003", "nome": "Marcos Lima", "funcao": "Eletricista", "ativo": True},
            {"id": "FUN-004", "nome": "Paulo Santos", "funcao": "Ajudante de eletricista", "ativo": True},
        ],
        "equipes": [
            {
                "id": "EQ-01",
                "nome": "Equipe Elétrica 01",
                "encarregado": "João da Silva",
                "membros": ["FUN-001", "FUN-002", "FUN-003", "FUN-004"],
                "ativo": True,
            }
        ],
        "atividades": [
            {
                "codigo": "ATV-001",
                "descricao": "Montagem de eletrocalhas",
                "unidade": "m",
                "projeto_id": "",
                "quantidade_planejada": 500,
                "ativo": True,
            },
            {
                "codigo": "ATV-002",
                "descricao": "Lançamento de cabos",
                "unidade": "m",
                "projeto_id": "",
                "quantidade_planejada": 2000,
                "ativo": True,
            },
            {
                "codigo": "ATV-003",
                "descricao": "Instalação de painéis",
                "unidade": "un",
                "projeto_id": "",
                "quantidade_planejada": 12,
                "ativo": True,
            },
            {
                "codigo": "ATV-004",
                "descricao": "Testes de continuidade",
                "unidade": "circuito",
                "projeto_id": "",
                "quantidade_planejada": 80,
                "ativo": True,
            },
        ],
        "categorias_impedimento": [
            "Falta de material",
            "Projeto pendente",
            "Acesso não liberado",
            "Interferência civil",
            "Equipamento indisponível",
            "Condição climática",
            "Falta de energia",
            "Ausência de funcionário",
            "Aguardando cliente",
            "Retrabalho",
            "Outro",
        ],
        "unidades": ["un", "m", "m²", "m³", "kg", "h", "circuito", "ponto"],
        "veiculos": ["Veículo 01", "Veículo 02"],
    }


class Database:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        con = sqlite3.connect(self.path)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys=ON")
        con.execute("PRAGMA journal_mode=WAL")
        try:
            yield con
            con.commit()
        finally:
            con.close()

    @staticmethod
    def _ensure_column(con: sqlite3.Connection, table: str, column: str, definition: str) -> None:
        existing = {row[1] for row in con.execute(f"PRAGMA table_info({table})").fetchall()}
        if column not in existing:
            con.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    def initialize(self) -> None:
        with self.connect() as con:
            con.executescript(
                """
                CREATE TABLE IF NOT EXISTS diarios (
                    registro_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    diario_id TEXT NOT NULL,
                    revisao INTEGER NOT NULL DEFAULT 1,
                    projeto_id TEXT NOT NULL,
                    projeto_nome TEXT NOT NULL,
                    cliente TEXT DEFAULT '',
                    data TEXT NOT NULL,
                    equipe_id TEXT NOT NULL,
                    equipe_nome TEXT NOT NULL,
                    encarregado TEXT NOT NULL,
                    turno_inicio TEXT DEFAULT '',
                    turno_fim TEXT DEFAULT '',
                    pessoas_count INTEGER NOT NULL DEFAULT 0,
                    homens_hora REAL NOT NULL DEFAULT 0,
                    atividades_count INTEGER NOT NULL DEFAULT 0,
                    quantidade_total REAL NOT NULL DEFAULT 0,
                    impedimentos_count INTEGER NOT NULL DEFAULT 0,
                    horas_perdidas REAL NOT NULL DEFAULT 0,
                    fotos_count INTEGER NOT NULL DEFAULT 0,
                    total_despesas REAL NOT NULL DEFAULT 0,
                    km_rodado REAL NOT NULL DEFAULT 0,
                    status_aprovacao TEXT NOT NULL DEFAULT 'pendente',
                    observacao_aprovacao TEXT DEFAULT '',
                    origem_formato TEXT NOT NULL,
                    importado_em TEXT NOT NULL,
                    checksum TEXT NOT NULL,
                    dados_json TEXT NOT NULL,
                    validacao_json TEXT NOT NULL DEFAULT '{}',
                    pdf_path TEXT DEFAULT '',
                    package_path TEXT DEFAULT '',
                    UNIQUE(diario_id, revisao)
                );

                CREATE INDEX IF NOT EXISTS idx_diarios_data ON diarios(data);
                CREATE INDEX IF NOT EXISTS idx_diarios_projeto ON diarios(projeto_id);
                CREATE INDEX IF NOT EXISTS idx_diarios_status ON diarios(status_aprovacao);

                CREATE TABLE IF NOT EXISTS config (
                    chave TEXT PRIMARY KEY,
                    valor_json TEXT NOT NULL,
                    atualizado_em TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data_hora TEXT NOT NULL,
                    acao TEXT NOT NULL,
                    entidade TEXT NOT NULL,
                    entidade_id TEXT DEFAULT '',
                    detalhes_json TEXT NOT NULL DEFAULT '{}'
                );
                """
            )
            # Migração segura para bancos criados pela versão 1.0.
            self._ensure_column(con, "diarios", "total_despesas", "REAL NOT NULL DEFAULT 0")
            self._ensure_column(con, "diarios", "km_rodado", "REAL NOT NULL DEFAULT 0")

            row = con.execute("SELECT chave FROM config WHERE chave='field_config'").fetchone()
            if not row:
                cfg = FieldConfig.model_validate(default_config()).model_dump(mode="json")
                con.execute(
                    "INSERT INTO config(chave, valor_json, atualizado_em) VALUES(?,?,?)",
                    ("field_config", json.dumps(cfg, ensure_ascii=False), datetime.now().isoformat()),
                )
            else:
                # Acrescenta novos campos de configuração sem apagar cadastros existentes.
                current = json.loads(con.execute("SELECT valor_json FROM config WHERE chave='field_config'").fetchone()[0])
                merged = {**default_config(), **current}
                merged.setdefault("veiculos", [])
                merged["schema_version"] = "1.1"
                clean = FieldConfig.model_validate(merged).model_dump(mode="json")
                con.execute(
                    "UPDATE config SET valor_json=?, atualizado_em=? WHERE chave='field_config'",
                    (json.dumps(clean, ensure_ascii=False), datetime.now().isoformat()),
                )

    def log(self, action: str, entity: str, entity_id: str = "", details: dict[str, Any] | None = None) -> None:
        with self.connect() as con:
            con.execute(
                "INSERT INTO audit_log(data_hora, acao, entidade, entidade_id, detalhes_json) VALUES(?,?,?,?,?)",
                (datetime.now().isoformat(), action, entity, entity_id, json.dumps(details or {}, ensure_ascii=False)),
            )

    def get_config(self) -> dict[str, Any]:
        with self.connect() as con:
            row = con.execute("SELECT valor_json FROM config WHERE chave='field_config'").fetchone()
            return json.loads(row["valor_json"]) if row else default_config()

    def save_config(self, config: dict[str, Any]) -> dict[str, Any]:
        clean = FieldConfig.model_validate(config).model_dump(mode="json")
        with self.connect() as con:
            con.execute(
                """
                INSERT INTO config(chave, valor_json, atualizado_em) VALUES('field_config', ?, ?)
                ON CONFLICT(chave) DO UPDATE SET valor_json=excluded.valor_json, atualizado_em=excluded.atualizado_em
                """,
                (json.dumps(clean, ensure_ascii=False), datetime.now().isoformat()),
            )
        self.log("atualizar", "configuracao", "field_config")
        return clean
