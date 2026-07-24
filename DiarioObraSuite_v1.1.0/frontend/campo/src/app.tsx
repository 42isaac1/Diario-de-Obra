const { useEffect, useMemo, useRef, useState } = React;

const APP_VERSION = "1.1.0";
const DRAFT_KEY = "diario_atual";
const CONFIG_KEY = "diario_config_v1";

type Project = { id: string; nome: string; cliente: string; local: string; contrato: string; centro_custo: string; ativo: boolean };
type FieldWorker = { id: string; nome: string; funcao: string; ativo: boolean };
type Team = { id: string; nome: string; encarregado: string; membros: string[]; ativo: boolean };
type CatalogActivity = { codigo: string; descricao: string; unidade: string; projeto_id: string; quantidade_planejada: number; ativo: boolean };
type FieldConfig = {
  schema_version: string;
  empresa: string;
  projetos: Project[];
  funcionarios: FieldWorker[];
  equipes: Team[];
  atividades: CatalogActivity[];
  categorias_impedimento: string[];
  unidades: string[];
  veiculos: string[];
};
type PersonEntry = { funcionario_id: string; nome: string; funcao: string; presente: boolean; horas_normais: number; horas_extras: number; observacao: string };
type ActivityEntry = { id: string; codigo: string; descricao: string; local: string; quantidade: number; unidade: string; percentual_conclusao: number; observacao: string };
type MaterialEntry = { id: string; descricao: string; tipo: "recebido" | "utilizado" | "faltante"; quantidade: number; unidade: string; observacao: string };
type EquipmentEntry = { id: string; descricao: string; status: "utilizado" | "parado" | "indisponivel"; horas: number; observacao: string };
type ObstructionEntry = { id: string; categoria: string; descricao: string; impacto: "sem_interrupcao" | "parcial" | "total"; inicio: string; fim: string; horas_perdidas: number; responsavel: string; acao_necessaria: string; prazo: string; status: "aberto" | "resolvido" };
type SafetyData = { dds_realizado: boolean; apr_disponivel: boolean; epis_conformes: boolean; isolamento_area: boolean; permissao_trabalho: boolean; houve_ocorrencia: boolean; descricao_ocorrencia: string };
type MealEntry = { quantidade: number; valor_unitario: number };
type ExtraExpenseEntry = { id: string; descricao: string; valor: number };
type ExpenseData = { cafe_manha: MealEntry; almoco: MealEntry; cafe_tarde: MealEntry; jantar: MealEntry; extras: ExtraExpenseEntry[]; abastecimento: number; observacao: string };
type TravelData = { veiculo: string; placa: string; km_inicial: number; km_final: number; observacao: string };
type PhotoEntry = { id: string; nome: string; legenda: string; vinculo_tipo: string; vinculo_id: string; data_hora: string; data_url: string };
type SignatureEntry = { nome: string; funcao: string; data_hora: string; data_url?: string };
type Diary = {
  schema_version: string;
  app_version: string;
  diario_id: string;
  revisao: number;
  projeto: { id: string; nome: string; cliente: string; local: string; contrato: string; centro_custo: string };
  data: string;
  equipe: { id: string; nome: string };
  encarregado: string;
  turno_inicio: string;
  turno_fim: string;
  intervalo_minutos: number;
  clima: string;
  equipe_presente: PersonEntry[];
  atividades: ActivityEntry[];
  materiais: MaterialEntry[];
  equipamentos: EquipmentEntry[];
  despesas: ExpenseData;
  deslocamento: TravelData;
  seguranca: SafetyData;
  impedimentos: ObstructionEntry[];
  fotos: PhotoEntry[];
  assinatura_encarregado: SignatureEntry;
  assinatura_fiscal?: SignatureEntry;
  observacoes_gerais: string;
  status: "rascunho" | "finalizado";
  finalizado_em: string;
  origem: string;
};

type ValidationItem = { level: "error" | "warning" | "ok"; text: string; step: number };

const DEFAULT_CONFIG: FieldConfig = {
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

const uid = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const todayISO = (): string => new Date().toISOString().slice(0, 10);
const nowISO = (): string => new Date().toISOString();
const numberValue = (value: string): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatNumber = (value: number, digits = 1): string => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value || 0);
const htmlEscape = (value: string): string => value.replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c] || c));

function loadConfig(): FieldConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function membersForTeam(config: FieldConfig, teamId: string): PersonEntry[] {
  const team = config.equipes.find(t => t.id === teamId) || config.equipes[0];
  if (!team) return [];
  return team.membros.map(id => config.funcionarios.find(f => f.id === id)).filter(Boolean).map(worker => ({
    funcionario_id: worker!.id,
    nome: worker!.nome,
    funcao: worker!.funcao,
    presente: true,
    horas_normais: 8,
    horas_extras: 0,
    observacao: ""
  }));
}

function makeDiary(config: FieldConfig): Diary {
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

function normalizeDiary(diary: Diary): Diary {
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

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("diario_obra_campo", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("drafts")) db.createObjectStore("drafts");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveDraft(diary: Diary): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put(diary, DRAFT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadDraft(): Promise<Diary | null> {
  const db = await openDB();
  const value = await new Promise<Diary | null>((resolve, reject) => {
    const tx = db.transaction("drafts", "readonly");
    const request = tx.objectStore("drafts").get(DRAFT_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

async function clearDraft(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").delete(DRAFT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
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
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function portableDiary(diary: Diary): Diary {
  return {
    ...diary,
    fotos: diary.fotos.map(({ data_url, ...photo }) => photo as PhotoEntry),
    assinatura_encarregado: { ...diary.assinatura_encarregado, data_url: undefined },
    assinatura_fiscal: diary.assinatura_fiscal ? { ...diary.assinatura_fiscal, data_url: undefined } : undefined
  };
}

function sha256Fallback(data: Uint8Array): string {
  const rotateRight = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const constants = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
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
  const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15];
      const y = words[i - 2];
      const s0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const s1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = hash;
    for (let i = 0; i < 64; i++) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + constants[i] + words[i]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    hash[0]=(hash[0]+a)>>>0; hash[1]=(hash[1]+b)>>>0; hash[2]=(hash[2]+c)>>>0; hash[3]=(hash[3]+d)>>>0;
    hash[4]=(hash[4]+e)>>>0; hash[5]=(hash[5]+f)>>>0; hash[6]=(hash[6]+g)>>>0; hash[7]=(hash[7]+h)>>>0;
  }
  return hash.map(value => value.toString(16).padStart(8, "0")).join("");
}

async function sha256(data: Uint8Array): Promise<string> {
  const normalized = new Uint8Array(data.length);
  normalized.set(data);
  if (globalThis.crypto?.subtle) {
    const hash = await globalThis.crypto.subtle.digest("SHA-256", normalized.buffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Fallback(normalized);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function wrapText(text: string, maxChars: number): string[] {
  const paragraphs = (text || "-").split(/\n/);
  const lines: string[] = [];
  paragraphs.forEach(paragraph => {
    const words = paragraph.split(/\s+/);
    let line = "";
    words.forEach(word => {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    });
    if (line) lines.push(line);
  });
  return lines.length ? lines : ["-"];
}

async function generatePdf(diary: Diary, company: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Diário de Obra ${diary.diario_id}`);
  pdf.setAuthor(company || "Diário de Obra Suite");
  pdf.setSubject(`Diário de obra importável ${diary.diario_id}`);
  pdf.setCreator(`Diário de Obra Campo v${APP_VERSION}`);
  pdf.setProducer("pdf-lib");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const A4: [number, number] = [595.28, 841.89];
  const margin = 36;
  let page: any;
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

  const ensure = (height: number, title = "DIÁRIO DE OBRA — CONTINUAÇÃO") => {
    if (y - height < 42) addPage(title);
  };

  const section = (title: string) => {
    ensure(28);
    page.drawRectangle({ x: margin, y: y - 14, width: A4[0] - margin * 2, height: 22, color: rgb(0.90, 0.94, 0.96) });
    page.drawText(title, { x: margin + 8, y: y - 7, size: 9, font: bold, color: rgb(0.06, 0.20, 0.28) });
    y -= 30;
  };

  const line = (label: string, value: string, valueX = 150) => {
    ensure(20);
    page.drawText(label, { x: margin, y, size: 7.5, font: bold, color: rgb(0.25, 0.30, 0.35) });
    page.drawText(String(value || "-"), { x: valueX, y, size: 8.5, font, color: rgb(0.05, 0.08, 0.12), maxWidth: A4[0] - valueX - margin });
    y -= 18;
  };

  const paragraph = (label: string, value: string) => {
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
  if (!diary.equipe_presente.some(p => p.presente)) paragraph("Registro", "Nenhum integrante marcado como presente.");
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
  if (!diary.atividades.length) paragraph("Registro", "Nenhuma atividade registrada.");

  section("MATERIAIS E EQUIPAMENTOS");
  diary.materiais.forEach(item => paragraph(`${item.tipo.toUpperCase()} · ${item.descricao}`, `${formatNumber(item.quantidade)} ${item.unidade}${item.observacao ? ` — ${item.observacao}` : ""}`));
  diary.equipamentos.forEach(item => paragraph(`${item.status.toUpperCase()} · ${item.descricao}`, `${formatNumber(item.horas)} h${item.observacao ? ` — ${item.observacao}` : ""}`));
  if (!diary.materiais.length && !diary.equipamentos.length) paragraph("Registro", "Sem movimentações ou ocorrências de recursos.");

  section("DESPESAS E DESLOCAMENTO");
  const mealRows: Array<[string, MealEntry]> = [["Café da manhã", diary.despesas.cafe_manha], ["Almoço", diary.despesas.almoco], ["Café da tarde", diary.despesas.cafe_tarde], ["Jantar", diary.despesas.jantar]];
  mealRows.forEach(([label, meal]) => {
    if (meal.quantidade || meal.valor_unitario) line(label, `${formatNumber(meal.quantidade, 0)} × R$ ${formatNumber(meal.valor_unitario, 2)} = R$ ${formatNumber(meal.quantidade * meal.valor_unitario, 2)}`);
  });
  diary.despesas.extras.forEach((item, index) => line(`Despesa extra ${index + 1}`, `${item.descricao || "Sem descrição"} · R$ ${formatNumber(item.valor, 2)}`));
  if (diary.despesas.abastecimento) line("Abastecimento", `R$ ${formatNumber(diary.despesas.abastecimento, 2)}`);
  const expenseTotal = mealRows.reduce((sum, [, meal]) => sum + meal.quantidade * meal.valor_unitario, 0) + diary.despesas.abastecimento + diary.despesas.extras.reduce((sum, item) => sum + item.valor, 0);
  line("Total de despesas do dia", `R$ ${formatNumber(expenseTotal, 2)}`);
  const km = diary.deslocamento.km_final > 0 && diary.deslocamento.km_inicial > 0 ? Math.max(0, diary.deslocamento.km_final - diary.deslocamento.km_inicial) : 0;
  line("Veículo", `${diary.deslocamento.veiculo || "-"}${diary.deslocamento.placa ? ` · ${diary.deslocamento.placa}` : ""}`);
  line("Quilometragem", `${formatNumber(diary.deslocamento.km_inicial)} → ${formatNumber(diary.deslocamento.km_final)} km · rodado ${formatNumber(km)} km`);
  if (diary.despesas.observacao) paragraph("Observação das despesas", diary.despesas.observacao);
  if (diary.deslocamento.observacao) paragraph("Observação do deslocamento", diary.deslocamento.observacao);

  section("SEGURANÇA");
  const safetyLabels: Array<[string, boolean]> = [
    ["DDS realizado", diary.seguranca.dds_realizado], ["APR disponível", diary.seguranca.apr_disponivel],
    ["EPI conforme", diary.seguranca.epis_conformes], ["Área isolada", diary.seguranca.isolamento_area],
    ["Permissão de trabalho", diary.seguranca.permissao_trabalho], ["Houve ocorrência", diary.seguranca.houve_ocorrencia]
  ];
  safetyLabels.forEach(([label, value]) => line(label, value ? "SIM" : "NÃO"));
  if (diary.seguranca.houve_ocorrencia) paragraph("Descrição da ocorrência", diary.seguranca.descricao_ocorrencia);

  section("IMPEDIMENTOS");
  diary.impedimentos.forEach((item, index) => {
    paragraph(`${index + 1}. ${item.categoria} · ${item.impacto.replace("_", " ").toUpperCase()}`, `${item.descricao || "Sem descrição"} | Horas perdidas: ${formatNumber(item.horas_perdidas)} | Responsável: ${item.responsavel || "-"} | Ação: ${item.acao_necessaria || "-"}`);
  });
  if (!diary.impedimentos.length) paragraph("Registro", "Sem impedimentos no período.");

  section("OBSERVAÇÕES E ASSINATURA");
  paragraph("Observações gerais", diary.observacoes_gerais || "Sem observações adicionais.");
  line("Responsável", `${diary.assinatura_encarregado.nome || diary.encarregado} — ${diary.assinatura_encarregado.funcao || "Encarregado"}`);
  line("Encerrado em", diary.finalizado_em || nowISO());
  if (diary.assinatura_fiscal?.nome) line("Responsável do cliente", `${diary.assinatura_fiscal.nome}${diary.assinatura_fiscal.funcao ? ` — ${diary.assinatura_fiscal.funcao}` : ""}`);
  if (diary.assinatura_encarregado.data_url) {
    try {
      const signatureBytes = Uint8Array.from(atob(diary.assinatura_encarregado.data_url.split(",")[1]), c => c.charCodeAt(0));
      const image = await pdf.embedPng(signatureBytes);
      ensure(70);
      page.drawImage(image, { x: margin, y: y - 42, width: 150, height: 55 });
      page.drawLine({ start: { x: margin, y: y - 45 }, end: { x: margin + 190, y: y - 45 }, thickness: 0.5, color: rgb(0.4, 0.4, 0.4) });
      y -= 62;
    } catch { /* assinatura inválida não impede o PDF */ }
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
    } catch { /* foto inválida é ignorada */ }
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
  const fields: Record<string, string> = {
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

async function generateArtifacts(diary: Diary, company: string): Promise<{ pdf: Uint8Array; zip: Blob; pdfName: string; zipName: string }> {
  const finalized: Diary = { ...diary, status: "finalizado", finalizado_em: diary.finalizado_em || nowISO(), assinatura_encarregado: { ...diary.assinatura_encarregado, data_hora: diary.assinatura_encarregado.data_hora || nowISO() } };
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

function SignaturePad({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const previous = value;
      canvas.width = rect.width * ratio;
      canvas.height = 150 * ratio;
      const ctx = canvas.getContext("2d")!;
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
  const point = (event: any) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] || event;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };
  const start = (event: any) => {
    event.preventDefault();
    drawing.current = true;
    const p = point(event);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (event: any) => {
    if (!drawing.current) return;
    event.preventDefault();
    const p = point(event);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };
  return <div className="signature-wrap"><canvas ref={canvasRef} className="signature" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} /><button type="button" className="btn ghost small" onClick={clear}>Limpar assinatura</button></div>;
}

const STEPS = ["Identificação", "Equipe", "Atividades", "Recursos", "Custos", "Segurança", "Impedimentos", "Fotos", "Encerramento"];

function App() {
  const [config, setConfig] = useState<FieldConfig>(loadConfig());
  const [diary, setDiary] = useState<Diary>(() => makeDiary(loadConfig()));
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [activityCode, setActivityCode] = useState("");
  const configInput = useRef<HTMLInputElement | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadDraft().then(saved => {
      if (saved) setDiary(normalizeDiary(saved));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => saveDraft(diary).then(() => setMessage("Rascunho salvo automaticamente.")).catch(() => setMessage("Não foi possível salvar o rascunho.")), 700);
    return () => clearTimeout(timer);
  }, [diary, loaded]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/campo/sw.js").catch(() => undefined);
  }, []);

  const validation = useMemo<ValidationItem[]>(() => {
    const items: ValidationItem[] = [];
    if (!diary.projeto.id || !diary.projeto.nome) items.push({ level: "error", text: "Selecione a obra.", step: 0 });
    if (!diary.data) items.push({ level: "error", text: "Informe a data.", step: 0 });
    if (!diary.equipe.id || !diary.encarregado) items.push({ level: "error", text: "Selecione a equipe e o encarregado.", step: 0 });
    if (!diary.equipe_presente.some(p => p.presente)) items.push({ level: "error", text: "Marque pelo menos um integrante presente.", step: 1 });
    if (!diary.atividades.length) items.push({ level: "warning", text: "Nenhuma atividade foi registrada.", step: 2 });
    if (!diary.seguranca.dds_realizado) items.push({ level: "warning", text: "DDS não confirmado.", step: 5 });
    if (!diary.seguranca.apr_disponivel) items.push({ level: "warning", text: "APR não confirmada.", step: 5 });
    if (diary.seguranca.houve_ocorrencia && !diary.seguranca.descricao_ocorrencia.trim()) items.push({ level: "error", text: "Descreva a ocorrência de segurança.", step: 5 });
    if (diary.deslocamento.km_final > 0 && diary.deslocamento.km_inicial > 0 && diary.deslocamento.km_final < diary.deslocamento.km_inicial) items.push({ level: "error", text: "A quilometragem final não pode ser menor que a inicial.", step: 4 });
    if (diary.despesas.extras.some(item => item.valor > 0 && !item.descricao.trim())) items.push({ level: "warning", text: "Existe despesa extra sem descrição.", step: 4 });
    if (!diary.assinatura_encarregado.nome.trim()) items.push({ level: "error", text: "Informe o responsável pelo encerramento.", step: 8 });
    if (!diary.assinatura_encarregado.data_url) items.push({ level: "warning", text: "A assinatura manuscrita não foi registrada.", step: 8 });
    if (!items.some(i => i.level === "error")) items.push({ level: "ok", text: "Dados mínimos prontos para finalizar.", step: 8 });
    return items;
  }, [diary]);

  const errors = validation.filter(v => v.level === "error").length;
  const peopleHours = diary.equipe_presente.filter(p => p.presente).reduce((sum, p) => sum + p.horas_normais + p.horas_extras, 0);
  const mealTotal = (meal: MealEntry) => meal.quantidade * meal.valor_unitario;
  const totalExpenses = mealTotal(diary.despesas.cafe_manha) + mealTotal(diary.despesas.almoco) + mealTotal(diary.despesas.cafe_tarde) + mealTotal(diary.despesas.jantar) + diary.despesas.abastecimento + diary.despesas.extras.reduce((sum, item) => sum + item.valor, 0);
  const kmTravelled = diary.deslocamento.km_final > 0 && diary.deslocamento.km_inicial > 0 ? Math.max(0, diary.deslocamento.km_final - diary.deslocamento.km_inicial) : 0;

  const update = <K extends keyof Diary>(key: K, value: Diary[K]) => setDiary(prev => ({ ...prev, [key]: value }));
  const refreshId = (partial: Partial<Diary>) => {
    setDiary(prev => {
      const next = { ...prev, ...partial };
      next.diario_id = `DO-${next.data.replace(/-/g, "")}-${next.projeto.id || "OBRA"}-${next.equipe.id || "EQUIPE"}`;
      return next;
    });
  };

  const selectProject = (id: string) => {
    const p = config.projetos.find(item => item.id === id);
    if (!p) return;
    refreshId({ projeto: { id: p.id, nome: p.nome, cliente: p.cliente, local: p.local, contrato: p.contrato, centro_custo: p.centro_custo } });
  };

  const selectTeam = (id: string) => {
    const team = config.equipes.find(item => item.id === id);
    if (!team) return;
    refreshId({ equipe: { id: team.id, nome: team.nome }, encarregado: team.encarregado, equipe_presente: membersForTeam(config, team.id), assinatura_encarregado: { ...diary.assinatura_encarregado, nome: team.encarregado } });
  };

  const importConfig = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as FieldConfig;
      if (!Array.isArray(parsed.projetos) || !Array.isArray(parsed.equipes)) throw new Error("Estrutura inválida");
      const next = { ...DEFAULT_CONFIG, ...parsed };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
      setConfig(next);
      setMessage("Configuração importada. Inicie um novo diário para aplicar as equipes.");
    } catch (error) {
      setMessage(`Configuração inválida: ${String(error)}`);
    }
  };

  const newDiary = async () => {
    if (!confirm("Iniciar um novo diário? O rascunho atual será substituído.")) return;
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
    if (!item) return;
    update("atividades", [...diary.atividades, { id: uid("ATV"), codigo: item.codigo, descricao: item.descricao, local: "", quantidade: 0, unidade: item.unidade, percentual_conclusao: 0, observacao: "" }]);
    setActivityCode("");
  };

  const addManualActivity = () => update("atividades", [...diary.atividades, { id: uid("ATV"), codigo: "", descricao: "Nova atividade", local: "", quantidade: 0, unidade: config.unidades[0] || "un", percentual_conclusao: 0, observacao: "" }]);
  const patchActivity = (id: string, patch: Partial<ActivityEntry>) => update("atividades", diary.atividades.map(item => item.id === id ? { ...item, ...patch } : item));
  const patchPerson = (id: string, patch: Partial<PersonEntry>) => update("equipe_presente", diary.equipe_presente.map(item => item.funcionario_id === id ? { ...item, ...patch } : item));
  const patchMaterial = (id: string, patch: Partial<MaterialEntry>) => update("materiais", diary.materiais.map(item => item.id === id ? { ...item, ...patch } : item));
  const patchEquipment = (id: string, patch: Partial<EquipmentEntry>) => update("equipamentos", diary.equipamentos.map(item => item.id === id ? { ...item, ...patch } : item));
  const patchObstruction = (id: string, patch: Partial<ObstructionEntry>) => update("impedimentos", diary.impedimentos.map(item => item.id === id ? { ...item, ...patch } : item));

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    try {
      const newPhotos: PhotoEntry[] = [];
      for (const file of Array.from(files)) {
        const data_url = await compressImage(file);
        newPhotos.push({ id: uid("FOTO"), nome: file.name, legenda: "", vinculo_tipo: "geral", vinculo_id: "", data_hora: nowISO(), data_url });
      }
      update("fotos", [...diary.fotos, ...newPhotos]);
      setMessage(`${newPhotos.length} foto(s) adicionada(s) e compactada(s).`);
    } catch (error) {
      setMessage(`Erro ao preparar fotos: ${String(error)}`);
    } finally {
      setBusy(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  };

  const finalize = async (mode: "zip" | "pdf" | "share") => {
    if (errors) {
      setMessage("Corrija os campos obrigatórios antes de finalizar.");
      const first = validation.find(v => v.level === "error");
      if (first) setStep(first.step);
      return;
    }
    if (!(window as any).PDFLib || !(window as any).JSZip) {
      setMessage("Bibliotecas de PDF/ZIP não carregadas. Verifique a internet ou execute o instalador completo.");
      return;
    }
    setBusy(true);
    try {
      const finalized: Diary = { ...diary, status: "finalizado", finalizado_em: nowISO(), assinatura_encarregado: { ...diary.assinatura_encarregado, data_hora: nowISO() } };
      setDiary(finalized);
      const artifacts = await generateArtifacts(finalized, config.empresa);
      if (mode === "pdf") downloadBlob(new Blob([artifacts.pdf as any], { type: "application/pdf" }), artifacts.pdfName);
      else if (mode === "share" && navigator.share && (navigator as any).canShare) {
        const file = new File([artifacts.zip], artifacts.zipName, { type: "application/zip" });
        if ((navigator as any).canShare({ files: [file] })) await navigator.share({ title: `Diário ${finalized.diario_id}`, text: "Pacote completo do diário de obra.", files: [file] });
        else downloadBlob(artifacts.zip, artifacts.zipName);
      } else downloadBlob(artifacts.zip, artifacts.zipName);
      setMessage(mode === "pdf" ? "PDF gerado." : "Pacote ZIP gerado. Envie este arquivo ao responsável pela gestão.");
    } catch (error) {
      console.error(error);
      setMessage(`Falha ao gerar documentos: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <div className="loading">Carregando diário...</div>;

  const identification = <div className="panel">
    <h2>Identificação do diário</h2>
    <div className="form-grid two">
      <label>Obra<select value={diary.projeto.id} onChange={e => selectProject(e.target.value)}>{config.projetos.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.id} — {p.nome}</option>)}</select></label>
      <label>Data<input type="date" value={diary.data} onChange={e => refreshId({ data: e.target.value })} /></label>
      <label>Equipe<select value={diary.equipe.id} onChange={e => selectTeam(e.target.value)}>{config.equipes.filter(t => t.ativo).map(t => <option key={t.id} value={t.id}>{t.id} — {t.nome}</option>)}</select></label>
      <label>Encarregado<input value={diary.encarregado} onChange={e => { update("encarregado", e.target.value); update("assinatura_encarregado", { ...diary.assinatura_encarregado, nome: e.target.value }); }} /></label>
      <label>Início<input type="time" value={diary.turno_inicio} onChange={e => update("turno_inicio", e.target.value)} /></label>
      <label>Fim<input type="time" value={diary.turno_fim} onChange={e => update("turno_fim", e.target.value)} /></label>
      <label>Intervalo (minutos)<input type="number" min="0" step="15" value={diary.intervalo_minutos} onChange={e => update("intervalo_minutos", Math.max(0, numberValue(e.target.value)))} /></label>
      <label>Clima / condição do tempo<input placeholder="Ex.: ensolarado, 24 °C" value={diary.clima} onChange={e => update("clima", e.target.value)} /></label>
      <label>Revisão<input type="number" min="1" value={diary.revisao} onChange={e => update("revisao", Math.max(1, numberValue(e.target.value)))} /></label>
    </div>
    <div className="info-card"><strong>ID automático:</strong> {diary.diario_id}<br /><span>{diary.projeto.cliente} · {diary.projeto.local} · {diary.projeto.contrato}</span></div>
    <div className="button-row"><button className="btn secondary" onClick={repeatPrevious}>Repetir estrutura anterior</button><button className="btn ghost" onClick={() => configInput.current?.click()}>Importar configuração</button><input ref={configInput} hidden type="file" accept=".json,application/json" onChange={e => e.target.files?.[0] && importConfig(e.target.files[0])} /></div>
  </div>;

  const teamStep = <div className="panel"><div className="section-head"><div><h2>Equipe presente</h2><p>Marque presença e ajuste somente as horas necessárias.</p></div><button className="btn secondary small" onClick={() => update("equipe_presente", diary.equipe_presente.map(p => ({ ...p, presente: true })))}>Todos presentes</button></div>
    <div className="cards-list">{diary.equipe_presente.map(person => <div className={`person-card ${person.presente ? "active" : ""}`} key={person.funcionario_id}>
      <label className="check-main"><input type="checkbox" checked={person.presente} onChange={e => patchPerson(person.funcionario_id, { presente: e.target.checked })} /><span><strong>{person.nome}</strong><small>{person.funcao}</small></span></label>
      <div className="mini-grid"><label>Horas<input type="number" step="0.5" min="0" disabled={!person.presente} value={person.horas_normais} onChange={e => patchPerson(person.funcionario_id, { horas_normais: numberValue(e.target.value) })} /></label><label>Extras<input type="number" step="0.5" min="0" disabled={!person.presente} value={person.horas_extras} onChange={e => patchPerson(person.funcionario_id, { horas_extras: numberValue(e.target.value) })} /></label></div>
    </div>)}</div><div className="summary-strip"><span>Presentes <strong>{diary.equipe_presente.filter(p => p.presente).length}</strong></span><span>Homens-hora <strong>{formatNumber(peopleHours)} h</strong></span></div></div>;

  const activitiesStep = <div className="panel"><div className="section-head"><div><h2>Atividades executadas</h2><p>Selecione atividades cadastradas ou inclua uma atividade livre.</p></div></div>
    <div className="inline-add"><select value={activityCode} onChange={e => setActivityCode(e.target.value)}><option value="">Selecione uma atividade...</option>{config.atividades.filter(a => a.ativo && (!a.projeto_id || a.projeto_id === diary.projeto.id)).map(a => <option key={a.codigo} value={a.codigo}>{a.codigo} — {a.descricao}</option>)}</select><button className="btn primary" disabled={!activityCode} onClick={addCatalogActivity}>Adicionar</button><button className="btn ghost" onClick={addManualActivity}>Atividade livre</button></div>
    <div className="cards-list">{diary.atividades.map((activity, index) => <div className="entry-card" key={activity.id}><div className="entry-title"><strong>{index + 1}. {activity.codigo || "SEM CÓDIGO"}</strong><button className="icon-btn danger" onClick={() => update("atividades", diary.atividades.filter(a => a.id !== activity.id))}>Excluir</button></div><div className="form-grid two"><label>Descrição<input value={activity.descricao} onChange={e => patchActivity(activity.id, { descricao: e.target.value })} /></label><label>Local / frente<input value={activity.local} onChange={e => patchActivity(activity.id, { local: e.target.value })} /></label><label>Quantidade<input type="number" step="0.01" value={activity.quantidade} onChange={e => patchActivity(activity.id, { quantidade: numberValue(e.target.value) })} /></label><label>Unidade<select value={activity.unidade} onChange={e => patchActivity(activity.id, { unidade: e.target.value })}>{config.unidades.map(u => <option key={u}>{u}</option>)}</select></label><label>Conclusão informada (%)<input type="number" min="0" max="100" value={activity.percentual_conclusao} onChange={e => patchActivity(activity.id, { percentual_conclusao: Math.min(100, Math.max(0, numberValue(e.target.value))) })} /></label><label>Observação<input value={activity.observacao} onChange={e => patchActivity(activity.id, { observacao: e.target.value })} /></label></div></div>)}</div>
    {!diary.atividades.length && <div className="empty">Nenhuma atividade adicionada.</div>}
  </div>;

  const resourcesStep = <div className="panel"><h2>Materiais e equipamentos</h2><p>Registre somente movimentações ou ocorrências relevantes para o andamento.</p>
    <div className="split-actions"><button className="btn secondary" onClick={() => update("materiais", [...diary.materiais, { id: uid("MAT"), descricao: "", tipo: "utilizado", quantidade: 0, unidade: config.unidades[0] || "un", observacao: "" }])}>Adicionar material</button><button className="btn secondary" onClick={() => update("equipamentos", [...diary.equipamentos, { id: uid("EQP"), descricao: "", status: "utilizado", horas: 0, observacao: "" }])}>Adicionar equipamento</button></div>
    <h3>Materiais</h3>{diary.materiais.map(item => <div className="entry-card" key={item.id}><div className="form-grid two"><label>Descrição<input value={item.descricao} onChange={e => patchMaterial(item.id, { descricao: e.target.value })} /></label><label>Situação<select value={item.tipo} onChange={e => patchMaterial(item.id, { tipo: e.target.value as MaterialEntry["tipo"] })}><option value="recebido">Recebido</option><option value="utilizado">Utilizado</option><option value="faltante">Faltante</option></select></label><label>Quantidade<input type="number" value={item.quantidade} onChange={e => patchMaterial(item.id, { quantidade: numberValue(e.target.value) })} /></label><label>Unidade<select value={item.unidade} onChange={e => patchMaterial(item.id, { unidade: e.target.value })}>{config.unidades.map(u => <option key={u}>{u}</option>)}</select></label><label className="span-2">Observação<input value={item.observacao} onChange={e => patchMaterial(item.id, { observacao: e.target.value })} /></label></div><button className="icon-btn danger" onClick={() => update("materiais", diary.materiais.filter(x => x.id !== item.id))}>Excluir</button></div>)}
    <h3>Equipamentos</h3>{diary.equipamentos.map(item => <div className="entry-card" key={item.id}><div className="form-grid two"><label>Descrição<input value={item.descricao} onChange={e => patchEquipment(item.id, { descricao: e.target.value })} /></label><label>Situação<select value={item.status} onChange={e => patchEquipment(item.id, { status: e.target.value as EquipmentEntry["status"] })}><option value="utilizado">Utilizado</option><option value="parado">Parado</option><option value="indisponivel">Indisponível</option></select></label><label>Horas<input type="number" step="0.5" value={item.horas} onChange={e => patchEquipment(item.id, { horas: numberValue(e.target.value) })} /></label><label>Observação<input value={item.observacao} onChange={e => patchEquipment(item.id, { observacao: e.target.value })} /></label></div><button className="icon-btn danger" onClick={() => update("equipamentos", diary.equipamentos.filter(x => x.id !== item.id))}>Excluir</button></div>)}
    {!diary.materiais.length && !diary.equipamentos.length && <div className="empty">Sem registros de recursos. Esta etapa pode permanecer vazia.</div>}
  </div>;

  const patchMeal = (key: "cafe_manha" | "almoco" | "cafe_tarde" | "jantar", patch: Partial<MealEntry>) => update("despesas", { ...diary.despesas, [key]: { ...diary.despesas[key], ...patch } });
  const costStep = <div className="panel"><div className="section-head"><div><h2>Despesas e deslocamento</h2><p>Registre apenas os custos efetivamente realizados. Os totais são calculados automaticamente.</p></div></div>
    <h3>Alimentação</h3><div className="cards-list">{([ ["cafe_manha", "Café da manhã"], ["almoco", "Almoço"], ["cafe_tarde", "Café da tarde"], ["jantar", "Jantar"] ] as Array<["cafe_manha" | "almoco" | "cafe_tarde" | "jantar", string]>).map(([key, label]) => { const meal = diary.despesas[key]; return <div className="entry-card" key={key}><div className="entry-title"><strong>{label}</strong><span>R$ {formatNumber(mealTotal(meal), 2)}</span></div><div className="form-grid two"><label>Quantidade<input type="number" min="0" step="1" value={meal.quantidade} onChange={e => patchMeal(key, { quantidade: Math.max(0, numberValue(e.target.value)) })} /></label><label>Valor unitário (R$)<input type="number" min="0" step="0.01" value={meal.valor_unitario} onChange={e => patchMeal(key, { valor_unitario: Math.max(0, numberValue(e.target.value)) })} /></label></div></div>; })}</div>
    <div className="section-head"><div><h3>Despesas extras</h3><p>Informe a finalidade para facilitar a aprovação.</p></div><button className="btn secondary small" onClick={() => update("despesas", { ...diary.despesas, extras: [...diary.despesas.extras, { id: uid("DESP"), descricao: "", valor: 0 }] })}>Adicionar</button></div>
    {diary.despesas.extras.map((item, index) => <div className="entry-card" key={item.id}><div className="entry-title"><strong>Despesa extra {index + 1}</strong><button className="icon-btn danger" onClick={() => update("despesas", { ...diary.despesas, extras: diary.despesas.extras.filter(x => x.id !== item.id) })}>Excluir</button></div><div className="form-grid two"><label>Descrição<input value={item.descricao} onChange={e => update("despesas", { ...diary.despesas, extras: diary.despesas.extras.map(x => x.id === item.id ? { ...x, descricao: e.target.value } : x) })} /></label><label>Valor (R$)<input type="number" min="0" step="0.01" value={item.valor} onChange={e => update("despesas", { ...diary.despesas, extras: diary.despesas.extras.map(x => x.id === item.id ? { ...x, valor: Math.max(0, numberValue(e.target.value)) } : x) })} /></label></div></div>)}
    <div className="form-grid two"><label>Abastecimento (R$)<input type="number" min="0" step="0.01" value={diary.despesas.abastecimento} onChange={e => update("despesas", { ...diary.despesas, abastecimento: Math.max(0, numberValue(e.target.value)) })} /></label><label>Observação das despesas<input value={diary.despesas.observacao} onChange={e => update("despesas", { ...diary.despesas, observacao: e.target.value })} /></label></div>
    <div className="info-card"><strong>Total do dia: R$ {formatNumber(totalExpenses, 2)}</strong><br /><span>O total semanal será consolidado automaticamente no gerenciador.</span></div>
    <h3>Deslocamento</h3><div className="form-grid two"><label>Veículo<input list="vehicle-list" value={diary.deslocamento.veiculo} onChange={e => update("deslocamento", { ...diary.deslocamento, veiculo: e.target.value })} /><datalist id="vehicle-list">{(config.veiculos || []).map(v => <option key={v} value={v} />)}</datalist></label><label>Placa<input value={diary.deslocamento.placa} onChange={e => update("deslocamento", { ...diary.deslocamento, placa: e.target.value.toUpperCase() })} /></label><label>KM inicial<input type="number" min="0" step="0.1" value={diary.deslocamento.km_inicial} onChange={e => update("deslocamento", { ...diary.deslocamento, km_inicial: Math.max(0, numberValue(e.target.value)) })} /></label><label>KM final<input type="number" min="0" step="0.1" value={diary.deslocamento.km_final} onChange={e => update("deslocamento", { ...diary.deslocamento, km_final: Math.max(0, numberValue(e.target.value)) })} /></label><label className="span-2">Observação do deslocamento<input value={diary.deslocamento.observacao} onChange={e => update("deslocamento", { ...diary.deslocamento, observacao: e.target.value })} /></label></div><div className="info-card"><strong>Distância calculada: {formatNumber(kmTravelled)} km</strong></div>
  </div>;

  const safetyStep = <div className="panel"><h2>Segurança</h2><p>Confirme os controles aplicáveis ao dia.</p><div className="toggle-grid">{[
    ["dds_realizado", "DDS realizado"], ["apr_disponivel", "APR disponível"], ["epis_conformes", "EPI em conformidade"], ["isolamento_area", "Área isolada"], ["permissao_trabalho", "Permissão de trabalho"], ["houve_ocorrencia", "Houve ocorrência / quase acidente"]
  ].map(([key, label]) => <label className={`toggle-card ${(diary.seguranca as any)[key] ? "yes" : "no"}`} key={key}><input type="checkbox" checked={(diary.seguranca as any)[key]} onChange={e => update("seguranca", { ...diary.seguranca, [key]: e.target.checked })} /><span><strong>{label}</strong><small>{(diary.seguranca as any)[key] ? "SIM" : "NÃO"}</small></span></label>)}</div>{diary.seguranca.houve_ocorrencia && <label>Descreva a ocorrência<textarea rows={5} value={diary.seguranca.descricao_ocorrencia} onChange={e => update("seguranca", { ...diary.seguranca, descricao_ocorrencia: e.target.value })} /></label>}</div>;

  const obstructionStep = <div className="panel"><div className="section-head"><div><h2>Impedimentos</h2><p>Registre as causas de perda ou restrição de produção.</p></div><button className="btn primary" onClick={() => update("impedimentos", [...diary.impedimentos, { id: uid("IMP"), categoria: config.categorias_impedimento[0] || "Outro", descricao: "", impacto: "parcial", inicio: "", fim: "", horas_perdidas: 0, responsavel: "", acao_necessaria: "", prazo: "", status: "aberto" }])}>Adicionar impedimento</button></div>{diary.impedimentos.map((item, index) => <div className="entry-card" key={item.id}><div className="entry-title"><strong>Impedimento {index + 1}</strong><button className="icon-btn danger" onClick={() => update("impedimentos", diary.impedimentos.filter(x => x.id !== item.id))}>Excluir</button></div><div className="form-grid two"><label>Categoria<select value={item.categoria} onChange={e => patchObstruction(item.id, { categoria: e.target.value })}>{config.categorias_impedimento.map(c => <option key={c}>{c}</option>)}</select></label><label>Impacto<select value={item.impacto} onChange={e => patchObstruction(item.id, { impacto: e.target.value as ObstructionEntry["impacto"] })}><option value="sem_interrupcao">Sem interrupção</option><option value="parcial">Interrupção parcial</option><option value="total">Interrupção total</option></select></label><label>Início<input type="time" value={item.inicio} onChange={e => patchObstruction(item.id, { inicio: e.target.value })} /></label><label>Fim<input type="time" value={item.fim} onChange={e => patchObstruction(item.id, { fim: e.target.value })} /></label><label>Horas perdidas<input type="number" step="0.5" value={item.horas_perdidas} onChange={e => patchObstruction(item.id, { horas_perdidas: numberValue(e.target.value) })} /></label><label>Responsável pela solução<input value={item.responsavel} onChange={e => patchObstruction(item.id, { responsavel: e.target.value })} /></label><label className="span-2">Descrição<textarea rows={3} value={item.descricao} onChange={e => patchObstruction(item.id, { descricao: e.target.value })} /></label><label className="span-2">Ação necessária<input value={item.acao_necessaria} onChange={e => patchObstruction(item.id, { acao_necessaria: e.target.value })} /></label></div></div>)}{!diary.impedimentos.length && <div className="empty success">Sem impedimentos registrados.</div>}</div>;

  const photosStep = <div className="panel"><div className="section-head"><div><h2>Registro fotográfico</h2><p>Vincule cada foto a uma atividade ou ocorrência quando possível.</p></div><button className="btn primary" disabled={busy} onClick={() => photoInput.current?.click()}>Adicionar fotos</button><input ref={photoInput} hidden type="file" accept="image/*" capture="environment" multiple onChange={e => addPhotos(e.target.files)} /></div><div className="photo-grid">{diary.fotos.map(photo => <div className="photo-card" key={photo.id}><img src={photo.data_url} alt={photo.legenda || photo.nome} /><div className="photo-fields"><label>Legenda<input value={photo.legenda} onChange={e => update("fotos", diary.fotos.map(p => p.id === photo.id ? { ...p, legenda: e.target.value } : p))} /></label><label>Vínculo<select value={photo.vinculo_tipo} onChange={e => update("fotos", diary.fotos.map(p => p.id === photo.id ? { ...p, vinculo_tipo: e.target.value, vinculo_id: "" } : p))}><option value="geral">Geral</option><option value="atividade">Atividade</option><option value="impedimento">Impedimento</option><option value="seguranca">Segurança</option></select></label>{photo.vinculo_tipo === "atividade" && <label>Atividade<select value={photo.vinculo_id} onChange={e => update("fotos", diary.fotos.map(p => p.id === photo.id ? { ...p, vinculo_id: e.target.value } : p))}><option value="">Selecione...</option>{diary.atividades.map(a => <option key={a.id} value={a.id}>{a.codigo || a.descricao}</option>)}</select></label>}<button className="icon-btn danger" onClick={() => update("fotos", diary.fotos.filter(p => p.id !== photo.id))}>Remover</button></div></div>)}</div>{!diary.fotos.length && <div className="empty">Nenhuma foto adicionada.</div>}</div>;

  const finishStep = <div className="panel"><h2>Encerramento</h2><label>Observações gerais<textarea rows={5} value={diary.observacoes_gerais} onChange={e => update("observacoes_gerais", e.target.value)} /></label><div className="form-grid two"><label>Responsável<input value={diary.assinatura_encarregado.nome} onChange={e => update("assinatura_encarregado", { ...diary.assinatura_encarregado, nome: e.target.value })} /></label><label>Função<input value={diary.assinatura_encarregado.funcao} onChange={e => update("assinatura_encarregado", { ...diary.assinatura_encarregado, funcao: e.target.value })} /></label></div><label>Assinatura do responsável da equipe<SignaturePad value={diary.assinatura_encarregado.data_url} onChange={value => update("assinatura_encarregado", { ...diary.assinatura_encarregado, data_url: value })} /></label><h3>Responsável do cliente (opcional)</h3><div className="form-grid two"><label>Nome<input value={diary.assinatura_fiscal?.nome || ""} onChange={e => update("assinatura_fiscal", { ...(diary.assinatura_fiscal || { nome: "", funcao: "Responsável do cliente", data_hora: "" }), nome: e.target.value })} /></label><label>Função<input value={diary.assinatura_fiscal?.funcao || "Responsável do cliente"} onChange={e => update("assinatura_fiscal", { ...(diary.assinatura_fiscal || { nome: "", funcao: "", data_hora: "" }), funcao: e.target.value })} /></label></div><label>Assinatura do cliente<SignaturePad value={diary.assinatura_fiscal?.data_url} onChange={value => update("assinatura_fiscal", { ...(diary.assinatura_fiscal || { nome: "", funcao: "Responsável do cliente", data_hora: "" }), data_url: value })} /></label><div className="info-card"><strong>Resumo administrativo:</strong> {formatNumber(peopleHours)} HH · R$ {formatNumber(totalExpenses, 2)} · {formatNumber(kmTravelled)} km</div><div className="validation-list">{validation.map((item, index) => <button key={`${item.text}-${index}`} className={`validation ${item.level}`} onClick={() => setStep(item.step)}><span>{item.level === "error" ? "!" : item.level === "warning" ? "⚠" : "✓"}</span>{item.text}</button>)}</div><div className="final-actions"><button className="btn primary large" disabled={busy || errors > 0} onClick={() => finalize("zip")}>{busy ? "Gerando..." : "Gerar pacote para envio"}</button><button className="btn secondary" disabled={busy || errors > 0} onClick={() => finalize("pdf")}>Gerar somente PDF</button><button className="btn secondary" disabled={busy || errors > 0} onClick={() => finalize("share")}>Compartilhar ou baixar</button></div><div className="info-card"><strong>Envio recomendado:</strong> envie o arquivo <code>Pacote_...zip</code>. Ele contém o PDF, os dados estruturados, as fotos e o manifesto de integridade.</div></div>;

  const contents = [identification, teamStep, activitiesStep, resourcesStep, costStep, safetyStep, obstructionStep, photosStep, finishStep];

  return <div className="app-shell">
    <header className="topbar"><div><span className="eyebrow">DIÁRIO DE OBRA</span><h1>{config.empresa}</h1><p>{diary.projeto.nome || "Selecione uma obra"} · {diary.data}</p></div><div className="top-actions"><button className="btn ghost" onClick={newDiary}>Novo</button><span className={`status-pill ${diary.status}`}>{diary.status}</span></div></header>
    <nav className="steps" aria-label="Etapas">{STEPS.map((label, index) => { const issue = validation.some(v => v.step === index && v.level === "error"); return <button key={label} className={`${step === index ? "current" : ""} ${issue ? "issue" : ""}`} onClick={() => setStep(index)}><span>{index + 1}</span><em>{label}</em></button>; })}</nav>
    <main>{contents[step]}</main>
    <footer className="mobile-footer"><button className="btn ghost" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>Anterior</button><div><small>Etapa</small><strong>{step + 1}/{STEPS.length}</strong></div><button className="btn primary" disabled={step === STEPS.length - 1} onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}>Próxima</button></footer>
    {message && <button className="toast" onClick={() => setMessage("")}>{message}</button>}
  </div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
