"use strict";
const { useEffect, useMemo, useRef, useState } = React;
const APP_VERSION = "1.1.0";
const api = async (path, options) => {
    const response = await fetch(path, options);
    if (!response.ok) {
        let message = `${response.status} ${response.statusText}`;
        try {
            const data = await response.json();
            message = data.detail || message;
        }
        catch { /* ignore */ }
        throw new Error(message);
    }
    return await response.json();
};
const fmt = (value, digits = 1) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value || 0);
const fmtDate = (value) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "-";
const fmtDateTime = (value) => value ? new Date(value).toLocaleString("pt-BR") : "-";
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const copy = (value) => navigator.clipboard?.writeText(value);
function StatusBadge({ status }) {
    const label = { pendente: "Pendente", aprovado: "Aprovado", rejeitado: "Rejeitado", ressalva: "Com ressalva", importado: "Importado", importado_com_ressalva: "Importado com ressalva", duplicado: "Duplicado", conflito: "Conflito" };
    return React.createElement("span", { className: `badge ${status}` }, label[status] || status);
}
function App() {
    const [tab, setTab] = useState("dashboard");
    const [dashboard, setDashboard] = useState(null);
    const [diaries, setDiaries] = useState([]);
    const [detail, setDetail] = useState(null);
    const [config, setConfig] = useState(null);
    const [system, setSystem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState("");
    const [importResults, setImportResults] = useState([]);
    const [drag, setDrag] = useState(false);
    const [filters, setFilters] = useState({ query: "", project: "", status: "", date_from: "", date_to: "" });
    const fileInput = useRef(null);
    const loadDashboard = async () => setDashboard(await api("/api/dashboard"));
    const loadDiaries = async () => {
        const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
        setDiaries(await api(`/api/diarios?${params.toString()}`));
    };
    const loadConfig = async () => setConfig(await api("/api/config"));
    const refreshAll = async () => {
        setLoading(true);
        try {
            await Promise.all([loadDashboard(), loadDiaries(), loadConfig(), api("/api/system").then(setSystem)]);
        }
        catch (error) {
            setNotice(`Falha ao carregar dados: ${String(error)}`);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { refreshAll(); }, []);
    useEffect(() => { if (tab === "diarios")
        loadDiaries().catch(error => setNotice(String(error))); }, [filters]);
    const importFiles = async (files) => {
        const list = Array.from(files);
        if (!list.length)
            return;
        setLoading(true);
        setImportResults([]);
        const form = new FormData();
        list.forEach(file => form.append("files", file));
        try {
            const results = await api("/api/import", { method: "POST", body: form });
            setImportResults(results);
            await Promise.all([loadDashboard(), loadDiaries()]);
            setNotice(`${results.filter(r => r.ok).length} de ${results.length} arquivo(s) importado(s).`);
        }
        catch (error) {
            setNotice(`Erro de importação: ${String(error)}`);
        }
        finally {
            setLoading(false);
            setDrag(false);
            if (fileInput.current)
                fileInput.current.value = "";
        }
    };
    const openDetail = async (id) => {
        try {
            setDetail(await api(`/api/diarios/${id}`));
        }
        catch (error) {
            setNotice(String(error));
        }
    };
    const updateApproval = async (status) => {
        if (!detail)
            return;
        const observation = status === "aprovado" ? "" : prompt("Observação da análise:", detail.observacao_aprovacao || "") ?? "";
        try {
            const updated = await api(`/api/diarios/${detail.registro_id}/approval`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, observacao: observation }) });
            setDetail(updated);
            await Promise.all([loadDashboard(), loadDiaries()]);
            setNotice(`Diário marcado como ${status}.`);
        }
        catch (error) {
            setNotice(String(error));
        }
    };
    const deleteDiary = async () => {
        if (!detail || !confirm(`Excluir definitivamente ${detail.diario_id} R${detail.revisao}?`))
            return;
        try {
            await api(`/api/diarios/${detail.registro_id}`, { method: "DELETE" });
            setDetail(null);
            await Promise.all([loadDashboard(), loadDiaries()]);
            setNotice("Diário excluído.");
        }
        catch (error) {
            setNotice(String(error));
        }
    };
    const saveConfig = async () => {
        if (!config)
            return;
        setLoading(true);
        try {
            const saved = await api("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
            setConfig(saved);
            setNotice("Cadastros salvos. Exporte a configuração e envie às equipes de campo.");
        }
        catch (error) {
            setNotice(`Falha ao salvar: ${String(error)}`);
        }
        finally {
            setLoading(false);
        }
    };
    const nav = [
        ["dashboard", "Visão geral", "▦"], ["importar", "Importar", "⇧"], ["diarios", "Diários", "☷"],
        ["cadastros", "Cadastros", "⚙"], ["ajuda", "Implantação", "?"],
    ];
    const dashboardView = dashboard && React.createElement("div", { className: "view" },
        React.createElement("div", { className: "view-head" },
            React.createElement("div", null,
                React.createElement("span", { className: "eyebrow" }, "\u00DALTIMOS 30 DIAS"),
                React.createElement("h2", null, "Vis\u00E3o geral da opera\u00E7\u00E3o"),
                React.createElement("p", null,
                    fmtDate(dashboard.periodo.inicio),
                    " a ",
                    fmtDate(dashboard.periodo.fim))),
            React.createElement("div", { className: "head-actions" },
                React.createElement("a", { className: "btn secondary", href: "/api/export/csv" }, "Exportar Excel/CSV"),
                React.createElement("a", { className: "btn ghost", href: "/api/backup" }, "Gerar backup"))),
        React.createElement("div", { className: "kpi-grid" },
            React.createElement(Kpi, { label: "Di\u00E1rios recebidos", value: fmt(dashboard.totais.total_diarios, 0), hint: `${fmt(dashboard.totais.pendentes, 0)} aguardando análise`, icon: "DO" }),
            React.createElement(Kpi, { label: "Homens-hora", value: `${fmt(dashboard.totais.homens_hora)} h`, hint: "Equipe mobilizada", icon: "HH" }),
            React.createElement(Kpi, { label: "Atividades", value: fmt(dashboard.totais.atividades, 0), hint: "Registros executados", icon: "AT" }),
            React.createElement(Kpi, { label: "Horas perdidas", value: `${fmt(dashboard.totais.horas_perdidas)} h`, hint: `${fmt(dashboard.totais.impedimentos, 0)} impedimentos`, icon: "!", warning: dashboard.totais.horas_perdidas > 0 }),
            React.createElement(Kpi, { label: "Despesas registradas", value: `R$ ${fmt(dashboard.totais.total_despesas, 2)}`, hint: "Consolida\u00E7\u00E3o dos di\u00E1rios", icon: "R$" }),
            React.createElement(Kpi, { label: "Quilometragem", value: `${fmt(dashboard.totais.km_rodado)} km`, hint: "Deslocamento das equipes", icon: "KM" })),
        React.createElement("div", { className: "dashboard-grid" },
            React.createElement("section", { className: "card" },
                React.createElement("div", { className: "card-head" },
                    React.createElement("div", null,
                        React.createElement("h3", null, "Produ\u00E7\u00E3o por projeto"),
                        React.createElement("p", null, "Consolida\u00E7\u00E3o dos di\u00E1rios importados."))),
                dashboard.por_projeto.length ? React.createElement("div", { className: "project-bars" }, dashboard.por_projeto.map((project, index) => { const max = Math.max(...dashboard.por_projeto.map(p => p.homens_hora || 0), 1); return React.createElement("div", { className: "project-bar", key: project.projeto_id },
                    React.createElement("div", { className: "bar-label" },
                        React.createElement("strong", null, project.projeto_nome),
                        React.createElement("span", null,
                            fmt(project.homens_hora),
                            " HH \u00B7 ",
                            project.diarios,
                            " di\u00E1rio(s)")),
                    React.createElement("div", { className: "bar-track" },
                        React.createElement("i", { style: { width: `${Math.max(4, (project.homens_hora / max) * 100)}%` } })),
                    React.createElement("small", null,
                        fmt(project.horas_perdidas),
                        " h perdidas \u00B7 R$ ",
                        fmt(project.total_despesas, 2),
                        " \u00B7 ",
                        fmt(project.km_rodado),
                        " km")); })) : React.createElement(Empty, { text: "Importe o primeiro di\u00E1rio para visualizar os indicadores." })),
            React.createElement("section", { className: "card" },
                React.createElement("div", { className: "card-head" },
                    React.createElement("div", null,
                        React.createElement("h3", null, "Di\u00E1rios recentes"),
                        React.createElement("p", null, "\u00DAltimos registros recebidos.")),
                    React.createElement("button", { className: "link-button", onClick: () => setTab("diarios") }, "Ver todos")),
                React.createElement("div", { className: "recent-list" }, dashboard.recentes.map(item => React.createElement("button", { key: item.registro_id, onClick: () => openDetail(item.registro_id) },
                    React.createElement("span", { className: "date-box" },
                        React.createElement("strong", null, item.data.slice(8, 10)),
                        React.createElement("small", null, new Date(`${item.data}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }))),
                    React.createElement("span", { className: "recent-main" },
                        React.createElement("strong", null, item.projeto_nome),
                        React.createElement("small", null,
                            item.equipe_nome,
                            " \u00B7 ",
                            fmt(item.homens_hora),
                            " HH \u00B7 R$ ",
                            fmt(item.total_despesas, 2))),
                    React.createElement(StatusBadge, { status: item.status_aprovacao })))),
                !dashboard.recentes.length && React.createElement(Empty, { text: "Nenhum di\u00E1rio recebido." }))));
    const importView = React.createElement("div", { className: "view" },
        React.createElement("div", { className: "view-head" },
            React.createElement("div", null,
                React.createElement("span", { className: "eyebrow" }, "ENTRADA CONTROLADA"),
                React.createElement("h2", null, "Importar di\u00E1rios de campo"),
                React.createElement("p", null, "O pacote ZIP \u00E9 preferencial. PDFs gerados pelo aplicativo e o modelo de conting\u00EAncia tamb\u00E9m s\u00E3o reconhecidos."))),
        React.createElement("div", { className: `dropzone ${drag ? "drag" : ""}`, onDragEnter: e => { e.preventDefault(); setDrag(true); }, onDragOver: e => e.preventDefault(), onDragLeave: () => setDrag(false), onDrop: e => { e.preventDefault(); importFiles(e.dataTransfer.files); }, onClick: () => fileInput.current?.click() },
            React.createElement("input", { ref: fileInput, hidden: true, type: "file", accept: ".zip,.pdf,.json", multiple: true, onChange: e => e.target.files && importFiles(e.target.files) }),
            React.createElement("span", { className: "drop-icon" }, "\u21E7"),
            React.createElement("h3", null, "Arraste os arquivos aqui"),
            React.createElement("p", null, "ou clique para selecionar pacotes ZIP, PDFs ou JSONs"),
            React.createElement("small", null, "Limite de 80 MB por arquivo")),
        React.createElement("div", { className: "import-guidance" },
            React.createElement("div", null,
                React.createElement("strong", null, "1. Receba"),
                React.createElement("span", null, "O funcion\u00E1rio envia o pacote pelo canal definido.")),
            React.createElement("div", null,
                React.createElement("strong", null, "2. Importe"),
                React.createElement("span", null, "O sistema verifica estrutura, revis\u00E3o e duplicidade.")),
            React.createElement("div", null,
                React.createElement("strong", null, "3. Analise"),
                React.createElement("span", null, "Confira o PDF e aprove ou registre ressalva."))),
        importResults.length > 0 && React.createElement("section", { className: "card results" },
            React.createElement("h3", null, "Resultado da importa\u00E7\u00E3o"),
            importResults.map((result, index) => React.createElement("div", { className: `result-row ${result.ok ? "ok" : "fail"}`, key: index },
                React.createElement(StatusBadge, { status: result.status }),
                React.createElement("div", null,
                    React.createElement("strong", null,
                        result.diario_id || `Arquivo ${index + 1}`,
                        result.revisao ? ` · R${result.revisao}` : ""),
                    result.mensagens.map((message, i) => React.createElement("small", { key: i }, message))),
                result.registro_id && React.createElement("button", { className: "btn ghost small", onClick: () => openDetail(result.registro_id) }, "Abrir")))));
    const diariesView = React.createElement("div", { className: "view" },
        React.createElement("div", { className: "view-head" },
            React.createElement("div", null,
                React.createElement("span", { className: "eyebrow" }, "HIST\u00D3RICO E APROVA\u00C7\u00C3O"),
                React.createElement("h2", null, "Di\u00E1rios importados"),
                React.createElement("p", null,
                    diaries.length,
                    " registro(s) conforme os filtros atuais.")),
            React.createElement("button", { className: "btn primary", onClick: () => setTab("importar") }, "Importar arquivos")),
        React.createElement("div", { className: "filters" },
            React.createElement("input", { placeholder: "Buscar ID, obra, equipe ou encarregado", value: filters.query, onChange: e => setFilters({ ...filters, query: e.target.value }) }),
            React.createElement("select", { value: filters.project, onChange: e => setFilters({ ...filters, project: e.target.value }) },
                React.createElement("option", { value: "" }, "Todos os projetos"),
                config?.projetos.map(p => React.createElement("option", { key: p.id, value: p.id },
                    p.id,
                    " \u2014 ",
                    p.nome))),
            React.createElement("select", { value: filters.status, onChange: e => setFilters({ ...filters, status: e.target.value }) },
                React.createElement("option", { value: "" }, "Todos os status"),
                React.createElement("option", { value: "pendente" }, "Pendentes"),
                React.createElement("option", { value: "aprovado" }, "Aprovados"),
                React.createElement("option", { value: "ressalva" }, "Com ressalva"),
                React.createElement("option", { value: "rejeitado" }, "Rejeitados")),
            React.createElement("input", { type: "date", value: filters.date_from, onChange: e => setFilters({ ...filters, date_from: e.target.value }) }),
            React.createElement("input", { type: "date", value: filters.date_to, onChange: e => setFilters({ ...filters, date_to: e.target.value }) })),
        React.createElement("div", { className: "table-card" },
            React.createElement("table", null,
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Data"),
                        React.createElement("th", null, "Di\u00E1rio"),
                        React.createElement("th", null, "Projeto / equipe"),
                        React.createElement("th", null, "Produ\u00E7\u00E3o"),
                        React.createElement("th", null, "Ocorr\u00EAncias"),
                        React.createElement("th", null, "Status"),
                        React.createElement("th", null))),
                React.createElement("tbody", null, diaries.map(item => React.createElement("tr", { key: item.registro_id },
                    React.createElement("td", null,
                        React.createElement("strong", null, fmtDate(item.data)),
                        React.createElement("small", null, fmtDateTime(item.importado_em))),
                    React.createElement("td", null,
                        React.createElement("strong", null, item.diario_id),
                        React.createElement("small", null,
                            "Revis\u00E3o ",
                            item.revisao,
                            " \u00B7 ",
                            item.origem_formato.toUpperCase())),
                    React.createElement("td", null,
                        React.createElement("strong", null, item.projeto_nome),
                        React.createElement("small", null,
                            item.equipe_nome,
                            " \u00B7 ",
                            item.encarregado)),
                    React.createElement("td", null,
                        React.createElement("strong", null,
                            fmt(item.homens_hora),
                            " HH"),
                        React.createElement("small", null,
                            item.atividades_count,
                            " atividade(s) \u00B7 ",
                            fmt(item.quantidade_total),
                            " un. consolidadas")),
                    React.createElement("td", null,
                        React.createElement("strong", { className: item.impedimentos_count ? "danger-text" : "" },
                            item.impedimentos_count,
                            " impedimento(s)"),
                        React.createElement("small", null,
                            fmt(item.horas_perdidas),
                            " h perdidas \u00B7 ",
                            item.fotos_count,
                            " foto(s)")),
                    React.createElement("td", null,
                        React.createElement(StatusBadge, { status: item.status_aprovacao }),
                        item.validacao?.integridade === false && React.createElement("small", { className: "danger-text" }, "Integridade com alerta")),
                    React.createElement("td", null,
                        React.createElement("button", { className: "btn ghost small", onClick: () => openDetail(item.registro_id) }, "Analisar")))))),
            !diaries.length && React.createElement(Empty, { text: "Nenhum di\u00E1rio localizado com estes filtros." })));
    const registrationsView = config && React.createElement("div", { className: "view" },
        React.createElement("div", { className: "view-head" },
            React.createElement("div", null,
                React.createElement("span", { className: "eyebrow" }, "BASE DO APLICATIVO DE CAMPO"),
                React.createElement("h2", null, "Cadastros e configura\u00E7\u00E3o"),
                React.createElement("p", null, "Salve os cadastros e exporte o JSON para distribuir \u00E0s equipes.")),
            React.createElement("div", { className: "head-actions" },
                React.createElement("a", { className: "btn secondary", href: "/api/config/export" }, "Exportar configura\u00E7\u00E3o"),
                React.createElement("button", { className: "btn primary", disabled: loading, onClick: saveConfig }, "Salvar altera\u00E7\u00F5es"))),
        React.createElement("section", { className: "card" },
            React.createElement("h3", null, "Empresa"),
            React.createElement("label", { className: "field-label" },
                "Nome apresentado nos documentos",
                React.createElement("input", { value: config.empresa, onChange: e => setConfig({ ...config, empresa: e.target.value }) }))),
        React.createElement(ConfigSection, { title: "Obras", description: "Projetos dispon\u00EDveis no formul\u00E1rio de campo", onAdd: () => setConfig({ ...config, projetos: [...config.projetos, { id: `OBR-${String(config.projetos.length + 1).padStart(3, "0")}`, nome: "Nova obra", cliente: "", local: "", contrato: "", centro_custo: "", ativo: true }] }) },
            React.createElement("div", { className: "config-grid" }, config.projetos.map((p, index) => React.createElement("div", { className: "config-item", key: `${p.id}-${index}` },
                React.createElement("div", { className: "config-title" },
                    React.createElement("strong", null, p.id),
                    React.createElement("button", { onClick: () => setConfig({ ...config, projetos: config.projetos.filter((_, i) => i !== index) }) }, "Excluir")),
                React.createElement("label", null,
                    "C\u00F3digo",
                    React.createElement("input", { value: p.id, onChange: e => { const arr = [...config.projetos]; arr[index] = { ...p, id: e.target.value }; setConfig({ ...config, projetos: arr }); } })),
                React.createElement("label", null,
                    "Nome",
                    React.createElement("input", { value: p.nome, onChange: e => { const arr = [...config.projetos]; arr[index] = { ...p, nome: e.target.value }; setConfig({ ...config, projetos: arr }); } })),
                React.createElement("label", null,
                    "Cliente",
                    React.createElement("input", { value: p.cliente, onChange: e => { const arr = [...config.projetos]; arr[index] = { ...p, cliente: e.target.value }; setConfig({ ...config, projetos: arr }); } })),
                React.createElement("label", null,
                    "Local",
                    React.createElement("input", { value: p.local, onChange: e => { const arr = [...config.projetos]; arr[index] = { ...p, local: e.target.value }; setConfig({ ...config, projetos: arr }); } })),
                React.createElement("label", null,
                    "Contrato",
                    React.createElement("input", { value: p.contrato, onChange: e => { const arr = [...config.projetos]; arr[index] = { ...p, contrato: e.target.value }; setConfig({ ...config, projetos: arr }); } })),
                React.createElement("label", null,
                    "Centro de custo",
                    React.createElement("input", { value: p.centro_custo, onChange: e => { const arr = [...config.projetos]; arr[index] = { ...p, centro_custo: e.target.value }; setConfig({ ...config, projetos: arr }); } })))))),
        React.createElement(ConfigSection, { title: "Funcion\u00E1rios", description: "Pessoas que podem compor as equipes", onAdd: () => setConfig({ ...config, funcionarios: [...config.funcionarios, { id: `FUN-${String(config.funcionarios.length + 1).padStart(3, "0")}`, nome: "Novo funcionário", funcao: "", ativo: true }] }) },
            React.createElement("div", { className: "simple-table" }, config.funcionarios.map((f, index) => React.createElement("div", { className: "simple-row", key: `${f.id}-${index}` },
                React.createElement("input", { value: f.id, onChange: e => { const arr = [...config.funcionarios]; arr[index] = { ...f, id: e.target.value }; setConfig({ ...config, funcionarios: arr }); } }),
                React.createElement("input", { value: f.nome, onChange: e => { const arr = [...config.funcionarios]; arr[index] = { ...f, nome: e.target.value }; setConfig({ ...config, funcionarios: arr }); } }),
                React.createElement("input", { value: f.funcao, onChange: e => { const arr = [...config.funcionarios]; arr[index] = { ...f, funcao: e.target.value }; setConfig({ ...config, funcionarios: arr }); } }),
                React.createElement("button", { onClick: () => setConfig({ ...config, funcionarios: config.funcionarios.filter((_, i) => i !== index) }) }, "Excluir"))))),
        React.createElement(ConfigSection, { title: "Equipes", description: "Selecione os integrantes que ser\u00E3o pr\u00E9-carregados", onAdd: () => setConfig({ ...config, equipes: [...config.equipes, { id: `EQ-${String(config.equipes.length + 1).padStart(2, "0")}`, nome: "Nova equipe", encarregado: "", membros: [], ativo: true }] }) },
            React.createElement("div", { className: "config-grid" }, config.equipes.map((team, index) => React.createElement("div", { className: "config-item", key: `${team.id}-${index}` },
                React.createElement("div", { className: "config-title" },
                    React.createElement("strong", null, team.id),
                    React.createElement("button", { onClick: () => setConfig({ ...config, equipes: config.equipes.filter((_, i) => i !== index) }) }, "Excluir")),
                React.createElement("label", null,
                    "C\u00F3digo",
                    React.createElement("input", { value: team.id, onChange: e => { const arr = [...config.equipes]; arr[index] = { ...team, id: e.target.value }; setConfig({ ...config, equipes: arr }); } })),
                React.createElement("label", null,
                    "Nome",
                    React.createElement("input", { value: team.nome, onChange: e => { const arr = [...config.equipes]; arr[index] = { ...team, nome: e.target.value }; setConfig({ ...config, equipes: arr }); } })),
                React.createElement("label", null,
                    "Encarregado",
                    React.createElement("input", { value: team.encarregado, onChange: e => { const arr = [...config.equipes]; arr[index] = { ...team, encarregado: e.target.value }; setConfig({ ...config, equipes: arr }); } })),
                React.createElement("div", { className: "member-list" },
                    React.createElement("span", null, "Integrantes"),
                    config.funcionarios.map(worker => React.createElement("label", { key: worker.id },
                        React.createElement("input", { type: "checkbox", checked: team.membros.includes(worker.id), onChange: e => { const members = e.target.checked ? [...team.membros, worker.id] : team.membros.filter((id) => id !== worker.id); const arr = [...config.equipes]; arr[index] = { ...team, membros: members }; setConfig({ ...config, equipes: arr }); } }),
                        worker.nome,
                        " ",
                        React.createElement("small", null, worker.funcao)))))))),
        React.createElement(ConfigSection, { title: "Atividades", description: "Cat\u00E1logo r\u00E1pido de atividades e unidades", onAdd: () => setConfig({ ...config, atividades: [...config.atividades, { codigo: `ATV-${String(config.atividades.length + 1).padStart(3, "0")}`, descricao: "Nova atividade", unidade: "un", projeto_id: "", quantidade_planejada: 0, ativo: true }] }) },
            React.createElement("div", { className: "simple-table activity-table" }, config.atividades.map((a, index) => React.createElement("div", { className: "simple-row", key: `${a.codigo}-${index}` },
                React.createElement("input", { value: a.codigo, onChange: e => { const arr = [...config.atividades]; arr[index] = { ...a, codigo: e.target.value }; setConfig({ ...config, atividades: arr }); } }),
                React.createElement("input", { value: a.descricao, onChange: e => { const arr = [...config.atividades]; arr[index] = { ...a, descricao: e.target.value }; setConfig({ ...config, atividades: arr }); } }),
                React.createElement("select", { value: a.unidade, onChange: e => { const arr = [...config.atividades]; arr[index] = { ...a, unidade: e.target.value }; setConfig({ ...config, atividades: arr }); } }, config.unidades.map(u => React.createElement("option", { key: u }, u))),
                React.createElement("select", { value: a.projeto_id, onChange: e => { const arr = [...config.atividades]; arr[index] = { ...a, projeto_id: e.target.value }; setConfig({ ...config, atividades: arr }); } },
                    React.createElement("option", { value: "" }, "Todas as obras"),
                    config.projetos.map(p => React.createElement("option", { key: p.id, value: p.id }, p.id))),
                React.createElement("input", { type: "number", value: a.quantidade_planejada, onChange: e => { const arr = [...config.atividades]; arr[index] = { ...a, quantidade_planejada: Number(e.target.value) || 0 }; setConfig({ ...config, atividades: arr }); } }),
                React.createElement("button", { onClick: () => setConfig({ ...config, atividades: config.atividades.filter((_, i) => i !== index) }) }, "Excluir"))))),
        React.createElement("section", { className: "card" },
            React.createElement("div", { className: "card-head" },
                React.createElement("div", null,
                    React.createElement("h3", null, "Categorias de impedimento"),
                    React.createElement("p", null, "Op\u00E7\u00F5es apresentadas no celular.")),
                React.createElement("button", { className: "btn secondary small", onClick: () => setConfig({ ...config, categorias_impedimento: [...config.categorias_impedimento, "Nova categoria"] }) }, "Adicionar")),
            React.createElement("div", { className: "chips-edit" }, config.categorias_impedimento.map((c, index) => React.createElement("div", { key: index },
                React.createElement("input", { value: c, onChange: e => { const arr = [...config.categorias_impedimento]; arr[index] = e.target.value; setConfig({ ...config, categorias_impedimento: arr }); } }),
                React.createElement("button", { onClick: () => setConfig({ ...config, categorias_impedimento: config.categorias_impedimento.filter((_, i) => i !== index) }) }, "\u00D7"))))),
        React.createElement("section", { className: "card" },
            React.createElement("div", { className: "card-head" },
                React.createElement("div", null,
                    React.createElement("h3", null, "Ve\u00EDculos"),
                    React.createElement("p", null, "Lista r\u00E1pida para o registro de deslocamento.")),
                React.createElement("button", { className: "btn secondary small", onClick: () => setConfig({ ...config, veiculos: [...(config.veiculos || []), "Novo veículo"] }) }, "Adicionar")),
            React.createElement("div", { className: "chips-edit" }, (config.veiculos || []).map((v, index) => React.createElement("div", { key: index },
                React.createElement("input", { value: v, onChange: e => { const arr = [...(config.veiculos || [])]; arr[index] = e.target.value; setConfig({ ...config, veiculos: arr }); } }),
                React.createElement("button", { onClick: () => setConfig({ ...config, veiculos: (config.veiculos || []).filter((_, i) => i !== index) }) }, "\u00D7"))))));
    const helpView = React.createElement("div", { className: "view" },
        React.createElement("div", { className: "view-head" },
            React.createElement("div", null,
                React.createElement("span", { className: "eyebrow" }, "OPERA\u00C7\u00C3O E DISTRIBUI\u00C7\u00C3O"),
                React.createElement("h2", null, "Implanta\u00E7\u00E3o do fluxo"),
                React.createElement("p", null, "Use esta sequ\u00EAncia para colocar o sistema em opera\u00E7\u00E3o."))),
        React.createElement("div", { className: "help-grid" },
            React.createElement("section", { className: "card numbered" },
                React.createElement("i", null, "1"),
                React.createElement("h3", null, "Cadastre a opera\u00E7\u00E3o"),
                React.createElement("p", null, "Atualize obras, funcion\u00E1rios, equipes e atividades na aba Cadastros."),
                React.createElement("button", { className: "btn secondary", onClick: () => setTab("cadastros") }, "Abrir cadastros")),
            React.createElement("section", { className: "card numbered" },
                React.createElement("i", null, "2"),
                React.createElement("h3", null, "Distribua a configura\u00E7\u00E3o"),
                React.createElement("p", null, "Exporte o arquivo JSON e pe\u00E7a aos encarregados para import\u00E1-lo no aplicativo de campo."),
                React.createElement("a", { className: "btn secondary", href: "/api/config/export" }, "Baixar configura\u00E7\u00E3o")),
            React.createElement("section", { className: "card numbered" },
                React.createElement("i", null, "3"),
                React.createElement("h3", null, "Disponibilize o aplicativo"),
                React.createElement("p", null, "Publique a pasta de campo no Netlify ou abra o endere\u00E7o abaixo na rede local."),
                React.createElement("div", { className: "url-box" },
                    React.createElement("code", null, system ? `${location.protocol}//${system.local_ip}:${location.port}/campo/` : "/campo/"),
                    React.createElement("button", { onClick: () => copy(system ? `${location.protocol}//${system.local_ip}:${location.port}/campo/` : `${location.origin}/campo/`) }, "Copiar")),
                React.createElement("a", { className: "btn ghost", href: "/campo/", target: "_blank" }, "Abrir aplicativo de campo")),
            React.createElement("section", { className: "card numbered" },
                React.createElement("i", null, "4"),
                React.createElement("h3", null, "Defina o canal de envio"),
                React.createElement("p", null,
                    "Oriente a equipe a enviar o arquivo ",
                    React.createElement("strong", null, "Pacote_...zip"),
                    " por e-mail, WhatsApp ou pasta compartilhada.")),
            React.createElement("section", { className: "card numbered" },
                React.createElement("i", null, "5"),
                React.createElement("h3", null, "Importe e aprove"),
                React.createElement("p", null, "Arraste os pacotes na aba Importar. O sistema valida ID, revis\u00E3o, duplicidade e manifesto."),
                React.createElement("button", { className: "btn secondary", onClick: () => setTab("importar") }, "Abrir importa\u00E7\u00E3o")),
            React.createElement("section", { className: "card numbered" },
                React.createElement("i", null, "6"),
                React.createElement("h3", null, "Use a conting\u00EAncia"),
                React.createElement("p", null, "Quando o formul\u00E1rio m\u00F3vel n\u00E3o estiver dispon\u00EDvel, use o PDF preench\u00EDvel e importe o arquivo original salvo."),
                React.createElement("a", { className: "btn secondary", href: "/downloads/Modelo_Diario_Obra_Contingencia.pdf" }, "Baixar PDF preench\u00EDvel")),
            React.createElement("section", { className: "card numbered" },
                React.createElement("i", null, "7"),
                React.createElement("h3", null, "Integra\u00E7\u00E3o Google"),
                React.createElement("p", null, "Para terceirizados ou piloto r\u00E1pido, use o Google Forms + Sheets. O script inclu\u00EDdo gera PDF, JSON e ZIP compat\u00EDveis com esta importa\u00E7\u00E3o."),
                React.createElement("a", { className: "btn secondary", href: "/downloads/Integracao_Google_Forms_Sheets.zip" }, "Baixar integra\u00E7\u00E3o Google"))),
        React.createElement("section", { className: "card operational" },
            React.createElement("h3", null, "Regras operacionais recomendadas"),
            React.createElement("div", null,
                React.createElement("span", null, "Di\u00E1rio finalizado at\u00E9 o encerramento do turno."),
                React.createElement("span", null, "Pacote ZIP como formato oficial de envio."),
                React.createElement("span", null, "Corre\u00E7\u00F5es sempre por nova revis\u00E3o."),
                React.createElement("span", null, "Aprova\u00E7\u00E3o administrativa em at\u00E9 um dia \u00FAtil."),
                React.createElement("span", null, "Backup semanal pelo bot\u00E3o da vis\u00E3o geral."),
                React.createElement("span", null, "PDF de conting\u00EAncia somente quando necess\u00E1rio."))));
    return React.createElement("div", { className: "layout" },
        React.createElement("aside", null,
            React.createElement("div", { className: "brand" },
                React.createElement("span", null, "DO"),
                React.createElement("div", null,
                    React.createElement("strong", null, "Di\u00E1rio de Obra"),
                    React.createElement("small", null,
                        "Gest\u00E3o local v",
                        APP_VERSION))),
            React.createElement("nav", null, nav.map(([id, label, icon]) => React.createElement("button", { key: id, className: tab === id ? "active" : "", onClick: () => setTab(id) },
                React.createElement("i", null, icon),
                React.createElement("span", null, label)))),
            React.createElement("div", { className: "aside-bottom" },
                React.createElement("a", { href: "/campo/", target: "_blank" }, "Abrir modo campo \u2197"),
                React.createElement("small", null,
                    system?.hostname || "Computador local",
                    React.createElement("br", null),
                    "Banco SQLite local"))),
        React.createElement("div", { className: "main-shell" },
            React.createElement("header", null,
                React.createElement("button", { className: "mobile-brand", onClick: () => setTab("dashboard") }, "DO"),
                React.createElement("div", null,
                    React.createElement("strong", null, config?.empresa || "Diário de Obra Suite"),
                    React.createElement("small", null, loading ? "Atualizando dados..." : "Sistema local ativo")),
                React.createElement("div", { className: "header-actions" },
                    React.createElement("button", { title: "Atualizar", onClick: refreshAll }, "\u21BB"),
                    React.createElement("span", { className: "online-dot" }),
                    " ",
                    React.createElement("small", null, "Online local"))),
            React.createElement("main", null,
                tab === "dashboard" && dashboardView,
                tab === "importar" && importView,
                tab === "diarios" && diariesView,
                tab === "cadastros" && registrationsView,
                tab === "ajuda" && helpView)),
        detail && React.createElement(DetailModal, { detail: detail, onClose: () => setDetail(null), onApproval: updateApproval, onDelete: deleteDiary }),
        notice && React.createElement("button", { className: "toast", onClick: () => setNotice("") }, notice));
}
function Kpi({ label, value, hint, icon, warning = false }) {
    return React.createElement("section", { className: `kpi ${warning ? "warning" : ""}` },
        React.createElement("span", null, icon),
        React.createElement("div", null,
            React.createElement("small", null, label),
            React.createElement("strong", null, value),
            React.createElement("em", null, hint)));
}
function Empty({ text }) { return React.createElement("div", { className: "empty" },
    React.createElement("span", null, "\u25CB"),
    React.createElement("p", null, text)); }
function ConfigSection({ title, description, onAdd, children }) {
    return React.createElement("section", { className: "card" },
        React.createElement("div", { className: "card-head" },
            React.createElement("div", null,
                React.createElement("h3", null, title),
                React.createElement("p", null, description)),
            React.createElement("button", { className: "btn secondary small", onClick: onAdd }, "Adicionar")),
        children);
}
function DetailModal({ detail, onClose, onApproval, onDelete }) {
    const data = detail.dados || {};
    return React.createElement("div", { className: "modal-backdrop", onMouseDown: event => { if (event.target === event.currentTarget)
            onClose(); } },
        React.createElement("article", { className: "modal" },
            React.createElement("header", null,
                React.createElement("div", null,
                    React.createElement("span", { className: "eyebrow" }, "AN\u00C1LISE DO DI\u00C1RIO"),
                    React.createElement("h2", null,
                        detail.diario_id,
                        " \u00B7 R",
                        detail.revisao),
                    React.createElement("p", null,
                        detail.projeto_nome,
                        " \u00B7 ",
                        fmtDate(detail.data),
                        " \u00B7 ",
                        detail.equipe_nome)),
                React.createElement("button", { className: "close", onClick: onClose }, "\u00D7")),
            React.createElement("div", { className: "modal-actions" },
                React.createElement(StatusBadge, { status: detail.status_aprovacao }),
                React.createElement("button", { className: "btn approve", onClick: () => onApproval("aprovado") }, "Aprovar"),
                React.createElement("button", { className: "btn caution", onClick: () => onApproval("ressalva") }, "Ressalva"),
                React.createElement("button", { className: "btn reject", onClick: () => onApproval("rejeitado") }, "Rejeitar"),
                detail.possui_pdf && React.createElement("a", { className: "btn secondary", target: "_blank", href: `/api/diarios/${detail.registro_id}/pdf` }, "Abrir PDF")),
            React.createElement("div", { className: "modal-body" },
                React.createElement("section", { className: "detail-summary" },
                    React.createElement("div", null,
                        React.createElement("small", null, "Pessoas"),
                        React.createElement("strong", null, detail.pessoas_count)),
                    React.createElement("div", null,
                        React.createElement("small", null, "Homens-hora"),
                        React.createElement("strong", null,
                            fmt(detail.homens_hora),
                            " h")),
                    React.createElement("div", null,
                        React.createElement("small", null, "Atividades"),
                        React.createElement("strong", null, detail.atividades_count)),
                    React.createElement("div", null,
                        React.createElement("small", null, "Impedimentos"),
                        React.createElement("strong", null, detail.impedimentos_count)),
                    React.createElement("div", null,
                        React.createElement("small", null, "Horas perdidas"),
                        React.createElement("strong", null,
                            fmt(detail.horas_perdidas),
                            " h")),
                    React.createElement("div", null,
                        React.createElement("small", null, "Fotos"),
                        React.createElement("strong", null, detail.fotos_count)),
                    React.createElement("div", null,
                        React.createElement("small", null, "Despesas"),
                        React.createElement("strong", null,
                            "R$ ",
                            fmt(detail.total_despesas, 2))),
                    React.createElement("div", null,
                        React.createElement("small", null, "Km rodado"),
                        React.createElement("strong", null,
                            fmt(detail.km_rodado),
                            " km"))),
                React.createElement("section", { className: "detail-section" },
                    React.createElement("h3", null, "Identifica\u00E7\u00E3o"),
                    React.createElement("dl", null,
                        React.createElement("dt", null, "Cliente"),
                        React.createElement("dd", null, detail.cliente || "-"),
                        React.createElement("dt", null, "Encarregado"),
                        React.createElement("dd", null, detail.encarregado),
                        React.createElement("dt", null, "Turno"),
                        React.createElement("dd", null,
                            data.turno_inicio,
                            " \u00E0s ",
                            data.turno_fim,
                            " \u00B7 intervalo ",
                            fmt(data.intervalo_minutos || 0, 0),
                            " min"),
                        React.createElement("dt", null, "Local"),
                        React.createElement("dd", null, data.projeto?.local || "-"),
                        React.createElement("dt", null, "Contrato"),
                        React.createElement("dd", null, data.projeto?.contrato || "-"),
                        React.createElement("dt", null, "Centro de custo"),
                        React.createElement("dd", null, data.projeto?.centro_custo || "-"))),
                React.createElement("section", { className: "detail-section" },
                    React.createElement("h3", null, "Equipe presente"),
                    React.createElement("div", { className: "detail-list" }, (data.equipe_presente || []).filter((p) => p.presente).map((p) => React.createElement("div", { key: p.funcionario_id || p.nome },
                        React.createElement("strong", null, p.nome),
                        React.createElement("span", null,
                            p.funcao,
                            " \u00B7 ",
                            fmt((p.horas_normais || 0) + (p.horas_extras || 0)),
                            " h"))))),
                React.createElement("section", { className: "detail-section" },
                    React.createElement("h3", null, "Atividades"),
                    React.createElement("div", { className: "detail-list" }, (data.atividades || []).map((a, index) => React.createElement("div", { key: a.id || index },
                        React.createElement("strong", null,
                            a.codigo ? `${a.codigo} — ` : "",
                            a.descricao),
                        React.createElement("span", null,
                            a.local || "Sem local",
                            " \u00B7 ",
                            fmt(a.quantidade),
                            " ",
                            a.unidade,
                            " \u00B7 ",
                            fmt(a.percentual_conclusao, 0),
                            "%"),
                        React.createElement("small", null, a.observacao)))),
                    !(data.atividades || []).length && React.createElement("p", null, "Sem atividades.")),
                React.createElement("section", { className: "detail-section" },
                    React.createElement("h3", null, "Despesas e deslocamento"),
                    React.createElement("dl", null,
                        React.createElement("dt", null, "Alimenta\u00E7\u00E3o"),
                        React.createElement("dd", null,
                            "R$ ",
                            fmt(((data.despesas?.cafe_manha?.quantidade || 0) * (data.despesas?.cafe_manha?.valor_unitario || 0)) + ((data.despesas?.almoco?.quantidade || 0) * (data.despesas?.almoco?.valor_unitario || 0)) + ((data.despesas?.cafe_tarde?.quantidade || 0) * (data.despesas?.cafe_tarde?.valor_unitario || 0)) + ((data.despesas?.jantar?.quantidade || 0) * (data.despesas?.jantar?.valor_unitario || 0)), 2)),
                        React.createElement("dt", null, "Abastecimento"),
                        React.createElement("dd", null,
                            "R$ ",
                            fmt(data.despesas?.abastecimento || 0, 2)),
                        React.createElement("dt", null, "Despesas extras"),
                        React.createElement("dd", null,
                            "R$ ",
                            fmt((data.despesas?.extras || []).reduce((sum, item) => sum + (item.valor || 0), 0), 2)),
                        React.createElement("dt", null, "Total do dia"),
                        React.createElement("dd", null,
                            React.createElement("strong", null,
                                "R$ ",
                                fmt(detail.total_despesas, 2))),
                        React.createElement("dt", null, "Ve\u00EDculo"),
                        React.createElement("dd", null,
                            data.deslocamento?.veiculo || "-",
                            " ",
                            data.deslocamento?.placa ? `· ${data.deslocamento.placa}` : ""),
                        React.createElement("dt", null, "Quilometragem"),
                        React.createElement("dd", null,
                            fmt(data.deslocamento?.km_inicial || 0),
                            " \u2192 ",
                            fmt(data.deslocamento?.km_final || 0),
                            " km \u00B7 ",
                            React.createElement("strong", null,
                                fmt(detail.km_rodado),
                                " km rodados"))),
                    (data.despesas?.extras || []).length > 0 && React.createElement("div", { className: "detail-list" }, data.despesas.extras.map((item, index) => React.createElement("div", { key: item.id || index },
                        React.createElement("strong", null, item.descricao || `Despesa extra ${index + 1}`),
                        React.createElement("span", null,
                            "R$ ",
                            fmt(item.valor || 0, 2)))))),
                React.createElement("section", { className: "detail-section" },
                    React.createElement("h3", null, "Seguran\u00E7a"),
                    React.createElement("div", { className: "safety-tags" }, Object.entries({ "DDS": data.seguranca?.dds_realizado, "APR": data.seguranca?.apr_disponivel, "EPI": data.seguranca?.epis_conformes, "Isolamento": data.seguranca?.isolamento_area, "PT": data.seguranca?.permissao_trabalho }).map(([label, value]) => React.createElement("span", { className: value ? "yes" : "no", key: label },
                        label,
                        ": ",
                        value ? "SIM" : "NÃO"))),
                    data.seguranca?.houve_ocorrencia && React.createElement("div", { className: "alert-box" },
                        React.createElement("strong", null, "Ocorr\u00EAncia de seguran\u00E7a"),
                        React.createElement("p", null, data.seguranca.descricao_ocorrencia))),
                React.createElement("section", { className: "detail-section" },
                    React.createElement("h3", null, "Impedimentos"),
                    React.createElement("div", { className: "detail-list" }, (data.impedimentos || []).map((i, index) => React.createElement("div", { key: i.id || index },
                        React.createElement("strong", null,
                            i.categoria,
                            " \u00B7 ",
                            i.impacto),
                        React.createElement("span", null,
                            fmt(i.horas_perdidas),
                            " h perdidas \u00B7 ",
                            i.responsavel || "Sem responsável"),
                        React.createElement("small", null,
                            i.descricao,
                            " ",
                            i.acao_necessaria ? `— Ação: ${i.acao_necessaria}` : "")))),
                    !(data.impedimentos || []).length && React.createElement("p", null, "Sem impedimentos registrados.")),
                React.createElement("section", { className: "detail-section" },
                    React.createElement("h3", null, "Valida\u00E7\u00E3o da importa\u00E7\u00E3o"),
                    React.createElement("div", { className: "validation-box" },
                        React.createElement("span", { className: detail.validacao?.integridade === false ? "fail" : "ok" }, detail.validacao?.integridade === false ? "!" : "✓"),
                        React.createElement("div", null, (detail.validacao?.mensagens || ["Importação sem alertas."]).map((m, i) => React.createElement("p", { key: i }, m))))),
                detail.observacao_aprovacao && React.createElement("section", { className: "detail-section" },
                    React.createElement("h3", null, "Observa\u00E7\u00E3o da an\u00E1lise"),
                    React.createElement("p", null, detail.observacao_aprovacao))),
            React.createElement("footer", null,
                React.createElement("button", { className: "btn delete", onClick: onDelete }, "Excluir registro"),
                React.createElement("button", { className: "btn ghost", onClick: onClose }, "Fechar"))));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));
