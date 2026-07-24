from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class PersonEntry(BaseModel):
    funcionario_id: str = ""
    nome: str = ""
    funcao: str = ""
    presente: bool = True
    horas_normais: float = Field(default=0, ge=0)
    horas_extras: float = Field(default=0, ge=0)
    observacao: str = ""


class ActivityEntry(BaseModel):
    id: str = ""
    codigo: str = ""
    descricao: str
    local: str = ""
    quantidade: float = Field(default=0, ge=0)
    unidade: str = "un"
    percentual_conclusao: float = 0
    observacao: str = ""

    @field_validator("percentual_conclusao")
    @classmethod
    def percent_range(cls, value: float) -> float:
        return max(0, min(100, value))


class MaterialEntry(BaseModel):
    id: str = ""
    descricao: str
    tipo: Literal["recebido", "utilizado", "faltante"] = "utilizado"
    quantidade: float = Field(default=0, ge=0)
    unidade: str = "un"
    observacao: str = ""


class EquipmentEntry(BaseModel):
    id: str = ""
    descricao: str
    status: Literal["utilizado", "parado", "indisponivel"] = "utilizado"
    horas: float = Field(default=0, ge=0)
    observacao: str = ""


class ObstructionEntry(BaseModel):
    id: str = ""
    categoria: str
    descricao: str = ""
    impacto: Literal["sem_interrupcao", "parcial", "total"] = "parcial"
    inicio: str = ""
    fim: str = ""
    horas_perdidas: float = Field(default=0, ge=0)
    responsavel: str = ""
    acao_necessaria: str = ""
    prazo: str = ""
    status: Literal["aberto", "resolvido"] = "aberto"


class SafetyData(BaseModel):
    dds_realizado: bool = False
    apr_disponivel: bool = False
    epis_conformes: bool = False
    isolamento_area: bool = False
    permissao_trabalho: bool = False
    houve_ocorrencia: bool = False
    descricao_ocorrencia: str = ""


class MealEntry(BaseModel):
    quantidade: int = Field(default=0, ge=0)
    valor_unitario: float = Field(default=0, ge=0)


class ExtraExpenseEntry(BaseModel):
    id: str = ""
    descricao: str = ""
    valor: float = Field(default=0, ge=0)


class ExpenseData(BaseModel):
    cafe_manha: MealEntry = Field(default_factory=MealEntry)
    almoco: MealEntry = Field(default_factory=MealEntry)
    cafe_tarde: MealEntry = Field(default_factory=MealEntry)
    jantar: MealEntry = Field(default_factory=MealEntry)
    extras: list[ExtraExpenseEntry] = Field(default_factory=list)
    abastecimento: float = Field(default=0, ge=0)
    observacao: str = ""

    def total(self) -> float:
        meals = (
            self.cafe_manha.quantidade * self.cafe_manha.valor_unitario
            + self.almoco.quantidade * self.almoco.valor_unitario
            + self.cafe_tarde.quantidade * self.cafe_tarde.valor_unitario
            + self.jantar.quantidade * self.jantar.valor_unitario
        )
        return float(meals + self.abastecimento + sum(item.valor for item in self.extras))


class TravelData(BaseModel):
    veiculo: str = ""
    placa: str = ""
    km_inicial: float = Field(default=0, ge=0)
    km_final: float = Field(default=0, ge=0)
    observacao: str = ""

    def km_rodado(self) -> float:
        if self.km_final <= 0 or self.km_inicial <= 0:
            return 0.0
        return max(0.0, self.km_final - self.km_inicial)


class PhotoEntry(BaseModel):
    id: str
    nome: str
    legenda: str = ""
    vinculo_tipo: str = "geral"
    vinculo_id: str = ""
    data_hora: str = ""
    # data_url é opcional na importação, porque as imagens podem vir separadas no ZIP.
    data_url: str | None = None


class SignatureEntry(BaseModel):
    nome: str = ""
    funcao: str = ""
    data_hora: str = ""
    data_url: str | None = None


class ProjectRef(BaseModel):
    id: str
    nome: str
    cliente: str = ""
    local: str = ""
    contrato: str = ""
    centro_custo: str = ""


class TeamRef(BaseModel):
    id: str
    nome: str


class DiaryPayload(BaseModel):
    schema_version: str = "1.1"
    app_version: str = "1.1.0"
    diario_id: str
    revisao: int = Field(default=1, ge=1)
    projeto: ProjectRef
    data: str
    equipe: TeamRef
    encarregado: str
    turno_inicio: str = "07:00"
    turno_fim: str = "17:00"
    intervalo_minutos: int = Field(default=60, ge=0, le=480)
    clima: str = ""
    equipe_presente: list[PersonEntry] = Field(default_factory=list)
    atividades: list[ActivityEntry] = Field(default_factory=list)
    materiais: list[MaterialEntry] = Field(default_factory=list)
    equipamentos: list[EquipmentEntry] = Field(default_factory=list)
    despesas: ExpenseData = Field(default_factory=ExpenseData)
    deslocamento: TravelData = Field(default_factory=TravelData)
    seguranca: SafetyData = Field(default_factory=SafetyData)
    impedimentos: list[ObstructionEntry] = Field(default_factory=list)
    fotos: list[PhotoEntry] = Field(default_factory=list)
    assinatura_encarregado: SignatureEntry = Field(default_factory=SignatureEntry)
    assinatura_fiscal: SignatureEntry | None = None
    observacoes_gerais: str = ""
    status: Literal["rascunho", "finalizado"] = "finalizado"
    finalizado_em: str = ""
    origem: str = "aplicativo_campo"

    @field_validator("data")
    @classmethod
    def valid_date(cls, value: str) -> str:
        date.fromisoformat(value)
        return value

    @model_validator(mode="after")
    def check_travel(self) -> "DiaryPayload":
        # Não rejeita o diário, porque pode haver correção administrativa posterior.
        return self


class ConfigProject(BaseModel):
    id: str
    nome: str
    cliente: str = ""
    local: str = ""
    contrato: str = ""
    centro_custo: str = ""
    ativo: bool = True


class ConfigWorker(BaseModel):
    id: str
    nome: str
    funcao: str = ""
    ativo: bool = True


class ConfigTeam(BaseModel):
    id: str
    nome: str
    encarregado: str = ""
    membros: list[str] = Field(default_factory=list)
    ativo: bool = True


class ConfigActivity(BaseModel):
    codigo: str
    descricao: str
    unidade: str = "un"
    projeto_id: str = ""
    quantidade_planejada: float = 0
    ativo: bool = True


class FieldConfig(BaseModel):
    schema_version: str = "1.1"
    empresa: str = "Minha Empresa"
    projetos: list[ConfigProject] = Field(default_factory=list)
    funcionarios: list[ConfigWorker] = Field(default_factory=list)
    equipes: list[ConfigTeam] = Field(default_factory=list)
    atividades: list[ConfigActivity] = Field(default_factory=list)
    categorias_impedimento: list[str] = Field(default_factory=list)
    unidades: list[str] = Field(default_factory=lambda: ["un", "m", "m²", "m³", "kg", "h"])
    veiculos: list[str] = Field(default_factory=list)


class ApprovalUpdate(BaseModel):
    status: Literal["pendente", "aprovado", "rejeitado", "ressalva"]
    observacao: str = ""


class ImportResult(BaseModel):
    ok: bool
    registro_id: int | None = None
    diario_id: str | None = None
    revisao: int | None = None
    status: str
    mensagens: list[str] = Field(default_factory=list)
    dados: dict[str, Any] | None = None
