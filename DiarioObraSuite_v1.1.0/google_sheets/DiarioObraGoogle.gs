/**
 * DIÁRIO DE OBRA - GOOGLE FORMS + SHEETS
 * Compatível com o Gestor de Diário de Obras v1.1.0.
 *
 * 1. Crie um projeto em script.google.com.
 * 2. Cole este arquivo.
 * 3. Execute criarEstruturaDiarioObra() e autorize.
 * 4. Abra os links exibidos no registro de execução.
 */

const VERSAO_SCHEMA = '1.1';
const VERSAO_SCRIPT = '1.1.0-google';

function criarEstruturaDiarioObra() {
  const props = PropertiesService.getScriptProperties();
  const pasta = DriveApp.createFolder('Diários de Obra - Pacotes Gerados');
  const planilha = SpreadsheetApp.create('Diário de Obra - Respostas e Pacotes');
  const formulario = FormApp.create('Diário de Obra - Preenchimento de Campo');

  formulario.setDescription('Preencha ao final do turno. O sistema gera automaticamente PDF, JSON e pacote ZIP compatível com o Gestor de Diário de Obras.');
  formulario.setConfirmationMessage('Diário recebido. O pacote será gerado automaticamente no Google Drive.');
  formulario.setCollectEmail(false);
  formulario.setDestination(FormApp.DestinationType.SPREADSHEET, planilha.getId());

  formulario.addSectionHeaderItem().setTitle('Identificação da obra');
  adicionarTexto(formulario, 'Código da obra', true);
  adicionarTexto(formulario, 'Nome da obra', true);
  adicionarTexto(formulario, 'Cliente', true);
  adicionarTexto(formulario, 'Endereço / local', true);
  adicionarTexto(formulario, 'Contrato', false);
  adicionarTexto(formulario, 'Centro de custo', false);
  adicionarData(formulario, 'Data do diário', true);
  adicionarTexto(formulario, 'Código da equipe', true);
  adicionarTexto(formulario, 'Nome da equipe', true);
  adicionarTexto(formulario, 'Encarregado', true);
  adicionarTexto(formulario, 'Horário de início (HH:MM)', true);
  adicionarTexto(formulario, 'Horário de saída (HH:MM)', true);
  adicionarNumero(formulario, 'Intervalo em minutos', false);
  adicionarTexto(formulario, 'Clima / condição do tempo', false);

  formulario.addSectionHeaderItem().setTitle('Equipe do dia');
  adicionarParagrafo(formulario, 'Nomes dos eletricistas (separados por vírgula)', false);
  adicionarParagrafo(formulario, 'Nomes dos ajudantes (separados por vírgula)', false);
  adicionarNumero(formulario, 'Horas normais por profissional', true);
  adicionarNumero(formulario, 'Horas extras por profissional', false);

  formulario.addSectionHeaderItem().setTitle('Atividades executadas');
  for (let i = 1; i <= 3; i++) {
    adicionarTexto(formulario, `Atividade ${i} - código`, false);
    adicionarParagrafo(formulario, `Atividade ${i} - descrição`, i === 1);
    adicionarTexto(formulario, `Atividade ${i} - local / frente`, false);
    adicionarNumero(formulario, `Atividade ${i} - quantidade`, false);
    adicionarTexto(formulario, `Atividade ${i} - unidade`, false);
    adicionarNumero(formulario, `Atividade ${i} - percentual de conclusão`, false);
    adicionarParagrafo(formulario, `Atividade ${i} - observação`, false);
  }

  formulario.addSectionHeaderItem().setTitle('Despesas e deslocamento');
  ['Café da manhã', 'Almoço', 'Café da tarde', 'Jantar'].forEach(nome => {
    adicionarNumero(formulario, `${nome} - quantidade`, false);
    adicionarNumero(formulario, `${nome} - valor unitário`, false);
  });
  adicionarParagrafo(formulario, 'Despesa extra - descrição', false);
  adicionarNumero(formulario, 'Despesa extra - valor', false);
  adicionarNumero(formulario, 'Abastecimento - valor', false);
  adicionarTexto(formulario, 'Veículo', false);
  adicionarTexto(formulario, 'Placa', false);
  adicionarNumero(formulario, 'KM inicial', false);
  adicionarNumero(formulario, 'KM final', false);

  formulario.addSectionHeaderItem().setTitle('Segurança e impedimentos');
  ['DDS realizado', 'APR disponível', 'EPI em conformidade', 'Área isolada', 'Permissão de trabalho', 'Houve ocorrência / quase acidente']
    .forEach(titulo => adicionarSimNao(formulario, titulo, titulo !== 'Houve ocorrência / quase acidente'));
  adicionarParagrafo(formulario, 'Descrição da ocorrência de segurança', false);
  adicionarTexto(formulario, 'Categoria do impedimento', false);
  adicionarParagrafo(formulario, 'Descrição do impedimento', false);
  adicionarNumero(formulario, 'Horas perdidas', false);
  adicionarTexto(formulario, 'Responsável pela solução', false);
  adicionarParagrafo(formulario, 'Ação necessária', false);

  formulario.addSectionHeaderItem().setTitle('Encerramento');
  adicionarParagrafo(formulario, 'Observações gerais', false);
  adicionarTexto(formulario, 'Link da pasta ou das fotos (opcional)', false);
  adicionarTexto(formulario, 'Responsável do cliente (opcional)', false);
  adicionarSimNao(formulario, 'Confirmo que as informações foram conferidas', true);

  const folhaPacotes = planilha.insertSheet('PACOTES_GERADOS');
  folhaPacotes.getRange(1, 1, 1, 8).setValues([['Data/hora', 'ID do diário', 'Revisão', 'Obra', 'Responsável', 'PDF', 'JSON', 'ZIP']]);
  folhaPacotes.setFrozenRows(1);

  props.setProperties({
    FORM_ID: formulario.getId(),
    SPREADSHEET_ID: planilha.getId(),
    FOLDER_ID: pasta.getId(),
  });

  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'aoEnviarDiario').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('aoEnviarDiario').forForm(formulario).onFormSubmit().create();

  console.log('FORMULÁRIO (editar): ' + formulario.getEditUrl());
  console.log('FORMULÁRIO (responder): ' + formulario.getPublishedUrl());
  console.log('PLANILHA: ' + planilha.getUrl());
  console.log('PASTA DE PACOTES: ' + pasta.getUrl());
}

function aoEnviarDiario(e) {
  if (!e || !e.response) throw new Error('Esta função deve ser executada pelo gatilho de envio do Google Forms.');
  const mapa = {};
  e.response.getItemResponses().forEach(r => mapa[r.getItem().getTitle()] = r.getResponse());

  const data = normalizarData(mapa['Data do diário']);
  const projetoId = texto(mapa['Código da obra']) || 'OBRA';
  const equipeId = texto(mapa['Código da equipe']) || 'EQUIPE';
  const diarioId = `DO-${data.replace(/-/g, '')}-${sanearId(projetoId)}-${sanearId(equipeId)}`;
  const responsavel = texto(mapa['Encarregado']);
  const horasNormais = numero(mapa['Horas normais por profissional']);
  const horasExtras = numero(mapa['Horas extras por profissional']);

  const pessoas = [{ funcionario_id: 'ENC-01', nome: responsavel, funcao: 'Encarregado', presente: true, horas_normais: horasNormais, horas_extras: horasExtras, observacao: '' }];
  adicionarPessoas(pessoas, texto(mapa['Nomes dos eletricistas (separados por vírgula)']), 'Eletricista', horasNormais, horasExtras, 'ELE');
  adicionarPessoas(pessoas, texto(mapa['Nomes dos ajudantes (separados por vírgula)']), 'Ajudante de eletricista', horasNormais, horasExtras, 'AJU');

  const atividades = [];
  for (let i = 1; i <= 3; i++) {
    const descricao = texto(mapa[`Atividade ${i} - descrição`]);
    if (!descricao) continue;
    atividades.push({
      id: `GOOGLE-ATV-${i}`,
      codigo: texto(mapa[`Atividade ${i} - código`]),
      descricao,
      local: texto(mapa[`Atividade ${i} - local / frente`]),
      quantidade: numero(mapa[`Atividade ${i} - quantidade`]),
      unidade: texto(mapa[`Atividade ${i} - unidade`]) || 'un',
      percentual_conclusao: Math.max(0, Math.min(100, numero(mapa[`Atividade ${i} - percentual de conclusão`]))),
      observacao: texto(mapa[`Atividade ${i} - observação`]),
    });
  }

  const impedimentos = [];
  const categoriaImp = texto(mapa['Categoria do impedimento']);
  if (categoriaImp) impedimentos.push({
    id: 'GOOGLE-IMP-1', categoria: categoriaImp, descricao: texto(mapa['Descrição do impedimento']), impacto: 'parcial',
    inicio: '', fim: '', horas_perdidas: numero(mapa['Horas perdidas']), responsavel: texto(mapa['Responsável pela solução']),
    acao_necessaria: texto(mapa['Ação necessária']), prazo: '', status: 'aberto'
  });

  const linkFotos = texto(mapa['Link da pasta ou das fotos (opcional)']);
  const observacoes = [texto(mapa['Observações gerais']), linkFotos ? `Fotos/evidências: ${linkFotos}` : ''].filter(Boolean).join('\n');
  const agora = new Date().toISOString();
  const payload = {
    schema_version: VERSAO_SCHEMA,
    app_version: VERSAO_SCRIPT,
    diario_id: diarioId,
    revisao: 1,
    projeto: { id: projetoId, nome: texto(mapa['Nome da obra']), cliente: texto(mapa['Cliente']), local: texto(mapa['Endereço / local']), contrato: texto(mapa['Contrato']), centro_custo: texto(mapa['Centro de custo']) },
    data,
    equipe: { id: equipeId, nome: texto(mapa['Nome da equipe']) },
    encarregado: responsavel,
    turno_inicio: texto(mapa['Horário de início (HH:MM)']) || '07:00',
    turno_fim: texto(mapa['Horário de saída (HH:MM)']) || '17:00',
    intervalo_minutos: numero(mapa['Intervalo em minutos']) || 60,
    clima: texto(mapa['Clima / condição do tempo']),
    equipe_presente: pessoas,
    atividades,
    materiais: [],
    equipamentos: [],
    despesas: {
      cafe_manha: refeicao(mapa, 'Café da manhã'),
      almoco: refeicao(mapa, 'Almoço'),
      cafe_tarde: refeicao(mapa, 'Café da tarde'),
      jantar: refeicao(mapa, 'Jantar'),
      extras: texto(mapa['Despesa extra - descrição']) || numero(mapa['Despesa extra - valor']) ? [{ id: 'GOOGLE-DESP-1', descricao: texto(mapa['Despesa extra - descrição']), valor: numero(mapa['Despesa extra - valor']) }] : [],
      abastecimento: numero(mapa['Abastecimento - valor']),
      observacao: ''
    },
    deslocamento: { veiculo: texto(mapa['Veículo']), placa: texto(mapa['Placa']).toUpperCase(), km_inicial: numero(mapa['KM inicial']), km_final: numero(mapa['KM final']), observacao: '' },
    seguranca: {
      dds_realizado: sim(mapa['DDS realizado']), apr_disponivel: sim(mapa['APR disponível']), epis_conformes: sim(mapa['EPI em conformidade']),
      isolamento_area: sim(mapa['Área isolada']), permissao_trabalho: sim(mapa['Permissão de trabalho']),
      houve_ocorrencia: sim(mapa['Houve ocorrência / quase acidente']), descricao_ocorrencia: texto(mapa['Descrição da ocorrência de segurança'])
    },
    impedimentos,
    fotos: [],
    assinatura_encarregado: { nome: responsavel, funcao: 'Encarregado', data_hora: agora },
    assinatura_fiscal: texto(mapa['Responsável do cliente (opcional)']) ? { nome: texto(mapa['Responsável do cliente (opcional)']), funcao: 'Responsável do cliente', data_hora: agora } : null,
    observacoes_gerais: observacoes,
    status: 'finalizado',
    finalizado_em: agora,
    origem: 'google_forms'
  };

  gerarArquivos(payload);
}

function gerarArquivos(payload) {
  const props = PropertiesService.getScriptProperties();
  const pasta = DriveApp.getFolderById(props.getProperty('FOLDER_ID'));
  const base = `${payload.diario_id}_R${payload.revisao}`;
  const jsonTexto = JSON.stringify(payload, null, 2);
  const jsonBlob = Utilities.newBlob(jsonTexto, MimeType.PLAIN_TEXT, 'diario_obra.json');

  const doc = DocumentApp.create(`Diário_${base}`);
  const body = doc.getBody();
  body.appendParagraph('DIÁRIO DE OBRA').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(`${payload.diario_id} · Revisão ${payload.revisao}`);
  body.appendTable([
    ['Cliente', payload.projeto.cliente || '-'], ['Obra', `${payload.projeto.id} - ${payload.projeto.nome}`], ['Local', payload.projeto.local || '-'],
    ['Data', payload.data], ['Equipe', `${payload.equipe.id} - ${payload.equipe.nome}`], ['Encarregado', payload.encarregado],
    ['Turno', `${payload.turno_inicio} às ${payload.turno_fim} · intervalo ${payload.intervalo_minutos} min`]
  ]);
  body.appendParagraph('SERVIÇOS EXECUTADOS').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  payload.atividades.forEach((a, i) => body.appendParagraph(`${i + 1}. ${a.codigo ? a.codigo + ' - ' : ''}${a.descricao}\nLocal: ${a.local || '-'} | Executado: ${a.quantidade} ${a.unidade} | Conclusão: ${a.percentual_conclusao}%${a.observacao ? '\n' + a.observacao : ''}`));
  if (!payload.atividades.length) body.appendParagraph('Nenhuma atividade registrada.');
  body.appendParagraph('EQUIPE').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  payload.equipe_presente.forEach(p => body.appendParagraph(`${p.nome} - ${p.funcao} - ${p.horas_normais + p.horas_extras} h`));
  body.appendParagraph('DESPESAS E DESLOCAMENTO').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(`Total de despesas: R$ ${totalDespesas(payload.despesas).toFixed(2)}\nVeículo: ${payload.deslocamento.veiculo || '-'} ${payload.deslocamento.placa || ''}\nKM: ${payload.deslocamento.km_inicial} → ${payload.deslocamento.km_final} (${Math.max(0, payload.deslocamento.km_final - payload.deslocamento.km_inicial)} km)`);
  body.appendParagraph('SEGURANÇA E IMPEDIMENTOS').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(`DDS: ${payload.seguranca.dds_realizado ? 'SIM' : 'NÃO'} | APR: ${payload.seguranca.apr_disponivel ? 'SIM' : 'NÃO'} | EPI: ${payload.seguranca.epis_conformes ? 'SIM' : 'NÃO'} | Ocorrência: ${payload.seguranca.houve_ocorrencia ? 'SIM' : 'NÃO'}`);
  payload.impedimentos.forEach(i => body.appendParagraph(`${i.categoria}: ${i.descricao || '-'} | ${i.horas_perdidas} h perdidas | Ação: ${i.acao_necessaria || '-'}`));
  body.appendParagraph('OBSERVAÇÕES E RESPONSÁVEIS').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(payload.observacoes_gerais || 'Sem observações.');
  body.appendParagraph(`Responsável da equipe: ${payload.assinatura_encarregado.nome}\nResponsável do cliente: ${payload.assinatura_fiscal ? payload.assinatura_fiscal.nome : '-'}`);
  doc.saveAndClose();

  const docFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = docFile.getAs(MimeType.PDF).setName('diario_obra.pdf');
  docFile.setTrashed(true);
  const manifest = {
    package_version: '1.1', app_version: VERSAO_SCRIPT, diario_id: payload.diario_id, revisao: payload.revisao,
    generated_at: new Date().toISOString(), files: ['diario_obra.json', 'diario_obra.pdf'],
    hashes: { diario_json: sha256(jsonBlob.getBytes()), diario_pdf: sha256(pdfBlob.getBytes()) }
  };
  const manifestBlob = Utilities.newBlob(JSON.stringify(manifest, null, 2), MimeType.PLAIN_TEXT, 'manifest.json');
  const zipBlob = Utilities.zip([jsonBlob, pdfBlob, manifestBlob], `Pacote_${base}.zip`);

  const pdfFile = pasta.createFile(pdfBlob.copyBlob().setName(`Diario_${base}.pdf`));
  const jsonFile = pasta.createFile(jsonBlob.copyBlob().setName(`Diario_${base}.json`));
  const zipFile = pasta.createFile(zipBlob);

  const planilha = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
  const folha = planilha.getSheetByName('PACOTES_GERADOS') || planilha.insertSheet('PACOTES_GERADOS');
  folha.appendRow([new Date(), payload.diario_id, payload.revisao, payload.projeto.nome, payload.encarregado, pdfFile.getUrl(), jsonFile.getUrl(), zipFile.getUrl()]);

  const email = props.getProperty('EMAIL_DESTINO');
  if (email) MailApp.sendEmail({ to: email, subject: `Diário de obra ${payload.diario_id}`, body: `Pacote gerado: ${zipFile.getUrl()}`, attachments: [zipBlob] });
}

function configurarEmailDestino(email) {
  PropertiesService.getScriptProperties().setProperty('EMAIL_DESTINO', String(email || '').trim());
}

function adicionarTexto(form, titulo, obrigatorio) { form.addTextItem().setTitle(titulo).setRequired(obrigatorio); }
function adicionarParagrafo(form, titulo, obrigatorio) { form.addParagraphTextItem().setTitle(titulo).setRequired(obrigatorio); }
function adicionarNumero(form, titulo, obrigatorio) {
  form.addTextItem().setTitle(titulo).setRequired(obrigatorio).setValidation(FormApp.createTextValidation().requireNumberGreaterThanOrEqualTo(0).build());
}
function adicionarData(form, titulo, obrigatorio) { form.addDateItem().setTitle(titulo).setRequired(obrigatorio); }
function adicionarSimNao(form, titulo, obrigatorio) { form.addMultipleChoiceItem().setTitle(titulo).setChoiceValues(['SIM', 'NÃO']).setRequired(obrigatorio); }
function texto(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function numero(v) {
  let t = texto(v).replace(/\s/g, '');
  if (!t) return 0;
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  const n = Number(t);
  return isFinite(n) ? n : 0;
}
function sim(v) { return ['sim', 'true', '1', 'yes'].indexOf(texto(v).toLowerCase()) >= 0; }
function sanearId(v) { return texto(v).replace(/[^A-Za-z0-9_-]/g, '_'); }
function normalizarData(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const t = texto(v); if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function adicionarPessoas(lista, nomes, funcao, normais, extras, prefixo) {
  texto(nomes).split(',').map(n => n.trim()).filter(Boolean).forEach((nome, i) => lista.push({ funcionario_id: `${prefixo}-${i + 1}`, nome, funcao, presente: true, horas_normais: normais, horas_extras: extras, observacao: '' }));
}
function refeicao(mapa, nome) { return { quantidade: numero(mapa[`${nome} - quantidade`]), valor_unitario: numero(mapa[`${nome} - valor unitário`]) }; }
function totalDespesas(d) {
  return ['cafe_manha','almoco','cafe_tarde','jantar'].reduce((s,k) => s + d[k].quantidade * d[k].valor_unitario, 0) + d.abastecimento + d.extras.reduce((s,i) => s + i.valor, 0);
}
function sha256(bytes) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join(''); }
