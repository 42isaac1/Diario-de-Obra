const { useEffect, useMemo, useRef, useState } = React;

const APP_VERSION = "1.1.0";
type Status = "pendente" | "aprovado" | "rejeitado" | "ressalva";
type DiarySummary = {
  registro_id: number; diario_id: string; revisao: number; projeto_id: string; projeto_nome: string; cliente: string;
  data: string; equipe_id: string; equipe_nome: string; encarregado: string; pessoas_count: number; homens_hora: number;
  atividades_count: number; quantidade_total: number; impedimentos_count: number; horas_perdidas: number; fotos_count: number;
  total_despesas: number; km_rodado: number;
  status_aprovacao: Status; observacao_aprovacao: string; origem_formato: string; importado_em: string; possui_pdf: boolean;
  possui_pacote: boolean; validacao: { mensagens?: string[]; integridade?: boolean; anexos_extraidos?: number };
};
type DiaryDetail = DiarySummary & { dados: any; validacao: any };
type Dashboard = { periodo: { inicio: string; fim: string }; totais: Record<string, number>; por_projeto: any[]; recentes: DiarySummary[]; serie_diaria: any[] };
type Config = { schema_version: string; empresa: string; projetos: any[]; funcionarios: any[]; equipes: any[]; atividades: any[]; categorias_impedimento: string[]; unidades: string[]; veiculos: string[] };
type ImportResult = { ok: boolean; registro_id?: number; diario_id?: string; revisao?: number; status: string; mensagens: string[]; dados?: any };
type SystemInfo = { version: string; hostname: string; local_ip: string; campo_path: string; contingency_pdf: string };

const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(path, options);
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try { const data = await response.json(); message = data.detail || message; } catch { /* ignore */ }
    throw new Error(message);
  }
  return await response.json() as T;
};
const fmt = (value: number, digits = 1) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value || 0);
const fmtDate = (value: string) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "-";
const fmtDateTime = (value: string) => value ? new Date(value).toLocaleString("pt-BR") : "-";
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const copy = (value: string) => navigator.clipboard?.writeText(value);

function StatusBadge({ status }: { status: string }) {
  const label: Record<string, string> = { pendente: "Pendente", aprovado: "Aprovado", rejeitado: "Rejeitado", ressalva: "Com ressalva", importado: "Importado", importado_com_ressalva: "Importado com ressalva", duplicado: "Duplicado", conflito: "Conflito" };
  return <span className={`badge ${status}`}>{label[status] || status}</span>;
}

function App() {
  const [tab, setTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [diaries, setDiaries] = useState<DiarySummary[]>([]);
  const [detail, setDetail] = useState<DiaryDetail | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [drag, setDrag] = useState(false);
  const [filters, setFilters] = useState({ query: "", project: "", status: "", date_from: "", date_to: "" });
  const fileInput = useRef<HTMLInputElement | null>(null);

  const loadDashboard = async () => setDashboard(await api<Dashboard>("/api/dashboard"));
  const loadDiaries = async () => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    setDiaries(await api<DiarySummary[]>(`/api/diarios?${params.toString()}`));
  };
  const loadConfig = async () => setConfig(await api<Config>("/api/config"));
  const refreshAll = async () => {
    setLoading(true);
    try { await Promise.all([loadDashboard(), loadDiaries(), loadConfig(), api<SystemInfo>("/api/system").then(setSystem)]); }
    catch (error) { setNotice(`Falha ao carregar dados: ${String(error)}`); }
    finally { setLoading(false); }
  };

  useEffect(() => { refreshAll(); }, []);
  useEffect(() => { if (tab === "diarios") loadDiaries().catch(error => setNotice(String(error))); }, [filters]);

  const importFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setLoading(true);
    setImportResults([]);
    const form = new FormData();
    list.forEach(file => form.append("files", file));
    try {
      const results = await api<ImportResult[]>("/api/import", { method: "POST", body: form });
      setImportResults(results);
      await Promise.all([loadDashboard(), loadDiaries()]);
      setNotice(`${results.filter(r => r.ok).length} de ${results.length} arquivo(s) importado(s).`);
    } catch (error) { setNotice(`Erro de importação: ${String(error)}`); }
    finally { setLoading(false); setDrag(false); if (fileInput.current) fileInput.current.value = ""; }
  };

  const openDetail = async (id: number) => {
    try { setDetail(await api<DiaryDetail>(`/api/diarios/${id}`)); }
    catch (error) { setNotice(String(error)); }
  };

  const updateApproval = async (status: Status) => {
    if (!detail) return;
    const observation = status === "aprovado" ? "" : prompt("Observação da análise:", detail.observacao_aprovacao || "") ?? "";
    try {
      const updated = await api<DiaryDetail>(`/api/diarios/${detail.registro_id}/approval`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, observacao: observation }) });
      setDetail(updated);
      await Promise.all([loadDashboard(), loadDiaries()]);
      setNotice(`Diário marcado como ${status}.`);
    } catch (error) { setNotice(String(error)); }
  };

  const deleteDiary = async () => {
    if (!detail || !confirm(`Excluir definitivamente ${detail.diario_id} R${detail.revisao}?`)) return;
    try {
      await api(`/api/diarios/${detail.registro_id}`, { method: "DELETE" });
      setDetail(null);
      await Promise.all([loadDashboard(), loadDiaries()]);
      setNotice("Diário excluído.");
    } catch (error) { setNotice(String(error)); }
  };

  const saveConfig = async () => {
    if (!config) return;
    setLoading(true);
    try {
      const saved = await api<Config>("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      setConfig(saved);
      setNotice("Cadastros salvos. Exporte a configuração e envie às equipes de campo.");
    } catch (error) { setNotice(`Falha ao salvar: ${String(error)}`); }
    finally { setLoading(false); }
  };

  const nav = [
    ["dashboard", "Visão geral", "▦"], ["importar", "Importar", "⇧"], ["diarios", "Diários", "☷"],
    ["cadastros", "Cadastros", "⚙"], ["ajuda", "Implantação", "?"],
  ];

  const dashboardView = dashboard && <div className="view">
    <div className="view-head"><div><span className="eyebrow">ÚLTIMOS 30 DIAS</span><h2>Visão geral da operação</h2><p>{fmtDate(dashboard.periodo.inicio)} a {fmtDate(dashboard.periodo.fim)}</p></div><div className="head-actions"><a className="btn secondary" href="/api/export/csv">Exportar Excel/CSV</a><a className="btn ghost" href="/api/backup">Gerar backup</a></div></div>
    <div className="kpi-grid">
      <Kpi label="Diários recebidos" value={fmt(dashboard.totais.total_diarios, 0)} hint={`${fmt(dashboard.totais.pendentes, 0)} aguardando análise`} icon="DO" />
      <Kpi label="Homens-hora" value={`${fmt(dashboard.totais.homens_hora)} h`} hint="Equipe mobilizada" icon="HH" />
      <Kpi label="Atividades" value={fmt(dashboard.totais.atividades, 0)} hint="Registros executados" icon="AT" />
      <Kpi label="Horas perdidas" value={`${fmt(dashboard.totais.horas_perdidas)} h`} hint={`${fmt(dashboard.totais.impedimentos, 0)} impedimentos`} icon="!" warning={dashboard.totais.horas_perdidas > 0} />
      <Kpi label="Despesas registradas" value={`R$ ${fmt(dashboard.totais.total_despesas, 2)}`} hint="Consolidação dos diários" icon="R$" />
      <Kpi label="Quilometragem" value={`${fmt(dashboard.totais.km_rodado)} km`} hint="Deslocamento das equipes" icon="KM" />
    </div>
    <div className="dashboard-grid">
      <section className="card"><div className="card-head"><div><h3>Produção por projeto</h3><p>Consolidação dos diários importados.</p></div></div>{dashboard.por_projeto.length ? <div className="project-bars">{dashboard.por_projeto.map((project, index) => { const max = Math.max(...dashboard.por_projeto.map(p => p.homens_hora || 0), 1); return <div className="project-bar" key={project.projeto_id}><div className="bar-label"><strong>{project.projeto_nome}</strong><span>{fmt(project.homens_hora)} HH · {project.diarios} diário(s)</span></div><div className="bar-track"><i style={{ width: `${Math.max(4, (project.homens_hora / max) * 100)}%` }} /></div><small>{fmt(project.horas_perdidas)} h perdidas · R$ {fmt(project.total_despesas, 2)} · {fmt(project.km_rodado)} km</small></div>; })}</div> : <Empty text="Importe o primeiro diário para visualizar os indicadores." />}</section>
      <section className="card"><div className="card-head"><div><h3>Diários recentes</h3><p>Últimos registros recebidos.</p></div><button className="link-button" onClick={() => setTab("diarios")}>Ver todos</button></div><div className="recent-list">{dashboard.recentes.map(item => <button key={item.registro_id} onClick={() => openDetail(item.registro_id)}><span className="date-box"><strong>{item.data.slice(8,10)}</strong><small>{new Date(`${item.data}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" })}</small></span><span className="recent-main"><strong>{item.projeto_nome}</strong><small>{item.equipe_nome} · {fmt(item.homens_hora)} HH · R$ {fmt(item.total_despesas, 2)}</small></span><StatusBadge status={item.status_aprovacao} /></button>)}</div>{!dashboard.recentes.length && <Empty text="Nenhum diário recebido." />}</section>
    </div>
  </div>;

  const importView = <div className="view"><div className="view-head"><div><span className="eyebrow">ENTRADA CONTROLADA</span><h2>Importar diários de campo</h2><p>O pacote ZIP é preferencial. PDFs gerados pelo aplicativo e o modelo de contingência também são reconhecidos.</p></div></div>
    <div className={`dropzone ${drag ? "drag" : ""}`} onDragEnter={e => { e.preventDefault(); setDrag(true); }} onDragOver={e => e.preventDefault()} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); importFiles(e.dataTransfer.files); }} onClick={() => fileInput.current?.click()}><input ref={fileInput} hidden type="file" accept=".zip,.pdf,.json" multiple onChange={e => e.target.files && importFiles(e.target.files)} /><span className="drop-icon">⇧</span><h3>Arraste os arquivos aqui</h3><p>ou clique para selecionar pacotes ZIP, PDFs ou JSONs</p><small>Limite de 80 MB por arquivo</small></div>
    <div className="import-guidance"><div><strong>1. Receba</strong><span>O funcionário envia o pacote pelo canal definido.</span></div><div><strong>2. Importe</strong><span>O sistema verifica estrutura, revisão e duplicidade.</span></div><div><strong>3. Analise</strong><span>Confira o PDF e aprove ou registre ressalva.</span></div></div>
    {importResults.length > 0 && <section className="card results"><h3>Resultado da importação</h3>{importResults.map((result, index) => <div className={`result-row ${result.ok ? "ok" : "fail"}`} key={index}><StatusBadge status={result.status} /><div><strong>{result.diario_id || `Arquivo ${index + 1}`}{result.revisao ? ` · R${result.revisao}` : ""}</strong>{result.mensagens.map((message, i) => <small key={i}>{message}</small>)}</div>{result.registro_id && <button className="btn ghost small" onClick={() => openDetail(result.registro_id!)}>Abrir</button>}</div>)}</section>}
  </div>;

  const diariesView = <div className="view"><div className="view-head"><div><span className="eyebrow">HISTÓRICO E APROVAÇÃO</span><h2>Diários importados</h2><p>{diaries.length} registro(s) conforme os filtros atuais.</p></div><button className="btn primary" onClick={() => setTab("importar")}>Importar arquivos</button></div>
    <div className="filters"><input placeholder="Buscar ID, obra, equipe ou encarregado" value={filters.query} onChange={e => setFilters({ ...filters, query: e.target.value })} /><select value={filters.project} onChange={e => setFilters({ ...filters, project: e.target.value })}><option value="">Todos os projetos</option>{config?.projetos.map(p => <option key={p.id} value={p.id}>{p.id} — {p.nome}</option>)}</select><select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">Todos os status</option><option value="pendente">Pendentes</option><option value="aprovado">Aprovados</option><option value="ressalva">Com ressalva</option><option value="rejeitado">Rejeitados</option></select><input type="date" value={filters.date_from} onChange={e => setFilters({ ...filters, date_from: e.target.value })} /><input type="date" value={filters.date_to} onChange={e => setFilters({ ...filters, date_to: e.target.value })} /></div>
    <div className="table-card"><table><thead><tr><th>Data</th><th>Diário</th><th>Projeto / equipe</th><th>Produção</th><th>Ocorrências</th><th>Status</th><th></th></tr></thead><tbody>{diaries.map(item => <tr key={item.registro_id}><td><strong>{fmtDate(item.data)}</strong><small>{fmtDateTime(item.importado_em)}</small></td><td><strong>{item.diario_id}</strong><small>Revisão {item.revisao} · {item.origem_formato.toUpperCase()}</small></td><td><strong>{item.projeto_nome}</strong><small>{item.equipe_nome} · {item.encarregado}</small></td><td><strong>{fmt(item.homens_hora)} HH</strong><small>{item.atividades_count} atividade(s) · {fmt(item.quantidade_total)} un. consolidadas</small></td><td><strong className={item.impedimentos_count ? "danger-text" : ""}>{item.impedimentos_count} impedimento(s)</strong><small>{fmt(item.horas_perdidas)} h perdidas · {item.fotos_count} foto(s)</small></td><td><StatusBadge status={item.status_aprovacao} />{item.validacao?.integridade === false && <small className="danger-text">Integridade com alerta</small>}</td><td><button className="btn ghost small" onClick={() => openDetail(item.registro_id)}>Analisar</button></td></tr>)}</tbody></table>{!diaries.length && <Empty text="Nenhum diário localizado com estes filtros." />}</div>
  </div>;

  const registrationsView = config && <div className="view"><div className="view-head"><div><span className="eyebrow">BASE DO APLICATIVO DE CAMPO</span><h2>Cadastros e configuração</h2><p>Salve os cadastros e exporte o JSON para distribuir às equipes.</p></div><div className="head-actions"><a className="btn secondary" href="/api/config/export">Exportar configuração</a><button className="btn primary" disabled={loading} onClick={saveConfig}>Salvar alterações</button></div></div>
    <section className="card"><h3>Empresa</h3><label className="field-label">Nome apresentado nos documentos<input value={config.empresa} onChange={e => setConfig({ ...config, empresa: e.target.value })} /></label></section>
    <ConfigSection title="Obras" description="Projetos disponíveis no formulário de campo" onAdd={() => setConfig({ ...config, projetos: [...config.projetos, { id: `OBR-${String(config.projetos.length + 1).padStart(3, "0")}`, nome: "Nova obra", cliente: "", local: "", contrato: "", centro_custo: "", ativo: true }] })}>
      <div className="config-grid">{config.projetos.map((p, index) => <div className="config-item" key={`${p.id}-${index}`}><div className="config-title"><strong>{p.id}</strong><button onClick={() => setConfig({ ...config, projetos: config.projetos.filter((_, i) => i !== index) })}>Excluir</button></div><label>Código<input value={p.id} onChange={e => { const arr = [...config.projetos]; arr[index] = { ...p, id: e.target.value }; setConfig({ ...config, projetos: arr }); }} /></label><label>Nome<input value={p.nome} onChange={e => { const arr = [...config.projetos]; arr[index] = { ...p, nome: e.target.value }; setConfig({ ...config, projetos: arr }); }} /></label><label>Cliente<input value={p.cliente} onChange={e => { const arr = [...config.projetos]; arr[index] = { ...p, cliente: e.target.value }; setConfig({ ...config, projetos: arr }); }} /></label><label>Local<input value={p.local} onChange={e => { const arr = [...config.projetos]; arr[index] = { ...p, local: e.target.value }; setConfig({ ...config, projetos: arr }); }} /></label><label>Contrato<input value={p.contrato} onChange={e => { const arr = [...config.projetos]; arr[index] = { ...p, contrato: e.target.value }; setConfig({ ...config, projetos: arr }); }} /></label><label>Centro de custo<input value={p.centro_custo} onChange={e => { const arr = [...config.projetos]; arr[index] = { ...p, centro_custo: e.target.value }; setConfig({ ...config, projetos: arr }); }} /></label></div>)}</div>
    </ConfigSection>
    <ConfigSection title="Funcionários" description="Pessoas que podem compor as equipes" onAdd={() => setConfig({ ...config, funcionarios: [...config.funcionarios, { id: `FUN-${String(config.funcionarios.length + 1).padStart(3, "0")}`, nome: "Novo funcionário", funcao: "", ativo: true }] })}>
      <div className="simple-table">{config.funcionarios.map((f, index) => <div className="simple-row" key={`${f.id}-${index}`}><input value={f.id} onChange={e => { const arr = [...config.funcionarios]; arr[index] = { ...f, id: e.target.value }; setConfig({ ...config, funcionarios: arr }); }} /><input value={f.nome} onChange={e => { const arr = [...config.funcionarios]; arr[index] = { ...f, nome: e.target.value }; setConfig({ ...config, funcionarios: arr }); }} /><input value={f.funcao} onChange={e => { const arr = [...config.funcionarios]; arr[index] = { ...f, funcao: e.target.value }; setConfig({ ...config, funcionarios: arr }); }} /><button onClick={() => setConfig({ ...config, funcionarios: config.funcionarios.filter((_, i) => i !== index) })}>Excluir</button></div>)}</div>
    </ConfigSection>
    <ConfigSection title="Equipes" description="Selecione os integrantes que serão pré-carregados" onAdd={() => setConfig({ ...config, equipes: [...config.equipes, { id: `EQ-${String(config.equipes.length + 1).padStart(2, "0")}`, nome: "Nova equipe", encarregado: "", membros: [], ativo: true }] })}>
      <div className="config-grid">{config.equipes.map((team, index) => <div className="config-item" key={`${team.id}-${index}`}><div className="config-title"><strong>{team.id}</strong><button onClick={() => setConfig({ ...config, equipes: config.equipes.filter((_, i) => i !== index) })}>Excluir</button></div><label>Código<input value={team.id} onChange={e => { const arr = [...config.equipes]; arr[index] = { ...team, id: e.target.value }; setConfig({ ...config, equipes: arr }); }} /></label><label>Nome<input value={team.nome} onChange={e => { const arr = [...config.equipes]; arr[index] = { ...team, nome: e.target.value }; setConfig({ ...config, equipes: arr }); }} /></label><label>Encarregado<input value={team.encarregado} onChange={e => { const arr = [...config.equipes]; arr[index] = { ...team, encarregado: e.target.value }; setConfig({ ...config, equipes: arr }); }} /></label><div className="member-list"><span>Integrantes</span>{config.funcionarios.map(worker => <label key={worker.id}><input type="checkbox" checked={team.membros.includes(worker.id)} onChange={e => { const members = e.target.checked ? [...team.membros, worker.id] : team.membros.filter((id: string) => id !== worker.id); const arr = [...config.equipes]; arr[index] = { ...team, membros: members }; setConfig({ ...config, equipes: arr }); }} />{worker.nome} <small>{worker.funcao}</small></label>)}</div></div>)}</div>
    </ConfigSection>
    <ConfigSection title="Atividades" description="Catálogo rápido de atividades e unidades" onAdd={() => setConfig({ ...config, atividades: [...config.atividades, { codigo: `ATV-${String(config.atividades.length + 1).padStart(3, "0")}`, descricao: "Nova atividade", unidade: "un", projeto_id: "", quantidade_planejada: 0, ativo: true }] })}>
      <div className="simple-table activity-table">{config.atividades.map((a, index) => <div className="simple-row" key={`${a.codigo}-${index}`}><input value={a.codigo} onChange={e => { const arr = [...config.atividades]; arr[index] = { ...a, codigo: e.target.value }; setConfig({ ...config, atividades: arr }); }} /><input value={a.descricao} onChange={e => { const arr = [...config.atividades]; arr[index] = { ...a, descricao: e.target.value }; setConfig({ ...config, atividades: arr }); }} /><select value={a.unidade} onChange={e => { const arr = [...config.atividades]; arr[index] = { ...a, unidade: e.target.value }; setConfig({ ...config, atividades: arr }); }}>{config.unidades.map(u => <option key={u}>{u}</option>)}</select><select value={a.projeto_id} onChange={e => { const arr = [...config.atividades]; arr[index] = { ...a, projeto_id: e.target.value }; setConfig({ ...config, atividades: arr }); }}><option value="">Todas as obras</option>{config.projetos.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}</select><input type="number" value={a.quantidade_planejada} onChange={e => { const arr = [...config.atividades]; arr[index] = { ...a, quantidade_planejada: Number(e.target.value) || 0 }; setConfig({ ...config, atividades: arr }); }} /><button onClick={() => setConfig({ ...config, atividades: config.atividades.filter((_, i) => i !== index) })}>Excluir</button></div>)}</div>
    </ConfigSection>
    <section className="card"><div className="card-head"><div><h3>Categorias de impedimento</h3><p>Opções apresentadas no celular.</p></div><button className="btn secondary small" onClick={() => setConfig({ ...config, categorias_impedimento: [...config.categorias_impedimento, "Nova categoria"] })}>Adicionar</button></div><div className="chips-edit">{config.categorias_impedimento.map((c, index) => <div key={index}><input value={c} onChange={e => { const arr = [...config.categorias_impedimento]; arr[index] = e.target.value; setConfig({ ...config, categorias_impedimento: arr }); }} /><button onClick={() => setConfig({ ...config, categorias_impedimento: config.categorias_impedimento.filter((_, i) => i !== index) })}>×</button></div>)}</div></section>
    <section className="card"><div className="card-head"><div><h3>Veículos</h3><p>Lista rápida para o registro de deslocamento.</p></div><button className="btn secondary small" onClick={() => setConfig({ ...config, veiculos: [...(config.veiculos || []), "Novo veículo"] })}>Adicionar</button></div><div className="chips-edit">{(config.veiculos || []).map((v, index) => <div key={index}><input value={v} onChange={e => { const arr = [...(config.veiculos || [])]; arr[index] = e.target.value; setConfig({ ...config, veiculos: arr }); }} /><button onClick={() => setConfig({ ...config, veiculos: (config.veiculos || []).filter((_, i) => i !== index) })}>×</button></div>)}</div></section>
  </div>;

  const helpView = <div className="view"><div className="view-head"><div><span className="eyebrow">OPERAÇÃO E DISTRIBUIÇÃO</span><h2>Implantação do fluxo</h2><p>Use esta sequência para colocar o sistema em operação.</p></div></div>
    <div className="help-grid"><section className="card numbered"><i>1</i><h3>Cadastre a operação</h3><p>Atualize obras, funcionários, equipes e atividades na aba Cadastros.</p><button className="btn secondary" onClick={() => setTab("cadastros")}>Abrir cadastros</button></section><section className="card numbered"><i>2</i><h3>Distribua a configuração</h3><p>Exporte o arquivo JSON e peça aos encarregados para importá-lo no aplicativo de campo.</p><a className="btn secondary" href="/api/config/export">Baixar configuração</a></section><section className="card numbered"><i>3</i><h3>Disponibilize o aplicativo</h3><p>Publique a pasta de campo no Netlify ou abra o endereço abaixo na rede local.</p><div className="url-box"><code>{system ? `${location.protocol}//${system.local_ip}:${location.port}/campo/` : "/campo/"}</code><button onClick={() => copy(system ? `${location.protocol}//${system.local_ip}:${location.port}/campo/` : `${location.origin}/campo/`)}>Copiar</button></div><a className="btn ghost" href="/campo/" target="_blank">Abrir aplicativo de campo</a></section><section className="card numbered"><i>4</i><h3>Defina o canal de envio</h3><p>Oriente a equipe a enviar o arquivo <strong>Pacote_...zip</strong> por e-mail, WhatsApp ou pasta compartilhada.</p></section><section className="card numbered"><i>5</i><h3>Importe e aprove</h3><p>Arraste os pacotes na aba Importar. O sistema valida ID, revisão, duplicidade e manifesto.</p><button className="btn secondary" onClick={() => setTab("importar")}>Abrir importação</button></section><section className="card numbered"><i>6</i><h3>Use a contingência</h3><p>Quando o formulário móvel não estiver disponível, use o PDF preenchível e importe o arquivo original salvo.</p><a className="btn secondary" href="/downloads/Modelo_Diario_Obra_Contingencia.pdf">Baixar PDF preenchível</a></section><section className="card numbered"><i>7</i><h3>Integração Google</h3><p>Para terceirizados ou piloto rápido, use o Google Forms + Sheets. O script incluído gera PDF, JSON e ZIP compatíveis com esta importação.</p><a className="btn secondary" href="/downloads/Integracao_Google_Forms_Sheets.zip">Baixar integração Google</a></section></div>
    <section className="card operational"><h3>Regras operacionais recomendadas</h3><div><span>Diário finalizado até o encerramento do turno.</span><span>Pacote ZIP como formato oficial de envio.</span><span>Correções sempre por nova revisão.</span><span>Aprovação administrativa em até um dia útil.</span><span>Backup semanal pelo botão da visão geral.</span><span>PDF de contingência somente quando necessário.</span></div></section>
  </div>;

  return <div className="layout"><aside><div className="brand"><span>DO</span><div><strong>Diário de Obra</strong><small>Gestão local v{APP_VERSION}</small></div></div><nav>{nav.map(([id, label, icon]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><i>{icon}</i><span>{label}</span></button>)}</nav><div className="aside-bottom"><a href="/campo/" target="_blank">Abrir modo campo ↗</a><small>{system?.hostname || "Computador local"}<br />Banco SQLite local</small></div></aside><div className="main-shell"><header><button className="mobile-brand" onClick={() => setTab("dashboard")}>DO</button><div><strong>{config?.empresa || "Diário de Obra Suite"}</strong><small>{loading ? "Atualizando dados..." : "Sistema local ativo"}</small></div><div className="header-actions"><button title="Atualizar" onClick={refreshAll}>↻</button><span className="online-dot" /> <small>Online local</small></div></header><main>{tab === "dashboard" && dashboardView}{tab === "importar" && importView}{tab === "diarios" && diariesView}{tab === "cadastros" && registrationsView}{tab === "ajuda" && helpView}</main></div>
    {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} onApproval={updateApproval} onDelete={deleteDiary} />}
    {notice && <button className="toast" onClick={() => setNotice("")}>{notice}</button>}
  </div>;
}

function Kpi({ label, value, hint, icon, warning = false }: { label: string; value: string; hint: string; icon: string; warning?: boolean }) {
  return <section className={`kpi ${warning ? "warning" : ""}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{hint}</em></div></section>;
}
function Empty({ text }: { text: string }) { return <div className="empty"><span>○</span><p>{text}</p></div>; }
function ConfigSection({ title, description, onAdd, children }: { title: string; description: string; onAdd: () => void; children?: any }) {
  return <section className="card"><div className="card-head"><div><h3>{title}</h3><p>{description}</p></div><button className="btn secondary small" onClick={onAdd}>Adicionar</button></div>{children}</section>;
}

function DetailModal({ detail, onClose, onApproval, onDelete }: { detail: DiaryDetail; onClose: () => void; onApproval: (status: Status) => void; onDelete: () => void }) {
  const data = detail.dados || {};
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><article className="modal"><header><div><span className="eyebrow">ANÁLISE DO DIÁRIO</span><h2>{detail.diario_id} · R{detail.revisao}</h2><p>{detail.projeto_nome} · {fmtDate(detail.data)} · {detail.equipe_nome}</p></div><button className="close" onClick={onClose}>×</button></header><div className="modal-actions"><StatusBadge status={detail.status_aprovacao} /><button className="btn approve" onClick={() => onApproval("aprovado")}>Aprovar</button><button className="btn caution" onClick={() => onApproval("ressalva")}>Ressalva</button><button className="btn reject" onClick={() => onApproval("rejeitado")}>Rejeitar</button>{detail.possui_pdf && <a className="btn secondary" target="_blank" href={`/api/diarios/${detail.registro_id}/pdf`}>Abrir PDF</a>}</div><div className="modal-body">
    <section className="detail-summary"><div><small>Pessoas</small><strong>{detail.pessoas_count}</strong></div><div><small>Homens-hora</small><strong>{fmt(detail.homens_hora)} h</strong></div><div><small>Atividades</small><strong>{detail.atividades_count}</strong></div><div><small>Impedimentos</small><strong>{detail.impedimentos_count}</strong></div><div><small>Horas perdidas</small><strong>{fmt(detail.horas_perdidas)} h</strong></div><div><small>Fotos</small><strong>{detail.fotos_count}</strong></div><div><small>Despesas</small><strong>R$ {fmt(detail.total_despesas, 2)}</strong></div><div><small>Km rodado</small><strong>{fmt(detail.km_rodado)} km</strong></div></section>
    <section className="detail-section"><h3>Identificação</h3><dl><dt>Cliente</dt><dd>{detail.cliente || "-"}</dd><dt>Encarregado</dt><dd>{detail.encarregado}</dd><dt>Turno</dt><dd>{data.turno_inicio} às {data.turno_fim} · intervalo {fmt(data.intervalo_minutos || 0, 0)} min</dd><dt>Local</dt><dd>{data.projeto?.local || "-"}</dd><dt>Contrato</dt><dd>{data.projeto?.contrato || "-"}</dd><dt>Centro de custo</dt><dd>{data.projeto?.centro_custo || "-"}</dd></dl></section>
    <section className="detail-section"><h3>Equipe presente</h3><div className="detail-list">{(data.equipe_presente || []).filter((p: any) => p.presente).map((p: any) => <div key={p.funcionario_id || p.nome}><strong>{p.nome}</strong><span>{p.funcao} · {fmt((p.horas_normais || 0) + (p.horas_extras || 0))} h</span></div>)}</div></section>
    <section className="detail-section"><h3>Atividades</h3><div className="detail-list">{(data.atividades || []).map((a: any, index: number) => <div key={a.id || index}><strong>{a.codigo ? `${a.codigo} — ` : ""}{a.descricao}</strong><span>{a.local || "Sem local"} · {fmt(a.quantidade)} {a.unidade} · {fmt(a.percentual_conclusao, 0)}%</span><small>{a.observacao}</small></div>)}</div>{!(data.atividades || []).length && <p>Sem atividades.</p>}</section>
    <section className="detail-section"><h3>Despesas e deslocamento</h3><dl><dt>Alimentação</dt><dd>R$ {fmt(((data.despesas?.cafe_manha?.quantidade || 0) * (data.despesas?.cafe_manha?.valor_unitario || 0)) + ((data.despesas?.almoco?.quantidade || 0) * (data.despesas?.almoco?.valor_unitario || 0)) + ((data.despesas?.cafe_tarde?.quantidade || 0) * (data.despesas?.cafe_tarde?.valor_unitario || 0)) + ((data.despesas?.jantar?.quantidade || 0) * (data.despesas?.jantar?.valor_unitario || 0)), 2)}</dd><dt>Abastecimento</dt><dd>R$ {fmt(data.despesas?.abastecimento || 0, 2)}</dd><dt>Despesas extras</dt><dd>R$ {fmt((data.despesas?.extras || []).reduce((sum: number, item: any) => sum + (item.valor || 0), 0), 2)}</dd><dt>Total do dia</dt><dd><strong>R$ {fmt(detail.total_despesas, 2)}</strong></dd><dt>Veículo</dt><dd>{data.deslocamento?.veiculo || "-"} {data.deslocamento?.placa ? `· ${data.deslocamento.placa}` : ""}</dd><dt>Quilometragem</dt><dd>{fmt(data.deslocamento?.km_inicial || 0)} → {fmt(data.deslocamento?.km_final || 0)} km · <strong>{fmt(detail.km_rodado)} km rodados</strong></dd></dl>{(data.despesas?.extras || []).length > 0 && <div className="detail-list">{data.despesas.extras.map((item: any, index: number) => <div key={item.id || index}><strong>{item.descricao || `Despesa extra ${index + 1}`}</strong><span>R$ {fmt(item.valor || 0, 2)}</span></div>)}</div>}</section>
    <section className="detail-section"><h3>Segurança</h3><div className="safety-tags">{Object.entries({ "DDS": data.seguranca?.dds_realizado, "APR": data.seguranca?.apr_disponivel, "EPI": data.seguranca?.epis_conformes, "Isolamento": data.seguranca?.isolamento_area, "PT": data.seguranca?.permissao_trabalho }).map(([label, value]) => <span className={value ? "yes" : "no"} key={label}>{label}: {value ? "SIM" : "NÃO"}</span>)}</div>{data.seguranca?.houve_ocorrencia && <div className="alert-box"><strong>Ocorrência de segurança</strong><p>{data.seguranca.descricao_ocorrencia}</p></div>}</section>
    <section className="detail-section"><h3>Impedimentos</h3><div className="detail-list">{(data.impedimentos || []).map((i: any, index: number) => <div key={i.id || index}><strong>{i.categoria} · {i.impacto}</strong><span>{fmt(i.horas_perdidas)} h perdidas · {i.responsavel || "Sem responsável"}</span><small>{i.descricao} {i.acao_necessaria ? `— Ação: ${i.acao_necessaria}` : ""}</small></div>)}</div>{!(data.impedimentos || []).length && <p>Sem impedimentos registrados.</p>}</section>
    <section className="detail-section"><h3>Validação da importação</h3><div className="validation-box"><span className={detail.validacao?.integridade === false ? "fail" : "ok"}>{detail.validacao?.integridade === false ? "!" : "✓"}</span><div>{(detail.validacao?.mensagens || ["Importação sem alertas."]).map((m: string, i: number) => <p key={i}>{m}</p>)}</div></div></section>
    {detail.observacao_aprovacao && <section className="detail-section"><h3>Observação da análise</h3><p>{detail.observacao_aprovacao}</p></section>}
  </div><footer><button className="btn delete" onClick={onDelete}>Excluir registro</button><button className="btn ghost" onClick={onClose}>Fechar</button></footer></article></div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
