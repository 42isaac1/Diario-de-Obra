from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path
from typing import Any

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.acroform import AcroForm
from reportlab.pdfgen import canvas


BRAND = colors.HexColor("#123B56")
BRAND_LIGHT = colors.HexColor("#EAF1F5")
INK = colors.HexColor("#17212B")
MUTED = colors.HexColor("#5D6A75")
LINE = colors.HexColor("#B9C5CD")


def _field_value(field: Any) -> str:
    if field is None:
        return ""
    value = field.get("/V") if isinstance(field, dict) else getattr(field, "value", "")
    if value is None:
        return ""
    text = str(value)
    return text[1:] if text.startswith("/") else text


def _number(value: str, default: float = 0) -> float:
    clean = (value or "").strip().replace(" ", "")
    if not clean:
        return default
    if "," in clean and "." in clean:
        clean = clean.replace(".", "").replace(",", ".")
    else:
        clean = clean.replace(",", ".")
    try:
        return float(clean)
    except ValueError:
        return default


def _integer(value: str, default: int = 0) -> int:
    try:
        return max(0, int(round(_number(value, default))))
    except (TypeError, ValueError):
        return default


def extract_payload_from_pdf(content: bytes) -> tuple[dict[str, Any] | None, list[str]]:
    messages: list[str] = []
    reader = PdfReader(BytesIO(content))
    fields = reader.get_fields() or {}

    structured = fields.get("app.dados_json")
    if structured:
        raw = _field_value(structured)
        try:
            return json.loads(raw), ["Dados estruturados extraídos do PDF."]
        except json.JSONDecodeError as exc:
            messages.append(f"Campo estruturado do PDF inválido: {exc}")

    if not fields:
        return None, ["O PDF não possui campos importáveis."]

    def get(name: str) -> str:
        return _field_value(fields.get(name))

    project_id = get("projeto_id")
    project_name = get("projeto_nome")
    diary_date = get("data")
    team_id = get("equipe_id")
    team_name = get("equipe_nome")
    leader = get("encarregado")
    if not all([project_id, project_name, diary_date, team_id, team_name, leader]):
        return None, ["PDF preenchível encontrado, porém faltam campos mínimos de identificação."]

    people = []
    for index in range(1, 9):
        name = get(f"pessoa_{index}_nome")
        if name:
            people.append(
                {
                    "funcionario_id": get(f"pessoa_{index}_id"),
                    "nome": name,
                    "funcao": get(f"pessoa_{index}_funcao"),
                    "presente": True,
                    "horas_normais": _number(get(f"pessoa_{index}_horas")),
                    "horas_extras": _number(get(f"pessoa_{index}_extras")),
                    "observacao": get(f"pessoa_{index}_observacao"),
                }
            )

    activities = []
    for index in range(1, 9):
        description = get(f"atividade_{index}_descricao")
        if description:
            activities.append(
                {
                    "id": f"CONT-{index}",
                    "codigo": get(f"atividade_{index}_codigo"),
                    "descricao": description,
                    "local": get(f"atividade_{index}_local"),
                    "quantidade": _number(get(f"atividade_{index}_quantidade")),
                    "unidade": get(f"atividade_{index}_unidade") or "un",
                    "percentual_conclusao": _number(get(f"atividade_{index}_percentual")),
                    "observacao": get(f"atividade_{index}_observacao"),
                }
            )

    obstructions = []
    for index in range(1, 5):
        category = get(f"impedimento_{index}_categoria")
        if category:
            impact = {
                "sem interrupcao": "sem_interrupcao",
                "sem_interrupcao": "sem_interrupcao",
                "parcialmente": "parcial",
                "parcial": "parcial",
                "totalmente": "total",
                "total": "total",
            }.get(get(f"impedimento_{index}_impacto").strip().lower(), "parcial")
            obstructions.append(
                {
                    "id": f"CONT-IMP-{index}",
                    "categoria": category,
                    "descricao": get(f"impedimento_{index}_descricao"),
                    "impacto": impact,
                    "inicio": get(f"impedimento_{index}_inicio"),
                    "fim": get(f"impedimento_{index}_fim"),
                    "horas_perdidas": _number(get(f"impedimento_{index}_horas")),
                    "responsavel": get(f"impedimento_{index}_responsavel"),
                    "acao_necessaria": get(f"impedimento_{index}_acao"),
                    "prazo": get(f"impedimento_{index}_prazo"),
                    "status": "aberto",
                }
            )

    safe = lambda name: get(name).strip().lower() in {"sim", "yes", "true", "1", "on", "checked"}
    diary_id = get("diario_id") or f"DO-{diary_date.replace('-', '')}-{project_id}-{team_id}"
    try:
        revision = max(1, int(_number(get("revisao"), 1)))
    except (TypeError, ValueError):
        revision = 1

    extras = []
    for index in range(1, 4):
        description = get(f"despesa_extra_{index}_descricao")
        value = _number(get(f"despesa_extra_{index}_valor"))
        if description or value:
            extras.append({"id": f"CONT-DESP-{index}", "descricao": description, "valor": value})

    payload = {
        "schema_version": "1.1",
        "app_version": "1.1.0-contingencia",
        "diario_id": diary_id,
        "revisao": revision,
        "projeto": {
            "id": project_id,
            "nome": project_name,
            "cliente": get("cliente"),
            "local": get("local"),
            "contrato": get("contrato"),
            "centro_custo": get("centro_custo"),
        },
        "data": diary_date,
        "equipe": {"id": team_id, "nome": team_name},
        "encarregado": leader,
        "turno_inicio": get("turno_inicio") or "07:00",
        "turno_fim": get("turno_fim") or "17:00",
        "intervalo_minutos": _integer(get("intervalo_minutos"), 60),
        "clima": get("clima"),
        "equipe_presente": people,
        "atividades": activities,
        "materiais": [],
        "equipamentos": [],
        "despesas": {
            "cafe_manha": {"quantidade": _integer(get("cafe_manha_quantidade")), "valor_unitario": _number(get("cafe_manha_valor_unitario"))},
            "almoco": {"quantidade": _integer(get("almoco_quantidade")), "valor_unitario": _number(get("almoco_valor_unitario"))},
            "cafe_tarde": {"quantidade": _integer(get("cafe_tarde_quantidade")), "valor_unitario": _number(get("cafe_tarde_valor_unitario"))},
            "jantar": {"quantidade": _integer(get("jantar_quantidade")), "valor_unitario": _number(get("jantar_valor_unitario"))},
            "extras": extras,
            "abastecimento": _number(get("abastecimento_valor")),
            "observacao": get("despesas_observacao"),
        },
        "deslocamento": {
            "veiculo": get("veiculo"),
            "placa": get("placa"),
            "km_inicial": _number(get("km_inicial")),
            "km_final": _number(get("km_final")),
            "observacao": get("deslocamento_observacao"),
        },
        "seguranca": {
            "dds_realizado": safe("seg_dds"),
            "apr_disponivel": safe("seg_apr"),
            "epis_conformes": safe("seg_epi"),
            "isolamento_area": safe("seg_isolamento"),
            "permissao_trabalho": safe("seg_pt"),
            "houve_ocorrencia": safe("seg_ocorrencia"),
            "descricao_ocorrencia": get("seg_descricao"),
        },
        "impedimentos": obstructions,
        "fotos": [],
        "assinatura_encarregado": {
            "nome": get("responsavel_ur") or leader,
            "funcao": "Encarregado",
            "data_hora": get("assinatura_data"),
        },
        "assinatura_fiscal": {
            "nome": get("cliente_responsavel"),
            "funcao": "Responsável do cliente",
            "data_hora": get("assinatura_cliente_data"),
        } if get("cliente_responsavel") else None,
        "observacoes_gerais": get("observacoes_gerais"),
        "status": "finalizado",
        "finalizado_em": get("assinatura_data"),
        "origem": "pdf_contingencia",
    }
    messages.append("Dados extraídos do PDF preenchível de contingência.")
    return payload, messages


def generate_contingency_pdf(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    width, height = A4
    c = canvas.Canvas(str(output_path), pagesize=A4)
    c.setTitle("Diário de Obra - Formulário Preenchível de Contingência")
    c.setAuthor("Diário de Obra Suite")
    form: AcroForm = c.acroForm

    def txt(x: float, y: float, value: str, size: int = 7, bold: bool = False, color=INK) -> None:
        c.setFillColor(color)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.drawString(x, y, value)

    def header(page_title: str, page_no: int) -> float:
        c.setFillColor(BRAND)
        c.rect(0, height - 66, width, 66, fill=1, stroke=0)
        txt(30, height - 32, "JR INSTALAÇÕES ELÉTRICAS", 14, True, colors.white)
        txt(30, height - 50, page_title, 8, False, colors.HexColor("#DDEAF1"))
        txt(width - 90, height - 40, f"PÁG. {page_no}/4", 8, True, colors.white)
        txt(30, 18, "Formulário de contingência - salve o PDF original preenchido para importação automática.", 6, False, MUTED)
        return height - 92

    def section(y: float, title: str) -> float:
        c.setFillColor(BRAND_LIGHT)
        c.roundRect(28, y - 17, width - 56, 23, 3, fill=1, stroke=0)
        txt(36, y - 9, title, 8, True, BRAND)
        return y - 29

    def field(name: str, x: float, y: float, w: float, h: float = 17, font_size: int = 7, multiline: bool = False) -> None:
        form.textfield(
            name=name, x=x, y=y, width=w, height=h,
            borderStyle="solid", borderWidth=0.6, borderColor=LINE,
            fillColor=colors.white, textColor=INK, forceBorder=True,
            fontName="Helvetica", fontSize=font_size,
            fieldFlags=4096 if multiline else 0,
        )

    def labeled(name: str, label: str, x: float, y: float, w: float, h: float = 17, multiline: bool = False) -> None:
        txt(x, y + h + 3, label, 6, True, MUTED)
        field(name, x, y, w, h, 7, multiline)

    def checkbox(name: str, label: str, x: float, y: float) -> None:
        form.checkbox(
            name=name, x=x, y=y, buttonStyle="check", borderWidth=0.8,
            borderColor=LINE, fillColor=colors.white, textColor=BRAND,
            checked=False, size=12,
        )
        txt(x + 17, y + 3, label, 7, False, INK)

    # PÁGINA 1 - IDENTIFICAÇÃO E EQUIPE -------------------------------------
    y = header("DIÁRIO DE OBRA - IDENTIFICAÇÃO E EQUIPE", 1)
    y = section(y, "IDENTIFICAÇÃO")
    labeled("diario_id", "ID DO DIÁRIO", 30, y - 18, 220)
    labeled("revisao", "REVISÃO", 260, y - 18, 55)
    labeled("data", "DATA (AAAA-MM-DD)", 325, y - 18, 120)
    labeled("projeto_id", "Nº / CÓDIGO DA OBRA", 455, y - 18, 110)
    y -= 51
    labeled("cliente", "CLIENTE", 30, y - 18, 250)
    labeled("projeto_nome", "OBRA", 290, y - 18, 275)
    y -= 51
    labeled("local", "ENDEREÇO / LOCAL", 30, y - 18, 300)
    labeled("contrato", "CONTRATO", 340, y - 18, 105)
    labeled("centro_custo", "CENTRO DE CUSTO", 455, y - 18, 110)
    y -= 51
    labeled("equipe_id", "CÓDIGO DA EQUIPE", 30, y - 18, 105)
    labeled("equipe_nome", "EQUIPE", 145, y - 18, 165)
    labeled("encarregado", "ENCARREGADO", 320, y - 18, 245)
    y -= 51
    labeled("turno_inicio", "INÍCIO", 30, y - 18, 70)
    labeled("turno_fim", "SAÍDA", 110, y - 18, 70)
    labeled("intervalo_minutos", "INTERVALO (MIN)", 190, y - 18, 85)
    labeled("clima", "CLIMA / CONDIÇÃO DO TEMPO", 285, y - 18, 280)
    y -= 55

    y = section(y, "EFETIVO DO DIA")
    headers = [("ID", 54), ("NOME", 160), ("FUNÇÃO", 122), ("H. NORMAL", 62), ("H. EXTRA", 58), ("OBSERVAÇÃO", 90)]
    x = 30
    xs: list[float] = []
    for label, w in headers:
        xs.append(x)
        txt(x + 2, y - 1, label, 6, True, MUTED)
        x += w + 4
    y -= 19
    widths = [54, 160, 122, 62, 58, 90]
    for idx in range(1, 9):
        names = [f"pessoa_{idx}_id", f"pessoa_{idx}_nome", f"pessoa_{idx}_funcao", f"pessoa_{idx}_horas", f"pessoa_{idx}_extras", f"pessoa_{idx}_observacao"]
        for xpos, name, w in zip(xs, names, widths):
            field(name, xpos, y, w, 14, 6)
        y -= 18

    y -= 10
    c.setFillColor(BRAND_LIGHT)
    c.roundRect(30, y - 50, 535, 55, 4, fill=1, stroke=0)
    txt(40, y - 15, "PREENCHIMENTO RÁPIDO", 7, True, BRAND)
    txt(40, y - 31, "Registre as atividades nas páginas seguintes. Quantidades, despesas e quilômetros serão calculados pelo gerenciador.", 7, False, INK)
    c.showPage()

    # PÁGINA 2 - ATIVIDADES --------------------------------------------------
    y = header("DIÁRIO DE OBRA - ATIVIDADES EXECUTADAS", 2)
    y = section(y, "SERVIÇOS EXECUTADOS E RESPONSÁVEL NA OBRA")
    for idx in range(1, 9):
        txt(30, y - 2, f"{idx}.", 7, True, BRAND)
        labeled(f"atividade_{idx}_codigo", "CÓDIGO", 48, y - 21, 62)
        labeled(f"atividade_{idx}_descricao", "DESCRIÇÃO", 116, y - 21, 205)
        labeled(f"atividade_{idx}_local", "LOCAL / FRENTE", 327, y - 21, 98)
        labeled(f"atividade_{idx}_quantidade", "QTD.", 431, y - 21, 43)
        labeled(f"atividade_{idx}_unidade", "UN.", 480, y - 21, 37)
        labeled(f"atividade_{idx}_percentual", "%", 523, y - 21, 42)
        y -= 48
        labeled(f"atividade_{idx}_observacao", "OBSERVAÇÃO", 48, y - 15, 517, 17)
        y -= 39
    c.showPage()

    # PÁGINA 3 - CUSTOS, DESLOCAMENTO E SEGURANÇA ---------------------------
    y = header("DIÁRIO DE OBRA - DESPESAS, DESLOCAMENTO E SEGURANÇA", 3)
    y = section(y, "DESPESAS DIÁRIAS")
    txt(30, y, "TIPO", 6, True, MUTED)
    txt(190, y, "QUANTIDADE", 6, True, MUTED)
    txt(285, y, "VALOR UNITÁRIO (R$)", 6, True, MUTED)
    txt(425, y, "TOTAL", 6, True, MUTED)
    y -= 18
    for key, label in [("cafe_manha", "Café da manhã"), ("almoco", "Almoço"), ("cafe_tarde", "Café da tarde"), ("jantar", "Jantar")]:
        txt(30, y + 5, label, 7)
        field(f"{key}_quantidade", 190, y, 75, 16)
        field(f"{key}_valor_unitario", 285, y, 115, 16)
        txt(425, y + 5, "Calculado no gerenciador", 6, False, MUTED)
        y -= 23
    y -= 8
    for idx in range(1, 4):
        labeled(f"despesa_extra_{idx}_descricao", f"DESPESA EXTRA {idx} - DESCRIÇÃO", 30, y - 17, 355)
        labeled(f"despesa_extra_{idx}_valor", "VALOR (R$)", 395, y - 17, 100)
        y -= 45
    labeled("abastecimento_valor", "ABASTECIMENTO (R$)", 30, y - 17, 120)
    labeled("despesas_observacao", "OBSERVAÇÃO DAS DESPESAS", 160, y - 17, 405)
    y -= 52

    y = section(y, "DESLOCAMENTO")
    labeled("veiculo", "VEÍCULO", 30, y - 18, 170)
    labeled("placa", "PLACA", 210, y - 18, 85)
    labeled("km_inicial", "KM INICIAL", 305, y - 18, 85)
    labeled("km_final", "KM FINAL", 400, y - 18, 85)
    labeled("deslocamento_observacao", "OBSERVAÇÃO", 495, y - 18, 70)
    y -= 55

    y = section(y, "SEGURANÇA")
    checkbox("seg_dds", "DDS realizado", 30, y - 14)
    checkbox("seg_apr", "APR disponível", 155, y - 14)
    checkbox("seg_epi", "EPI conforme", 280, y - 14)
    checkbox("seg_isolamento", "Área isolada", 395, y - 14)
    y -= 30
    checkbox("seg_pt", "Permissão de trabalho", 30, y - 14)
    checkbox("seg_ocorrencia", "Ocorrência / quase acidente", 210, y - 14)
    y -= 32
    labeled("seg_descricao", "DESCRIÇÃO DA OCORRÊNCIA", 30, y - 45, 535, 44, True)
    y -= 62

    c.setFillColor(BRAND_LIGHT)
    c.roundRect(30, y - 40, 535, 45, 4, fill=1, stroke=0)
    txt(40, y - 13, "COMPROVANTES", 7, True, BRAND)
    txt(40, y - 28, "Envie comprovantes e fotos junto ao PDF ou use o aplicativo de campo para gerar um pacote completo.", 7, False, INK)
    c.showPage()

    # PÁGINA 4 - IMPEDIMENTOS E ASSINATURAS --------------------------------
    y = header("DIÁRIO DE OBRA - IMPEDIMENTOS, OBSERVAÇÕES E APROVAÇÃO", 4)
    y = section(y, "IMPEDIMENTOS / RESTRIÇÕES")
    for idx in range(1, 5):
        txt(30, y - 1, f"{idx}.", 7, True, BRAND)
        labeled(f"impedimento_{idx}_categoria", "CATEGORIA", 48, y - 20, 142)
        labeled(f"impedimento_{idx}_impacto", "IMPACTO", 196, y - 20, 85)
        labeled(f"impedimento_{idx}_inicio", "INÍCIO", 287, y - 20, 58)
        labeled(f"impedimento_{idx}_fim", "FIM", 351, y - 20, 58)
        labeled(f"impedimento_{idx}_horas", "H. PERDIDAS", 415, y - 20, 70)
        labeled(f"impedimento_{idx}_prazo", "PRAZO", 491, y - 20, 74)
        y -= 49
        labeled(f"impedimento_{idx}_descricao", "DESCRIÇÃO", 48, y - 17, 242)
        labeled(f"impedimento_{idx}_responsavel", "RESPONSÁVEL", 296, y - 17, 125)
        labeled(f"impedimento_{idx}_acao", "AÇÃO NECESSÁRIA", 427, y - 17, 138)
        y -= 50

    y = section(y, "OBSERVAÇÕES GERAIS")
    field("observacoes_gerais", 30, y - 72, 535, 68, 7, True)
    y -= 90

    y = section(y, "RESPONSÁVEIS E ASSINATURAS")
    labeled("responsavel_ur", "RESPONSÁVEL DA EQUIPE / UR", 30, y - 18, 250)
    labeled("assinatura_data", "DATA E HORA", 290, y - 18, 135)
    txt(435, y + 3, "ASSINATURA MANUAL", 6, True, MUTED)
    c.line(435, y - 17, 565, y - 17)
    y -= 55
    labeled("cliente_responsavel", "RESPONSÁVEL DO CLIENTE", 30, y - 18, 250)
    labeled("assinatura_cliente_data", "DATA E HORA", 290, y - 18, 135)
    txt(435, y + 3, "ASSINATURA MANUAL", 6, True, MUTED)
    c.line(435, y - 17, 565, y - 17)
    y -= 60

    c.setFillColor(BRAND_LIGHT)
    c.roundRect(30, y - 30, 535, 36, 4, fill=1, stroke=0)
    txt(40, y - 9, "IMPORTAÇÃO", 7, True, BRAND)
    txt(40, y - 22, "Salve este arquivo sem imprimir/achatar. No Gestor, use a aba Importar e selecione o PDF preenchido.", 7, False, INK)
    c.save()

