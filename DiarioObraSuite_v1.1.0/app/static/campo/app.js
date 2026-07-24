"use strict";
const { useEffect, useMemo, useRef, useState } = React;
const APP_VERSION = "1.1.0";
const DRAFT_KEY = "diario_atual";
const CONFIG_KEY = "diario_config_v1";
const DEFAULT_CONFIG = {
    schema_version: "1.1",
    empresa: "JR Instalações Elétricas",
    projetos: [
        { id: "OBR-001", nome: "Ampliação de Subestação", cliente: "Cliente Demonstração", local: "Divinópolis/MG", contrato: "CT-2026-001", centro_custo: "CC-1001", ativo: true },
        { id: "OBR-002", nome: "Montagem de Painéis Elétricos", cliente: "Cliente Industrial", local: "Betim/MG", contrato: "CT-2026-002", centro_custo: "CC-1002", ativo: true }
    ],
    funcionarios: [
        { id: "FUN-001", nome: "João da Silva", funcao: "Encarregado", ativo: true },
        { id: "FUN-002", nome: "Carlos Souza", funcao: "Eletricista", ativo: true },
        { id: "FUN-003", nome: "Marcos Lima", funcao: "Eletricista", ativo: true },
        { id: "FUN-004", nome: "Paulo Santos", funcao: "Ajudante", ativo: true }
    ],
    equipes: [{ id: "EQ-01", nome: "Equipe Elétrica 01", encarregado: "João da Silva", membros: ["FUN-001", "FUN-002", "FUN-003", "FUN-004"], ativo: true }],
    atividades: [
        { codigo: "ATV-001", descricao: "Montagem de eletrocalhas", unidade: "m", projeto_id: "", quantidade_planejada: 500, ativo: true },
        { codigo: "ATV-002", descricao: "Lançamento de cabos", unidade: "m", projeto_id: "", quantidade_planejada: 2000, ativo: true },
        { codigo: "ATV-003", descricao: "Instalação de painéis", unidade: "un", projeto_id: "", quantidade_planejada: 12, ativo: true },
        { codigo: "ATV-004", descricao: "Testes de continuidade", unidade: "circuito", projeto_id: "", quantidade_planejada: 80, ativo: true }
    ],
    categorias_impedimento: ["Falta de material", "Projeto pendente", "Acesso não liberado", "Interferência civil", "Equipamento indisponível", "Condição climática", "Falta de energia", "Ausência de funcionário", "Aguardando cliente", "Retrabalho", "Outro"],
    unidades: ["un", "m", "m²", "m³", "kg", "h", "circuito", "ponto"],
    veiculos: ["Veículo 01", "Veículo 02"]
};
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatNumber = (value, digits = 1) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value || 0);
const htmlEscape = (value) => value.replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c] || c));
function loadConfig() {
    try {
        const raw = localStorage.getItem(CONFIG_KEY);
        return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
    }
    catch {
        return DEFAULT_CONFIG;
    }
}
function membersForTeam(config, teamId) {
    const team = config.equipes.find(t => t.id === teamId) || config.equipes[0];
    if (!team)
        return [];
    return team.membros.map(id => config.funcionarios.find(f => f.id === id)).filter(Boolean).map(worker => ({
        funcionario_id: worker.id,
        nome: worker.nome,
        funcao: worker.funcao,
        presente: true,
        horas_normais: 8,
        horas_extras: 0,
        observacao: ""
    }));
}
function makeDiary(config) {
    const project = config.projetos.find(p => p.ativo) || config.projetos[0];
    const team = config.equipes.find(t => t.ativo) || config.equipes[0];
    const date = todayISO();
    const projectId = project?.id || "OBRA";
    const teamId = team?.id || "EQUIPE";
    return {
        schema_version: "1.1",
        app_version: APP_VERSION,
        diario_id: `DO-${date.replace(/-/g, "")}-${projectId}-${teamId}`,
        revisao: 1,
        projeto: { id: projectId, nome: project?.nome || "", cliente: project?.cliente || "", local: project?.local || "", contrato: project?.contrato || "", centro_custo: project?.centro_custo || "" },
        data: date,
        equipe: { id: teamId, nome: team?.nome || "" },
        encarregado: team?.encarregado || "",
        turno_inicio: "07:00",
        turno_fim: "17:00",
        intervalo_minutos: 60,
        clima: "",
        equipe_presente: membersForTeam(config, teamId),
        atividades: [],
        materiais: [],
        equipamentos: [],
        despesas: { cafe_manha: { quantidade: 0, valor_unitario: 0 }, almoco: { quantidade: 0, valor_unitario: 0 }, cafe_tarde: { quantidade: 0, valor_unitario: 0 }, jantar: { quantidade: 0, valor_unitario: 0 }, extras: [], abastecimento: 0, observacao: "" },
        deslocamento: { veiculo: "", placa: "", km_inicial: 0, km_final: 0, observacao: "" },
        seguranca: { dds_realizado: false, apr_disponivel: false, epis_conformes: false, isolamento_area: false, permissao_trabalho: false, houve_ocorrencia: false, descricao_ocorrencia: "" },
        impedimentos: [],
        fotos: [],
        assinatura_encarregado: { nome: team?.encarregado || "", funcao: "Encarregado", data_hora: "" },
        observacoes_gerais: "",
        status: "rascunho",
        finalizado_em: "",
        origem: "aplicativo_campo"
    };
}
function normalizeDiary(diary) {
    return {
        ...diary,
        schema_version: diary.schema_version || "1.1",
        app_version: APP_VERSION,
        intervalo_minutos: diary.intervalo_minutos ?? 60,
        equipe_presente: diary.equipe_presente || [],
        atividades: diary.atividades || [],
        materiais: diary.materiais || [],
        equipamentos: diary.equipamentos || [],
        despesas: diary.despesas || { cafe_manha: { quantidade: 0, valor_unitario: 0 }, almoco: { quantidade: 0, valor_unitario: 0 }, cafe_tarde: { quantidade: 0, valor_unitario: 0 }, jantar: { quantidade: 0, valor_unitario: 0 }, extras: [], abastecimento: 0, observacao: "" },
        deslocamento: diary.deslocamento || { veiculo: "", placa: "", km_inicial: 0, km_final: 0, observacao: "" },
        impedimentos: diary.impedimentos || [],
        fotos: diary.fotos || [],
        seguranca: diary.seguranca || { dds_realizado: false, apr_disponivel: false, epis_conformes: false, isolamento_area: false, permissao_trabalho: false, houve_ocorrencia: false, descricao_ocorrencia: "" },
        assinatura_encarregado: diary.assinatura_encarregado || { nome: diary.encarregado || "", funcao: "Encarregado", data_hora: "" }
    };
}
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("diario_obra_campo", 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains("drafts"))
                db.createObjectStore("drafts");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
async function saveDraft(diary) {
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction("drafts", "readwrite");
        tx.objectStore("drafts").put(diary, DRAFT_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}
async function loadDraft() {
    const db = await openDB();
    const value = await new Promise((resolve, reject) => {
        const tx = db.transaction("drafts", "readonly");
        const request = tx.objectStore("drafts").get(DRAFT_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
}
async function clearDraft() {
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction("drafts", "readwrite");
        tx.objectStore("drafts").delete(DRAFT_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}
async function compressImage(file) {
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
    });
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
}
function portableDiary(diary) {
    return {
        ...diary,
        fotos: diary.fotos.map(({ data_url, ...photo }) => photo),
        assinatura_encarregado: { ...diary.assinatura_encarregado, data_url: undefined },
        assinatura_fiscal: diary.assinatura_fiscal ? { ...diary.assinatura_fiscal, data_url: undefined } : undefined
    };
}
function sha256Fallback(data) {
    const rotateRight = (value, amount) => (value >>> amount) | (value << (32 - amount));
    const constants = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const bitLength = data.length * 8;
    const paddedLength = Math.ceil((data.length + 9) / 64) * 64;
    const bytes = new Uint8Array(paddedLength);
    bytes.set(data);
    bytes[data.length] = 0x80;
    const view = new DataView(bytes.buffer);
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    view.setUint32(paddedLength - 8, high, false);
    view.setUint32(paddedLength - 4, low, false);
    const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const words = new Uint32Array(64);
    for (let offset = 0; offset < paddedLength; offset += 64) {
        for (let i = 0; i < 16; i++)
            words[i] = view.getUint32(offset + i * 4, false);
        for (let i = 16; i < 64; i++) {
            const x = words[i - 15];
            const y = words[i - 2];
            const s0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
            const s1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
            words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, h] = hash;
        for (let i = 0; i < 64; i++) {
            const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
            const choose = (e & f) ^ (~e & g);
            const temp1 = (h + sum1 + choose + constants[i] + words[i]) >>> 0;
            const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
            const majority = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (sum0 + majority) >>> 0;
            h = g;
            g = f;
            f = e;
            e = (d + temp1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) >>> 0;
        }
        hash[0] = (hash[0] + a) >>> 0;
        hash[1] = (hash[1] + b) >>> 0;
        hash[2] = (hash[2] + c) >>> 0;
        hash[3] = (hash[3] + d) >>> 0;
        hash[4] = (hash[4] + e) >>> 0;
        hash[5] = (hash[5] + f) >>> 0;
        hash[6] = (hash[6] + g) >>> 0;
        hash[7] = (hash[7] + h) >>> 0;
    }
    return hash.map(value => value.toString(16).padStart(8, "0")).join("");
}
async function sha256(data) {
    const normalized = new Uint8Array(data.length);
    normalized.set(data);
    if (globalThis.crypto?.subtle) {
        const hash = await globalThis.crypto.subtle.digest("SHA-256", normalized.buffer);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    return sha256Fallback(normalized);
}
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function wrapText(text, maxChars) {
    const paragraphs = (text || "-").split(/\n/);
    const lines = [];
    paragraphs.forEach(paragraph => {
        const words = paragraph.split(/\s+/);
        let line = "";
        words.forEach(word => {
            const candidate = line ? `${line} ${word}` : word;
            if (candidate.length > maxChars && line) {
                lines.push(line);
                line = word;
            }
            else
                line = candidate;
        });
        if (line)
            lines.push(line);
    });
    return lines.length ? lines : ["-"];
}
async function generatePdf(diary, company) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Diário de Obra ${diary.diario_id}`);
    pdf.setAuthor(company || "Diário de Obra Suite");
    pdf.setSubject(`Diário de obra importável ${diary.diario_id}`);
    pdf.setCreator(`Diário de Obra Campo v${APP_VERSION}`);
    pdf.setProducer("pdf-lib");
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const A4 = [595.28, 841.89];
    const margin = 36;
    let page;
    let y = 0;
    const addPage = (title = "DIÁRIO DE OBRA") => {
        page = pdf.addPage(A4);
        const [w, h] = page.getSize();
        page.drawRectangle({ x: 0, y: h - 72, width: w, height: 72, color: rgb(0.058, 0.239, 0.337) });
        page.drawText(company || "DIÁRIO DE OBRA", { x: margin, y: h - 34, size: 14, font: bold, color: rgb(1, 1, 1) });
        page.drawText(title, { x: margin, y: h - 54, size: 8, font, color: rgb(0.85, 0.94, 0.98) });
        page.drawText(`${diary.diario_id} · R${diary.revisao}`, { x: w - 190, y: h - 44, size: 8, font: bold, color: rgb(1, 1, 1) });
        page.drawText(`Página ${pdf.getPageCount()}`, { x: w - 85, y: 22, size: 7, font, color: rgb(0.4, 0.45, 0.5) });
        y = h - 94;
    };
    const ensure = (height, title = "DIÁRIO DE OBRA — CONTINUAÇÃO") => {
        if (y - height < 42)
            addPage(title);
    };
    const section = (title) => {
        ensure(28);
        page.drawRectangle({ x: margin, y: y - 14, width: A4[0] - margin * 2, height: 22, color: rgb(0.90, 0.94, 0.96) });
        page.drawText(title, { x: margin + 8, y: y - 7, size: 9, font: bold, color: rgb(0.06, 0.20, 0.28) });
        y -= 30;
    };
    const line = (label, value, valueX = 150) => {
        ensure(20);
        page.drawText(label, { x: margin, y, size: 7.5, font: bold, color: rgb(0.25, 0.30, 0.35) });
        page.drawText(String(value || "-"), { x: valueX, y, size: 8.5, font, color: rgb(0.05, 0.08, 0.12), maxWidth: A4[0] - valueX - margin });
        y -= 18;
    };
    const paragraph = (label, value) => {
        const lines = wrapText(value || "-", 90);
        ensure(18 + lines.length * 12);
        page.drawText(label, { x: margin, y, size: 7.5, font: bold, color: rgb(0.25, 0.30, 0.35) });
        y -= 13;
        lines.forEach(text => {
            page.drawText(text, { x: margin + 8, y, size: 8, font, color: rgb(0.05, 0.08, 0.12), maxWidth: A4[0] - margin * 2 - 8 });
            y -= 12;
        });
        y -= 4;
    };
    addPage("REGISTRO DIÁRIO DE EXECUÇÃO");
    section("IDENTIFICAÇÃO");
    line("Obra", `${diary.projeto.id} — ${diary.projeto.nome}`);
    line("Cliente", diary.projeto.cliente);
    line("Local", diary.projeto.local);
    line("Contrato / C.C.", `${diary.projeto.contrato || "-"} / ${diary.projeto.centro_custo || "-"}`);
    line("Data", diary.data);
    line("Equipe", `${diary.equipe.id} — ${diary.equipe.nome}`);
    line("Encarregado", diary.encarregado);
    line("Turno", `${diary.turno_inicio} às ${diary.turno_fim} · intervalo ${formatNumber(diary.intervalo_minutos, 0)} min`);
    line("Clima", diary.clima || "Não informado");
    section("EQUIPE PRESENTE");
    diary.equipe_presente.filter(p => p.presente).forEach((person, index) => {
        ensure(24);
        page.drawText(`${index + 1}. ${person.nome}`, { x: margin, y, size: 8.5, font: bold });
        page.drawText(person.funcao || "-", { x: 250, y, size: 8, font });
        page.drawText(`${formatNumber(person.horas_normais)} h + ${formatNumber(person.horas_extras)} h extra`, { x: 400, y, size: 8, font });
        y -= 18;
    });
    if (!diary.equipe_presente.some(p => p.presente))
        paragraph("Registro", "Nenhum integrante marcado como presente.");
    line("Total de homens-hora", `${formatNumber(diary.equipe_presente.filter(p => p.presente).reduce((sum, p) => sum + p.horas_normais + p.horas_extras, 0))} h`);
    section("ATIVIDADES EXECUTADAS");
    diary.atividades.forEach((activity, index) => {
        const lines = wrapText(activity.observacao || "", 75);
        ensure(48 + (activity.observacao ? lines.length * 11 : 0));
        page.drawText(`${index + 1}. ${activity.codigo ? `${activity.codigo} — ` : ""}${activity.descricao}`, { x: margin, y, size: 8.5, font: bold, maxWidth: 515 });
        y -= 14;
        page.drawText(`Local: ${activity.local || "-"} | Executado: ${formatNumber(activity.quantidade)} ${activity.unidade} | Conclusão informada: ${formatNumber(activity.percentual_conclusao, 0)}%`, { x: margin + 8, y, size: 7.8, font });
        y -= 13;
        if (activity.observacao) {
            lines.forEach(text => { page.drawText(text, { x: margin + 8, y, size: 7.5, font, maxWidth: 510 }); y -= 11; });
        }
        y -= 7;
    });
    if (!diary.atividades.length)
        paragraph("Registro", "Nenhuma atividade registrada.");
    section("MATERIAIS E EQUIPAMENTOS");
    diary.materiais.forEach(item => paragraph(`${item.tipo.toUpperCase()} · ${item.descricao}`, `${formatNumber(item.quantidade)} ${item.unidade}${item.observacao ? ` — ${item.observacao}` : ""}`));
    diary.equipamentos.forEach(item => paragraph(`${item.status.toUpperCase()} · ${item.descricao}`, `${formatNumber(item.horas)} h${item.observacao ? ` — ${item.observacao}` : ""}`));
    if (!diary.materiais.length && !diary.equipamentos.length)
        paragraph("Registro", "Sem movimentações ou ocorrências de recursos.");
    section("DESPESAS E DESLOCAMENTO");
    const mealRows = [["Café da manhã", diary.despesas.cafe_manha], ["Almoço", diary.despesas.almoco], ["Café da tarde", diary.despesas.cafe_tarde], ["Jantar", diary.despesas.jantar]];
    mealRows.forEach(([label, meal]) => {
        if (meal.quantidade || meal.valor_unitario)
            line(label, `${formatNumber(meal.quantidade, 0)} × R$ ${formatNumber(meal.valor_unitario, 2)} = R$ ${formatNumber(meal.quantidade * meal.valor_unitario, 2)}`);
    });
    diary.despesas.extras.forEach((item, index) => line(`Despesa extra ${index + 1}`, `${item.descricao || "Sem descrição"} · R$ ${formatNumber(item.valor, 2)}`));
    if (diary.despesas.abastecimento)
        line("Abastecimento", `R$ ${formatNumber(diary.despesas.abastecimento, 2)}`);
    const expenseTotal = mealRows.reduce((sum, [, meal]) => sum + meal.quantidade * meal.valor_unitario, 0) + diary.despesas.abastecimento + diary.despesas.extras.reduce((sum, item) => sum + item.valor, 0);
    line("Total de despesas do dia", `R$ ${formatNumber(expenseTotal, 2)}`);
    const km = diary.deslocamento.km_final > 0 && diary.deslocamento.km_inicial > 0 ? Math.max(0, diary.deslocamento.km_final - diary.deslocamento.km_inicial) : 0;
    line("Veículo", `${diary.deslocamento.veiculo || "-"}${diary.deslocamento.placa ? ` · ${diary.deslocamento.placa}` : ""}`);
    line("Quilometragem", `${formatNumber(diary.deslocamento.km_inicial)} → ${formatNumber(diary.deslocamento.km_final)} km · rodado ${formatNumber(km)} km`);
    if (diary.despesas.observacao)
        paragraph("Observação das despesas", diary.despesas.observacao);
    if (diary.deslocamento.observacao)
        paragraph("Observação do deslocamento", diary.deslocamento.observacao);
    section("SEGURANÇA");
    const safetyLabels = [
        ["DDS realizado", diary.seguranca.dds_realizado], ["APR disponível", diary.seguranca.apr_disponivel],
        ["EPI conforme", diary.seguranca.epis_conformes], ["Área isolada", diary.seguranca.isolamento_area],
        ["Permissão de trabalho", diary.seguranca.permissao_trabalho], ["Houve ocorrência", diary.seguranca.houve_ocorrencia]
    ];
    safetyLabels.forEach(([label, value]) => line(label, value ? "SIM" : "NÃO"));
    if (diary.seguranca.houve_ocorrencia)
        paragraph("Descrição da ocorrência", diary.seguranca.descricao_ocorrencia);
    section("IMPEDIMENTOS");
    diary.impedimentos.forEach((item, index) => {
        paragraph(`${index + 1}. ${item.categoria} · ${item.impacto.replace("_", " ").toUpperCase()}`, `${item.descricao || "Sem descrição"} | Horas perdidas: ${formatNumber(item.horas_perdidas)} | Responsável: ${item.responsavel || "-"} | Ação: ${item.acao_necessaria || "-"}`);
    });
    if (!diary.impedimentos.length)
        paragraph("Registro", "Sem impedimentos no período.");
    section("OBSERVAÇÕES E ASSINATURA");
    paragraph("Observações gerais", diary.observacoes_gerais || "Sem observações adicionais.");
    line("Responsável", `${diary.assinatura_encarregado.nome || diary.encarregado} — ${diary.assinatura_encarregado.funcao || "Encarregado"}`);
    line("Encerrado em", diary.finalizado_em || nowISO());
    if (diary.assinatura_fiscal?.nome)
        line("Responsável do cliente", `${diary.assinatura_fiscal.nome}${diary.assinatura_fiscal.funcao ? ` — ${diary.assinatura_fiscal.funcao}` : ""}`);
    if (diary.assinatura_encarregado.data_url) {
        try {
            const signatureBytes = Uint8Array.from(atob(diary.assinatura_encarregado.data_url.split(",")[1]), c => c.charCodeAt(0));
            const image = await pdf.embedPng(signatureBytes);
            ensure(70);
            page.drawImage(image, { x: margin, y: y - 42, width: 150, height: 55 });
            page.drawLine({ start: { x: margin, y: y - 45 }, end: { x: margin + 190, y: y - 45 }, thickness: 0.5, color: rgb(0.4, 0.4, 0.4) });
            y -= 62;
        }
        catch { /* assinatura inválida não impede o PDF */ }
    }
    for (const photo of diary.fotos) {
        try {
            addPage("REGISTRO FOTOGRÁFICO");
            const bytes = Uint8Array.from(atob(photo.data_url.split(",")[1]), c => c.charCodeAt(0));
            const image = photo.data_url.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
            const dims = image.scale(1);
            const maxW = A4[0] - margin * 2;
            const maxH = 620;
            const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
            const w = dims.width * scale;
            const h = dims.height * scale;
            page.drawImage(image, { x: (A4[0] - w) / 2, y: y - h, width: w, height: h });
            y -= h + 18;
            paragraph("Legenda", photo.legenda || photo.nome);
            line("Vínculo", `${photo.vinculo_tipo}${photo.vinculo_id ? ` — ${photo.vinculo_id}` : ""}`);
            line("Capturada em", photo.data_hora);
        }
        catch { /* foto inválida é ignorada */ }
    }
    // Add machine-readable AcroForm data without changing the visible document.
    addPage("DADOS ESTRUTURADOS PARA IMPORTAÇÃO AUTOMÁTICA");
    paragraph("Informação", "Esta página contém campos técnicos utilizados pelo Gestor de Diários. Não altere os dados manualmente; gere uma nova revisão no aplicativo de campo.");
    const form = pdf.getForm();
    const dataJson = JSON.stringify(portableDiary(diary));
    const structured = form.createTextField("app.dados_json");
    structured.enableMultiline();
    structured.setFontSize(1);
    structured.setText(dataJson);
    structured.addToPage(page, { x: 36, y: 48, width: 2, height: 2, borderWidth: 0, textColor: rgb(1, 1, 1), backgroundColor: rgb(1, 1, 1) });
    const fields = {
        diario_id: diary.diario_id, revisao: String(diary.revisao), data: diary.data,
        projeto_id: diary.projeto.id, projeto_nome: diary.projeto.nome, equipe_id: diary.equipe.id,
        equipe_nome: diary.equipe.nome, encarregado: diary.encarregado
    };
    let fy = 600;
    Object.entries(fields).forEach(([name, value]) => {
        const f = form.createTextField(name);
        f.setText(value);
        f.setFontSize(7);
        f.addToPage(page, { x: 36, y: fy, width: 250, height: 15, borderWidth: 0.5 });
        page.drawText(name, { x: 300, y: fy + 4, size: 7, font });
        fy -= 24;
    });
    form.updateFieldAppearances(font);
    return await pdf.save({ useObjectStreams: false });
}
async function generateArtifacts(diary, company) {
    const finalized = { ...diary, status: "finalizado", finalizado_em: diary.finalizado_em || nowISO(), assinatura_encarregado: { ...diary.assinatura_encarregado, data_hora: diary.assinatura_encarregado.data_hora || nowISO() } };
    const pdf = await generatePdf(finalized, company);
    const portable = portableDiary(finalized);
    const jsonText = JSON.stringify(portable, null, 2);
    const jsonBytes = new TextEncoder().encode(jsonText);
    const pdfName = `Diario_${finalized.diario_id}_R${finalized.revisao}.pdf`;
    const zipName = `Pacote_${finalized.diario_id}_R${finalized.revisao}.zip`;
    const zip = new JSZip();
    zip.file("diario_obra.json", jsonText);
    zip.file("diario_obra.pdf", pdf);
    const photoFolder = zip.folder("fotos");
    finalized.fotos.forEach((photo, index) => {
        const base64 = photo.data_url.split(",")[1];
        photoFolder.file(`${String(index + 1).padStart(3, "0")}_${photo.nome.replace(/[^\w.-]+/g, "_")}.jpg`, base64, { base64: true });
    });
    if (finalized.assinatura_encarregado.data_url) {
        const base64 = finalized.assinatura_encarregado.data_url.split(",")[1];
        zip.folder("assinaturas").file("assinatura_encarregado.png", base64, { base64: true });
    }
    const manifest = {
        package_version: "1.0",
        app_version: APP_VERSION,
        diario_id: finalized.diario_id,
        revisao: finalized.revisao,
        generated_at: nowISO(),
        files: ["diario_obra.json", "diario_obra.pdf", ...finalized.fotos.map((_, i) => `fotos/${String(i + 1).padStart(3, "0")}`)],
        hashes: { diario_json: await sha256(jsonBytes), diario_pdf: await sha256(pdf) }
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    return { pdf, zip: zipBlob, pdfName, zipName };
}
function SignaturePad({ value, onChange }) {
    const canvasRef = useRef(null);
    const drawing = useRef(false);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            const previous = value;
            canvas.width = rect.width * ratio;
            canvas.height = 150 * ratio;
            const ctx = canvas.getContext("2d");
            ctx.scale(ratio, ratio);
            ctx.lineWidth = 2.2;
            ctx.lineCap = "round";
            ctx.strokeStyle = "#0f172a";
            if (previous) {
                const img = new Image();
                img.onload = () => ctx.drawImage(img, 0, 0, rect.width, 150);
                img.src = previous;
            }
        };
        resize();
    }, []);
    const point = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const touch = event.touches?.[0] || event;
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };
    const start = (event) => {
        event.preventDefault();
        drawing.current = true;
        const p = point(event);
        const ctx = canvasRef.current.getContext("2d");
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    };
    const move = (event) => {
        if (!drawing.current)
            return;
        event.preventDefault();
        const p = point(event);
        const ctx = canvasRef.current.getContext("2d");
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };
    const end = () => {
        if (!drawing.current)
            return;
        drawing.current = false;
        onChange(canvasRef.current.toDataURL("image/png"));
    };
    const clear = () => {
        const canvas = canvasRef.current;
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        onChange("");
    };
    return React.createElement("div", { className: "signature-wrap" },
        React.createElement("canvas", { ref: canvasRef, className: "signature", onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerLeave: end }),
        React.createElement("button", { type: "button", className: "btn ghost small", onClick: clear }, "Limpar assinatura"));
}
const STEPS = ["Identificação", "Equipe", "Atividades", "Recursos", "Custos", "Segurança", "Impedimentos", "Fotos", "Encerramento"];
function App() {
    const [config, setConfig] = useState(loadConfig());
    const [diary, setDiary] = useState(() => makeDiary(loadConfig()));
    const [step, setStep] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const [activityCode, setActivityCode] = useState("");
    const configInput = useRef(null);
    const photoInput = useRef(null);
    useEffect(() => {
        loadDraft().then(saved => {
            if (saved)
                setDiary(normalizeDiary(saved));
            setLoaded(true);
        }).catch(() => setLoaded(true));
    }, []);
    useEffect(() => {
        if (!loaded)
            return;
        const timer = window.setTimeout(() => saveDraft(diary).then(() => setMessage("Rascunho salvo automaticamente.")).catch(() => setMessage("Não foi possível salvar o rascunho.")), 700);
        return () => clearTimeout(timer);
    }, [diary, loaded]);
    useEffect(() => {
        if ("serviceWorker" in navigator)
            navigator.serviceWorker.register("/campo/sw.js").catch(() => undefined);
    }, []);
    const validation = useMemo(() => {
        const items = [];
        if (!diary.projeto.id || !diary.projeto.nome)
            items.push({ level: "error", text: "Selecione a obra.", step: 0 });
        if (!diary.data)
            items.push({ level: "error", text: "Informe a data.", step: 0 });
        if (!diary.equipe.id || !diary.encarregado)
            items.push({ level: "error", text: "Selecione a equipe e o encarregado.", step: 0 });
        if (!diary.equipe_presente.some(p => p.presente))
            items.push({ level: "error", text: "Marque pelo menos um integrante presente.", step: 1 });
        if (!diary.atividades.length)
            items.push({ level: "warning", text: "Nenhuma atividade foi registrada.", step: 2 });
        if (!diary.seguranca.dds_realizado)
            items.push({ level: "warning", text: "DDS não confirmado.", step: 5 });
        if (!diary.seguranca.apr_disponivel)
            items.push({ level: "warning", text: "APR não confirmada.", step: 5 });
        if (diary.seguranca.houve_ocorrencia && !diary.seguranca.descricao_ocorrencia.trim())
            items.push({ level: "error", text: "Descreva a ocorrência de segurança.", step: 5 });
        if (diary.deslocamento.km_final > 0 && diary.deslocamento.km_inicial > 0 && diary.deslocamento.km_final < diary.deslocamento.km_inicial)
            items.push({ level: "error", text: "A quilometragem final não pode ser menor que a inicial.", step: 4 });
        if (diary.despesas.extras.some(item => item.valor > 0 && !item.descricao.trim()))
            items.push({ level: "warning", text: "Existe despesa extra sem descrição.", step: 4 });
        if (!diary.assinatura_encarregado.nome.trim())
            items.push({ level: "error", text: "Informe o responsável pelo encerramento.", step: 8 });
        if (!diary.assinatura_encarregado.data_url)
            items.push({ level: "warning", text: "A assinatura manuscrita não foi registrada.", step: 8 });
        if (!items.some(i => i.level === "error"))
            items.push({ level: "ok", text: "Dados mínimos prontos para finalizar.", step: 8 });
        return items;
    }, [diary]);
    const errors = validation.filter(v => v.level === "error").length;
    const peopleHours = diary.equipe_presente.filter(p => p.presente).reduce((sum, p) => sum + p.horas_normais + p.horas_extras, 0);
    const mealTotal = (meal) => meal.quantidade * meal.valor_unitario;
    const totalExpenses = mealTotal(diary.despesas.cafe_manha) + mealTotal(diary.despesas.almoco) + mealTotal(diary.despesas.cafe_tarde) + mealTotal(diary.despesas.jantar) + diary.despesas.abastecimento + diary.despesas.extras.reduce((sum, item) => sum + item.valor, 0);
    const kmTravelled = diary.deslocamento.km_final > 0 && diary.deslocamento.km_inicial > 0 ? Math.max(0, diary.deslocamento.km_final - diary.deslocamento.km_inicial) : 0;
    const update = (key, value) => setDiary(prev => ({ ...prev, [key]: value }));
    const refreshId = (partial) => {
        setDiary(prev => {
            const next = { ...prev, ...partial };
            next.diario_id = `DO-${next.data.replace(/-/g, "")}-${next.projeto.id || "OBRA"}-${next.equipe.id || "EQUIPE"}`;
            return next;
        });
    };
    const selectProject = (id) => {
        const p = config.projetos.find(item => item.id === id);
        if (!p)
            return;
        refreshId({ projeto: { id: p.id, nome: p.nome, cliente: p.cliente, local: p.local, contrato: p.contrato, centro_custo: p.centro_custo } });
    };
    const selectTeam = (id) => {
        const team = config.equipes.find(item => item.id === id);
        if (!team)
            return;
        refreshId({ equipe: { id: team.id, nome: team.nome }, encarregado: team.encarregado, equipe_presente: membersForTeam(config, team.id), assinatura_encarregado: { ...diary.assinatura_encarregado, nome: team.encarregado } });
    };
    const importConfig = async (file) => {
        try {
            const parsed = JSON.parse(await file.text());
            if (!Array.isArray(parsed.projetos) || !Array.isArray(parsed.equipes))
                throw new Error("Estrutura inválida");
            const next = { ...DEFAULT_CONFIG, ...parsed };
            localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
            setConfig(next);
            setMessage("Configuração importada. Inicie um novo diário para aplicar as equipes.");
        }
        catch (error) {
            setMessage(`Configuração inválida: ${String(error)}`);
        }
    };
    const newDiary = async () => {
        if (!confirm("Iniciar um novo diário? O rascunho atual será substituído."))
            return;
        const next = makeDiary(config);
        setDiary(next);
        setStep(0);
        await clearDraft();
        setMessage("Novo diário iniciado.");
    };
    const repeatPrevious = () => {
        const nextDate = todayISO();
        setDiary(prev => ({
            ...prev,
            data: nextDate,
            diario_id: `DO-${nextDate.replace(/-/g, "")}-${prev.projeto.id}-${prev.equipe.id}`,
            revisao: 1,
            status: "rascunho",
            finalizado_em: "",
            atividades: prev.atividades.map(a => ({ ...a, id: uid("ATV"), quantidade: 0, percentual_conclusao: 0, observacao: "" })),
            impedimentos: [],
            fotos: [],
            despesas: { cafe_manha: { quantidade: 0, valor_unitario: 0 }, almoco: { quantidade: 0, valor_unitario: 0 }, cafe_tarde: { quantidade: 0, valor_unitario: 0 }, jantar: { quantidade: 0, valor_unitario: 0 }, extras: [], abastecimento: 0, observacao: "" },
            deslocamento: { ...prev.deslocamento, km_inicial: prev.deslocamento.km_final || 0, km_final: 0, observacao: "" },
            assinatura_encarregado: { ...prev.assinatura_encarregado, data_hora: "", data_url: "" }
        }));
        setMessage("Estrutura anterior repetida; quantidades e ocorrências foram zeradas.");
    };
    const addCatalogActivity = () => {
        const item = config.atividades.find(a => a.codigo === activityCode);
        if (!item)
            return;
        update("atividades", [...diary.atividades, { id: uid("ATV"), codigo: item.codigo, descricao: item.descricao, local: "", quantidade: 0, unidade: item.unidade, percentual_conclusao: 0, observacao: "" }]);
        setActivityCode("");
    };
    const addManualActivity = () => update("atividades", [...diary.atividades, { id: uid("ATV"), codigo: "", descricao: "Nova atividade", local: "", quantidade: 0, unidade: config.unidades[0] || "un", percentual_conclusao: 0, observacao: "" }]);
    const patchActivity = (id, patch) => update("atividades", diary.atividades.map(item => item.id === id ? { ...item, ...patch } : item));
    const patchPerson = (id, patch) => update("equipe_presente", diary.equipe_presente.map(item => item.funcionario_id === id ? { ...item, ...patch } : item));
    const patchMaterial = (id, patch) => update("materiais", diary.materiais.map(item => item.id === id ? { ...item, ...patch } : item));
    const patchEquipment = (id, patch) => update("equipamentos", diary.equipamentos.map(item => item.id === id ? { ...item, ...patch } : item));
    const patchObstruction = (id, patch) => update("impedimentos", diary.impedimentos.map(item => item.id === id ? { ...item, ...patch } : item));
    const addPhotos = async (files) => {
        if (!files)
            return;
        setBusy(true);
        try {
            const newPhotos = [];
            for (const file of Array.from(files)) {
                const data_url = await compressImage(file);
                newPhotos.push({ id: uid("FOTO"), nome: file.name, legenda: "", vinculo_tipo: "geral", vinculo_id: "", data_hora: nowISO(), data_url });
            }
            update("fotos", [...diary.fotos, ...newPhotos]);
            setMessage(`${newPhotos.length} foto(s) adicionada(s) e compactada(s).`);
        }
        catch (error) {
            setMessage(`Erro ao preparar fotos: ${String(error)}`);
        }
        finally {
            setBusy(false);
            if (photoInput.current)
                photoInput.current.value = "";
        }
    };
    const finalize = async (mode) => {
        if (errors) {
            setMessage("Corrija os campos obrigatórios antes de finalizar.");
            const first = validation.find(v => v.level === "error");
            if (first)
                setStep(first.step);
            return;
        }
        if (!window.PDFLib || !window.JSZip) {
            setMessage("Bibliotecas de PDF/ZIP não carregadas. Verifique a internet ou execute o instalador completo.");
            return;
        }
        setBusy(true);
        try {
            const finalized = { ...diary, status: "finalizado", finalizado_em: nowISO(), assinatura_encarregado: { ...diary.assinatura_encarregado, data_hora: nowISO() } };
            setDiary(finalized);
            const artifacts = await generateArtifacts(finalized, config.empresa);
            if (mode === "pdf")
                downloadBlob(new Blob([artifacts.pdf], { type: "application/pdf" }), artifacts.pdfName);
            else if (mode === "share" && navigator.share && navigator.canShare) {
                const file = new File([artifacts.zip], artifacts.zipName, { type: "application/zip" });
                if (navigator.canShare({ files: [file] }))
                    await navigator.share({ title: `Diário ${finalized.diario_id}`, text: "Pacote completo do diário de obra.", files: [file] });
                else
                    downloadBlob(artifacts.zip, artifacts.zipName);
            }
            else
                downloadBlob(artifacts.zip, artifacts.zipName);
            setMessage(mode === "pdf" ? "PDF gerado." : "Pacote ZIP gerado. Envie este arquivo ao responsável pela gestão.");
        }
        catch (error) {
            console.error(error);
            setMessage(`Falha ao gerar documentos: ${String(error)}`);
        }
        finally {
            setBusy(false);
        }
    };
    if (!loaded)
        return React.createElement("div", { className: "loading" }, "Carregando di\u00E1rio...");
    const identification = React.createElement("div", { className: "panel" },
        React.createElement("h2", null, "Identifica\u00E7\u00E3o do di\u00E1rio"),
        React.createElement("div", { className: "form-grid two" },
            React.createElement("label", null,
                "Obra",
                React.createElement("select", { value: diary.projeto.id, onChange: e => selectProject(e.target.value) }, config.projetos.filter(p => p.ativo).map(p => React.createElement("option", { key: p.id, value: p.id },
                    p.id,
                    " \u2014 ",
                    p.nome)))),
            React.createElement("label", null,
                "Data",
                React.createElement("input", { type: "date", value: diary.data, onChange: e => refreshId({ data: e.target.value }) })),
            React.createElement("label", null,
                "Equipe",
                React.createElement("select", { value: diary.equipe.id, onChange: e => selectTeam(e.target.value) }, config.equipes.filter(t => t.ativo).map(t => React.createElement("option", { key: t.id, value: t.id },
                    t.id,
                    " \u2014 ",
                    t.nome)))),
            React.createElement("label", null,
                "Encarregado",
                React.createElement("input", { value: diary.encarregado, onChange: e => { update("encarregado", e.target.value); update("assinatura_encarregado", { ...diary.assinatura_encarregado, nome: e.target.value }); } })),
            React.createElement("label", null,
                "In\u00EDcio",
                React.createElement("input", { type: "time", value: diary.turno_inicio, onChange: e => update("turno_inicio", e.target.value) })),
            React.createElement("label", null,
                "Fim",
                React.createElement("input", { type: "time", value: diary.turno_fim, onChange: e => update("turno_fim", e.target.value) })),
            React.createElement("label", null,
                "Intervalo (minutos)",
                React.createElement("input", { type: "number", min: "0", step: "15", value: diary.intervalo_minutos, onChange: e => update("intervalo_minutos", Math.max(0, numberValue(e.target.value))) })),
            React.createElement("label", null,
                "Clima / condi\u00E7\u00E3o do tempo",
                React.createElement("input", { placeholder: "Ex.: ensolarado, 24 \u00B0C", value: diary.clima, onChange: e => update("clima", e.target.value) })),
            React.createElement("label", null,
                "Revis\u00E3o",
                React.createElement("input", { type: "number", min: "1", value: diary.revisao, onChange: e => update("revisao", Math.max(1, numberValue(e.target.value))) }))),
        React.createElement("div", { className: "info-card" },
            React.createElement("strong", null, "ID autom\u00E1tico:"),
            " ",
            diary.diario_id,
            React.createElement("br", null),
            React.createElement("span", null,
                diary.projeto.cliente,
                " \u00B7 ",
                diary.projeto.local,
                " \u00B7 ",
                diary.projeto.contrato)),
        React.createElement("div", { className: "button-row" },
            React.createElement("button", { className: "btn secondary", onClick: repeatPrevious }, "Repetir estrutura anterior"),
            React.createElement("button", { className: "btn ghost", onClick: () => configInput.current?.click() }, "Importar configura\u00E7\u00E3o"),
            React.createElement("input", { ref: configInput, hidden: true, type: "file", accept: ".json,application/json", onChange: e => e.target.files?.[0] && importConfig(e.target.files[0]) })));
    const teamStep = React.createElement("div", { className: "panel" },
        React.createElement("div", { className: "section-head" },
            React.createElement("div", null,
                React.createElement("h2", null, "Equipe presente"),
                React.createElement("p", null, "Marque presen\u00E7a e ajuste somente as horas necess\u00E1rias.")),
            React.createElement("button", { className: "btn secondary small", onClick: () => update("equipe_presente", diary.equipe_presente.map(p => ({ ...p, presente: true }))) }, "Todos presentes")),
        React.createElement("div", { className: "cards-list" }, diary.equipe_presente.map(person => React.createElement("div", { className: `person-card ${person.presente ? "active" : ""}`, key: person.funcionario_id },
            React.createElement("label", { className: "check-main" },
                React.createElement("input", { type: "checkbox", checked: person.presente, onChange: e => patchPerson(person.funcionario_id, { presente: e.target.checked }) }),
                React.createElement("span", null,
                    React.createElement("strong", null, person.nome),
                    React.createElement("small", null, person.funcao))),
            React.createElement("div", { className: "mini-grid" },
                React.createElement("label", null,
                    "Horas",
                    React.createElement("input", { type: "number", step: "0.5", min: "0", disabled: !person.presente, value: person.horas_normais, onChange: e => patchPerson(person.funcionario_id, { horas_normais: numberValue(e.target.value) }) })),
                React.createElement("label", null,
                    "Extras",
                    React.createElement("input", { type: "number", step: "0.5", min: "0", disabled: !person.presente, value: person.horas_extras, onChange: e => patchPerson(person.funcionario_id, { horas_extras: numberValue(e.target.value) }) })))))),
        React.createElement("div", { className: "summary-strip" },
            React.createElement("span", null,
                "Presentes ",
                React.createElement("strong", null, diary.equipe_presente.filter(p => p.presente).length)),
            React.createElement("span", null,
                "Homens-hora ",
                React.createElement("strong", null,
                    formatNumber(peopleHours),
                    " h"))));
    const activitiesStep = React.createElement("div", { className: "panel" },
        React.createElement("div", { className: "section-head" },
            React.createElement("div", null,
                React.createElement("h2", null, "Atividades executadas"),
                React.createElement("p", null, "Selecione atividades cadastradas ou inclua uma atividade livre."))),
        React.createElement("div", { className: "inline-add" },
            React.createElement("select", { value: activityCode, onChange: e => setActivityCode(e.target.value) },
                React.createElement("option", { value: "" }, "Selecione uma atividade..."),
                config.atividades.filter(a => a.ativo && (!a.projeto_id || a.projeto_id === diary.projeto.id)).map(a => React.createElement("option", { key: a.codigo, value: a.codigo },
                    a.codigo,
                    " \u2014 ",
                    a.descricao))),
            React.createElement("button", { className: "btn primary", disabled: !activityCode, onClick: addCatalogActivity }, "Adicionar"),
            React.createElement("button", { className: "btn ghost", onClick: addManualActivity }, "Atividade livre")),
        React.createElement("div", { className: "cards-list" }, diary.atividades.map((activity, index) => React.createElement("div", { className: "entry-card", key: activity.id },
            React.createElement("div", { className: "entry-title" },
                React.createElement("strong", null,
                    index + 1,
                    ". ",
                    activity.codigo || "SEM CÓDIGO"),
                React.createElement("button", { className: "icon-btn danger", onClick: () => update("atividades", diary.atividades.filter(a => a.id !== activity.id)) }, "Excluir")),
            React.createElement("div", { className: "form-grid two" },
                React.createElement("label", null,
                    "Descri\u00E7\u00E3o",
                    React.createElement("input", { value: activity.descricao, onChange: e => patchActivity(activity.id, { descricao: e.target.value }) })),
                React.createElement("label", null,
                    "Local / frente",
                    React.createElement("input", { value: activity.local, onChange: e => patchActivity(activity.id, { local: e.target.value }) })),
                React.createElement("label", null,
                    "Quantidade",
                    React.createElement("input", { type: "number", step: "0.01", value: activity.quantidade, onChange: e => patchActivity(activity.id, { quantidade: numberValue(e.target.value) }) })),
                React.createElement("label", null,
                    "Unidade",
                    React.createElement("select", { value: activity.unidade, onChange: e => patchActivity(activity.id, { unidade: e.target.value }) }, config.unidades.map(u => React.createElement("option", { key: u }, u)))),
                React.createElement("label", null,
                    "Conclus\u00E3o informada (%)",
                    React.createElement("input", { type: "number", min: "0", max: "100", value: activity.percentual_conclusao, onChange: e => patchActivity(activity.id, { percentual_conclusao: Math.min(100, Math.max(0, numberValue(e.target.value))) }) })),
                React.createElement("label", null,
                    "Observa\u00E7\u00E3o",
                    React.createElement("input", { value: activity.observacao, onChange: e => patchActivity(activity.id, { observacao: e.target.value }) })))))),
        !diary.atividades.length && React.createElement("div", { className: "empty" }, "Nenhuma atividade adicionada."));
    const resourcesStep = React.createElement("div", { className: "panel" },
        React.createElement("h2", null, "Materiais e equipamentos"),
        React.createElement("p", null, "Registre somente movimenta\u00E7\u00F5es ou ocorr\u00EAncias relevantes para o andamento."),
        React.createElement("div", { className: "split-actions" },
            React.createElement("button", { className: "btn secondary", onClick: () => update("materiais", [...diary.materiais, { id: uid("MAT"), descricao: "", tipo: "utilizado", quantidade: 0, unidade: config.unidades[0] || "un", observacao: "" }]) }, "Adicionar material"),
            React.createElement("button", { className: "btn secondary", onClick: () => update("equipamentos", [...diary.equipamentos, { id: uid("EQP"), descricao: "", status: "utilizado", horas: 0, observacao: "" }]) }, "Adicionar equipamento")),
        React.createElement("h3", null, "Materiais"),
        diary.materiais.map(item => React.createElement("div", { className: "entry-card", key: item.id },
            React.createElement("div", { className: "form-grid two" },
                React.createElement("label", null,
                    "Descri\u00E7\u00E3o",
                    React.createElement("input", { value: item.descricao, onChange: e => patchMaterial(item.id, { descricao: e.target.value }) })),
                React.createElement("label", null,
                    "Situa\u00E7\u00E3o",
                    React.createElement("select", { value: item.tipo, onChange: e => patchMaterial(item.id, { tipo: e.target.value }) },
                        React.createElement("option", { value: "recebido" }, "Recebido"),
                        React.createElement("option", { value: "utilizado" }, "Utilizado"),
                        React.createElement("option", { value: "faltante" }, "Faltante"))),
                React.createElement("label", null,
                    "Quantidade",
                    React.createElement("input", { type: "number", value: item.quantidade, onChange: e => patchMaterial(item.id, { quantidade: numberValue(e.target.value) }) })),
                React.createElement("label", null,
                    "Unidade",
                    React.createElement("select", { value: item.unidade, onChange: e => patchMaterial(item.id, { unidade: e.target.value }) }, config.unidades.map(u => React.createElement("option", { key: u }, u)))),
                React.createElement("label", { className: "span-2" },
                    "Observa\u00E7\u00E3o",
                    React.createElement("input", { value: item.observacao, onChange: e => patchMaterial(item.id, { observacao: e.target.value }) }))),
            React.createElement("button", { className: "icon-btn danger", onClick: () => update("materiais", diary.materiais.filter(x => x.id !== item.id)) }, "Excluir"))),
        React.createElement("h3", null, "Equipamentos"),
        diary.equipamentos.map(item => React.createElement("div", { className: "entry-card", key: item.id },
            React.createElement("div", { className: "form-grid two" },
                React.createElement("label", null,
                    "Descri\u00E7\u00E3o",
                    React.createElement("input", { value: item.descricao, onChange: e => patchEquipment(item.id, { descricao: e.target.value }) })),
                React.createElement("label", null,
                    "Situa\u00E7\u00E3o",
                    React.createElement("select", { value: item.status, onChange: e => patchEquipment(item.id, { status: e.target.value }) },
                        React.createElement("option", { value: "utilizado" }, "Utilizado"),
                        React.createElement("option", { value: "parado" }, "Parado"),
                        React.createElement("option", { value: "indisponivel" }, "Indispon\u00EDvel"))),
                React.createElement("label", null,
                    "Horas",
                    React.createElement("input", { type: "number", step: "0.5", value: item.horas, onChange: e => patchEquipment(item.id, { horas: numberValue(e.target.value) }) })),
                React.createElement("label", null,
                    "Observa\u00E7\u00E3o",
                    React.createElement("input", { value: item.observacao, onChange: e => patchEquipment(item.id, { observacao: e.target.value }) }))),
            React.createElement("button", { className: "icon-btn danger", onClick: () => update("equipamentos", diary.equipamentos.filter(x => x.id !== item.id)) }, "Excluir"))),
        !diary.materiais.length && !diary.equipamentos.length && React.createElement("div", { className: "empty" }, "Sem registros de recursos. Esta etapa pode permanecer vazia."));
    const patchMeal = (key, patch) => update("despesas", { ...diary.despesas, [key]: { ...diary.despesas[key], ...patch } });
    const costStep = React.createElement("div", { className: "panel" },
        React.createElement("div", { className: "section-head" },
            React.createElement("div", null,
                React.createElement("h2", null, "Despesas e deslocamento"),
                React.createElement("p", null, "Registre apenas os custos efetivamente realizados. Os totais s\u00E3o calculados automaticamente."))),
        React.createElement("h3", null, "Alimenta\u00E7\u00E3o"),
        React.createElement("div", { className: "cards-list" }, [["cafe_manha", "Café da manhã"], ["almoco", "Almoço"], ["cafe_tarde", "Café da tarde"], ["jantar", "Jantar"]].map(([key, label]) => { const meal = diary.despesas[key]; return React.createElement("div", { className: "entry-card", key: key },
            React.createElement("div", { className: "entry-title" },
                React.createElement("strong", null, label),
                React.createElement("span", null,
                    "R$ ",
                    formatNumber(mealTotal(meal), 2))),
            React.createElement("div", { className: "form-grid two" },
                React.createElement("label", null,
                    "Quantidade",
                    React.createElement("input", { type: "number", min: "0", step: "1", value: meal.quantidade, onChange: e => patchMeal(key, { quantidade: Math.max(0, numberValue(e.target.value)) }) })),
                React.createElement("label", null,
                    "Valor unit\u00E1rio (R$)",
                    React.createElement("input", { type: "number", min: "0", step: "0.01", value: meal.valor_unitario, onChange: e => patchMeal(key, { valor_unitario: Math.max(0, numberValue(e.target.value)) }) })))); })),
        React.createElement("div", { className: "section-head" },
            React.createElement("div", null,
                React.createElement("h3", null, "Despesas extras"),
                React.createElement("p", null, "Informe a finalidade para facilitar a aprova\u00E7\u00E3o.")),
            React.createElement("button", { className: "btn secondary small", onClick: () => update("despesas", { ...diary.despesas, extras: [...diary.despesas.extras, { id: uid("DESP"), descricao: "", valor: 0 }] }) }, "Adicionar")),
        diary.despesas.extras.map((item, index) => React.createElement("div", { className: "entry-card", key: item.id },
            React.createElement("div", { className: "entry-title" },
                React.createElement("strong", null,
                    "Despesa extra ",
                    index + 1),
                React.createElement("button", { className: "icon-btn danger", onClick: () => update("despesas", { ...diary.despesas, extras: diary.despesas.extras.filter(x => x.id !== item.id) }) }, "Excluir")),
            React.createElement("div", { className: "form-grid two" },
                React.createElement("label", null,
                    "Descri\u00E7\u00E3o",
                    React.createElement("input", { value: item.descricao, onChange: e => update("despesas", { ...diary.despesas, extras: diary.despesas.extras.map(x => x.id === item.id ? { ...x, descricao: e.target.value } : x) }) })),
                React.createElement("label", null,
                    "Valor (R$)",
                    React.createElement("input", { type: "number", min: "0", step: "0.01", value: item.valor, onChange: e => update("despesas", { ...diary.despesas, extras: diary.despesas.extras.map(x => x.id === item.id ? { ...x, valor: Math.max(0, numberValue(e.target.value)) } : x) }) }))))),
        React.createElement("div", { className: "form-grid two" },
            React.createElement("label", null,
                "Abastecimento (R$)",
                React.createElement("input", { type: "number", min: "0", step: "0.01", value: diary.despesas.abastecimento, onChange: e => update("despesas", { ...diary.despesas, abastecimento: Math.max(0, numberValue(e.target.value)) }) })),
            React.createElement("label", null,
                "Observa\u00E7\u00E3o das despesas",
                React.createElement("input", { value: diary.despesas.observacao, onChange: e => update("despesas", { ...diary.despesas, observacao: e.target.value }) }))),
        React.createElement("div", { className: "info-card" },
            React.createElement("strong", null,
                "Total do dia: R$ ",
                formatNumber(totalExpenses, 2)),
            React.createElement("br", null),
            React.createElement("span", null, "O total semanal ser\u00E1 consolidado automaticamente no gerenciador.")),
        React.createElement("h3", null, "Deslocamento"),
        React.createElement("div", { className: "form-grid two" },
            React.createElement("label", null,
                "Ve\u00EDculo",
                React.createElement("input", { list: "vehicle-list", value: diary.deslocamento.veiculo, onChange: e => update("deslocamento", { ...diary.deslocamento, veiculo: e.target.value }) }),
                React.createElement("datalist", { id: "vehicle-list" }, (config.veiculos || []).map(v => React.createElement("option", { key: v, value: v })))),
            React.createElement("label", null,
                "Placa",
                React.createElement("input", { value: diary.deslocamento.placa, onChange: e => update("deslocamento", { ...diary.deslocamento, placa: e.target.value.toUpperCase() }) })),
            React.createElement("label", null,
                "KM inicial",
                React.createElement("input", { type: "number", min: "0", step: "0.1", value: diary.deslocamento.km_inicial, onChange: e => update("deslocamento", { ...diary.deslocamento, km_inicial: Math.max(0, numberValue(e.target.value)) }) })),
            React.createElement("label", null,
                "KM final",
                React.createElement("input", { type: "number", min: "0", step: "0.1", value: diary.deslocamento.km_final, onChange: e => update("deslocamento", { ...diary.deslocamento, km_final: Math.max(0, numberValue(e.target.value)) }) })),
            React.createElement("label", { className: "span-2" },
                "Observa\u00E7\u00E3o do deslocamento",
                React.createElement("input", { value: diary.deslocamento.observacao, onChange: e => update("deslocamento", { ...diary.deslocamento, observacao: e.target.value }) }))),
        React.createElement("div", { className: "info-card" },
            React.createElement("strong", null,
                "Dist\u00E2ncia calculada: ",
                formatNumber(kmTravelled),
                " km")));
    const safetyStep = React.createElement("div", { className: "panel" },
        React.createElement("h2", null, "Seguran\u00E7a"),
        React.createElement("p", null, "Confirme os controles aplic\u00E1veis ao dia."),
        React.createElement("div", { className: "toggle-grid" }, [
            ["dds_realizado", "DDS realizado"], ["apr_disponivel", "APR disponível"], ["epis_conformes", "EPI em conformidade"], ["isolamento_area", "Área isolada"], ["permissao_trabalho", "Permissão de trabalho"], ["houve_ocorrencia", "Houve ocorrência / quase acidente"]
        ].map(([key, label]) => React.createElement("label", { className: `toggle-card ${diary.seguranca[key] ? "yes" : "no"}`, key: key },
            React.createElement("input", { type: "checkbox", checked: diary.seguranca[key], onChange: e => update("seguranca", { ...diary.seguranca, [key]: e.target.checked }) }),
            React.createElement("span", null,
                React.createElement("strong", null, label),
                React.createElement("small", null, diary.seguranca[key] ? "SIM" : "NÃO"))))),
        diary.seguranca.houve_ocorrencia && React.createElement("label", null,
            "Descreva a ocorr\u00EAncia",
            React.createElement("textarea", { rows: 5, value: diary.seguranca.descricao_ocorrencia, onChange: e => update("seguranca", { ...diary.seguranca, descricao_ocorrencia: e.target.value }) })));
    const obstructionStep = React.createElement("div", { className: "panel" },
        React.createElement("div", { className: "section-head" },
            React.createElement("div", null,
                React.createElement("h2", null, "Impedimentos"),
                React.createElement("p", null, "Registre as causas de perda ou restri\u00E7\u00E3o de produ\u00E7\u00E3o.")),
            React.createElement("button", { className: "btn primary", onClick: () => update("impedimentos", [...diary.impedimentos, { id: uid("IMP"), categoria: config.categorias_impedimento[0] || "Outro", descricao: "", impacto: "parcial", inicio: "", fim: "", horas_perdidas: 0, responsavel: "", acao_necessaria: "", prazo: "", status: "aberto" }]) }, "Adicionar impedimento")),
        diary.impedimentos.map((item, index) => React.createElement("div", { className: "entry-card", key: item.id },
            React.createElement("div", { className: "entry-title" },
                React.createElement("strong", null,
                    "Impedimento ",
                    index + 1),
                React.createElement("button", { className: "icon-btn danger", onClick: () => update("impedimentos", diary.impedimentos.filter(x => x.id !== item.id)) }, "Excluir")),
            React.createElement("div", { className: "form-grid two" },
                React.createElement("label", null,
                    "Categoria",
                    React.createElement("select", { value: item.categoria, onChange: e => patchObstruction(item.id, { categoria: e.target.value }) }, config.categorias_impedimento.map(c => React.createElement("option", { key: c }, c)))),
                React.createElement("label", null,
                    "Impacto",
                    React.createElement("select", { value: item.impacto, onChange: e => patchObstruction(item.id, { impacto: e.target.value }) },
                        React.createElement("option", { value: "sem_interrupcao" }, "Sem interrup\u00E7\u00E3o"),
                        React.createElement("option", { value: "parcial" }, "Interrup\u00E7\u00E3o parcial"),
                        React.createElement("option", { value: "total" }, "Interrup\u00E7\u00E3o total"))),
                React.createElement("label", null,
                    "In\u00EDcio",
                    React.createElement("input", { type: "time", value: item.inicio, onChange: e => patchObstruction(item.id, { inicio: e.target.value }) })),
                React.createElement("label", null,
                    "Fim",
                    React.createElement("input", { type: "time", value: item.fim, onChange: e => patchObstruction(item.id, { fim: e.target.value }) })),
                React.createElement("label", null,
                    "Horas perdidas",
                    React.createElement("input", { type: "number", step: "0.5", value: item.horas_perdidas, onChange: e => patchObstruction(item.id, { horas_perdidas: numberValue(e.target.value) }) })),
                React.createElement("label", null,
                    "Respons\u00E1vel pela solu\u00E7\u00E3o",
                    React.createElement("input", { value: item.responsavel, onChange: e => patchObstruction(item.id, { responsavel: e.target.value }) })),
                React.createElement("label", { className: "span-2" },
                    "Descri\u00E7\u00E3o",
                    React.createElement("textarea", { rows: 3, value: item.descricao, onChange: e => patchObstruction(item.id, { descricao: e.target.value }) })),
                React.createElement("label", { className: "span-2" },
                    "A\u00E7\u00E3o necess\u00E1ria",
                    React.createElement("input", { value: item.acao_necessaria, onChange: e => patchObstruction(item.id, { acao_necessaria: e.target.value }) }))))),
        !diary.impedimentos.length && React.createElement("div", { className: "empty success" }, "Sem impedimentos registrados."));
    const photosStep = React.createElement("div", { className: "panel" },
        React.createElement("div", { className: "section-head" },
            React.createElement("div", null,
                React.createElement("h2", null, "Registro fotogr\u00E1fico"),
                React.createElement("p", null, "Vincule cada foto a uma atividade ou ocorr\u00EAncia quando poss\u00EDvel.")),
            React.createElement("button", { className: "btn primary", disabled: busy, onClick: () => photoInput.current?.click() }, "Adicionar fotos"),
            React.createElement("input", { ref: photoInput, hidden: true, type: "file", accept: "image/*", capture: "environment", multiple: true, onChange: e => addPhotos(e.target.files) })),
        React.createElement("div", { className: "photo-grid" }, diary.fotos.map(photo => React.createElement("div", { className: "photo-card", key: photo.id },
            React.createElement("img", { src: photo.data_url, alt: photo.legenda || photo.nome }),
            React.createElement("div", { className: "photo-fields" },
                React.createElement("label", null,
                    "Legenda",
                    React.createElement("input", { value: photo.legenda, onChange: e => update("fotos", diary.fotos.map(p => p.id === photo.id ? { ...p, legenda: e.target.value } : p)) })),
                React.createElement("label", null,
                    "V\u00EDnculo",
                    React.createElement("select", { value: photo.vinculo_tipo, onChange: e => update("fotos", diary.fotos.map(p => p.id === photo.id ? { ...p, vinculo_tipo: e.target.value, vinculo_id: "" } : p)) },
                        React.createElement("option", { value: "geral" }, "Geral"),
                        React.createElement("option", { value: "atividade" }, "Atividade"),
                        React.createElement("option", { value: "impedimento" }, "Impedimento"),
                        React.createElement("option", { value: "seguranca" }, "Seguran\u00E7a"))),
                photo.vinculo_tipo === "atividade" && React.createElement("label", null,
                    "Atividade",
                    React.createElement("select", { value: photo.vinculo_id, onChange: e => update("fotos", diary.fotos.map(p => p.id === photo.id ? { ...p, vinculo_id: e.target.value } : p)) },
                        React.createElement("option", { value: "" }, "Selecione..."),
                        diary.atividades.map(a => React.createElement("option", { key: a.id, value: a.id }, a.codigo || a.descricao)))),
                React.createElement("button", { className: "icon-btn danger", onClick: () => update("fotos", diary.fotos.filter(p => p.id !== photo.id)) }, "Remover"))))),
        !diary.fotos.length && React.createElement("div", { className: "empty" }, "Nenhuma foto adicionada."));
    const finishStep = React.createElement("div", { className: "panel" },
        React.createElement("h2", null, "Encerramento"),
        React.createElement("label", null,
            "Observa\u00E7\u00F5es gerais",
            React.createElement("textarea", { rows: 5, value: diary.observacoes_gerais, onChange: e => update("observacoes_gerais", e.target.value) })),
        React.createElement("div", { className: "form-grid two" },
            React.createElement("label", null,
                "Respons\u00E1vel",
                React.createElement("input", { value: diary.assinatura_encarregado.nome, onChange: e => update("assinatura_encarregado", { ...diary.assinatura_encarregado, nome: e.target.value }) })),
            React.createElement("label", null,
                "Fun\u00E7\u00E3o",
                React.createElement("input", { value: diary.assinatura_encarregado.funcao, onChange: e => update("assinatura_encarregado", { ...diary.assinatura_encarregado, funcao: e.target.value }) }))),
        React.createElement("label", null,
            "Assinatura do respons\u00E1vel da equipe",
            React.createElement(SignaturePad, { value: diary.assinatura_encarregado.data_url, onChange: value => update("assinatura_encarregado", { ...diary.assinatura_encarregado, data_url: value }) })),
        React.createElement("h3", null, "Respons\u00E1vel do cliente (opcional)"),
        React.createElement("div", { className: "form-grid two" },
            React.createElement("label", null,
                "Nome",
                React.createElement("input", { value: diary.assinatura_fiscal?.nome || "", onChange: e => update("assinatura_fiscal", { ...(diary.assinatura_fiscal || { nome: "", funcao: "Responsável do cliente", data_hora: "" }), nome: e.target.value }) })),
            React.createElement("label", null,
                "Fun\u00E7\u00E3o",
                React.createElement("input", { value: diary.assinatura_fiscal?.funcao || "Responsável do cliente", onChange: e => update("assinatura_fiscal", { ...(diary.assinatura_fiscal || { nome: "", funcao: "", data_hora: "" }), funcao: e.target.value }) }))),
        React.createElement("label", null,
            "Assinatura do cliente",
            React.createElement(SignaturePad, { value: diary.assinatura_fiscal?.data_url, onChange: value => update("assinatura_fiscal", { ...(diary.assinatura_fiscal || { nome: "", funcao: "Responsável do cliente", data_hora: "" }), data_url: value }) })),
        React.createElement("div", { className: "info-card" },
            React.createElement("strong", null, "Resumo administrativo:"),
            " ",
            formatNumber(peopleHours),
            " HH \u00B7 R$ ",
            formatNumber(totalExpenses, 2),
            " \u00B7 ",
            formatNumber(kmTravelled),
            " km"),
        React.createElement("div", { className: "validation-list" }, validation.map((item, index) => React.createElement("button", { key: `${item.text}-${index}`, className: `validation ${item.level}`, onClick: () => setStep(item.step) },
            React.createElement("span", null, item.level === "error" ? "!" : item.level === "warning" ? "⚠" : "✓"),
            item.text))),
        React.createElement("div", { className: "final-actions" },
            React.createElement("button", { className: "btn primary large", disabled: busy || errors > 0, onClick: () => finalize("zip") }, busy ? "Gerando..." : "Gerar pacote para envio"),
            React.createElement("button", { className: "btn secondary", disabled: busy || errors > 0, onClick: () => finalize("pdf") }, "Gerar somente PDF"),
            React.createElement("button", { className: "btn secondary", disabled: busy || errors > 0, onClick: () => finalize("share") }, "Compartilhar ou baixar")),
        React.createElement("div", { className: "info-card" },
            React.createElement("strong", null, "Envio recomendado:"),
            " envie o arquivo ",
            React.createElement("code", null, "Pacote_...zip"),
            ". Ele cont\u00E9m o PDF, os dados estruturados, as fotos e o manifesto de integridade."));
    const contents = [identification, teamStep, activitiesStep, resourcesStep, costStep, safetyStep, obstructionStep, photosStep, finishStep];
    return React.createElement("div", { className: "app-shell" },
        React.createElement("header", { className: "topbar" },
            React.createElement("div", null,
                React.createElement("span", { className: "eyebrow" }, "DI\u00C1RIO DE OBRA"),
                React.createElement("h1", null, config.empresa),
                React.createElement("p", null,
                    diary.projeto.nome || "Selecione uma obra",
                    " \u00B7 ",
                    diary.data)),
            React.createElement("div", { className: "top-actions" },
                React.createElement("button", { className: "btn ghost", onClick: newDiary }, "Novo"),
                React.createElement("span", { className: `status-pill ${diary.status}` }, diary.status))),
        React.createElement("nav", { className: "steps", "aria-label": "Etapas" }, STEPS.map((label, index) => { const issue = validation.some(v => v.step === index && v.level === "error"); return React.createElement("button", { key: label, className: `${step === index ? "current" : ""} ${issue ? "issue" : ""}`, onClick: () => setStep(index) },
            React.createElement("span", null, index + 1),
            React.createElement("em", null, label)); })),
        React.createElement("main", null, contents[step]),
        React.createElement("footer", { className: "mobile-footer" },
            React.createElement("button", { className: "btn ghost", disabled: step === 0, onClick: () => setStep(Math.max(0, step - 1)) }, "Anterior"),
            React.createElement("div", null,
                React.createElement("small", null, "Etapa"),
                React.createElement("strong", null,
                    step + 1,
                    "/",
                    STEPS.length)),
            React.createElement("button", { className: "btn primary", disabled: step === STEPS.length - 1, onClick: () => setStep(Math.min(STEPS.length - 1, step + 1)) }, "Pr\u00F3xima")),
        message && React.createElement("button", { className: "toast", onClick: () => setMessage("") }, message));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));
