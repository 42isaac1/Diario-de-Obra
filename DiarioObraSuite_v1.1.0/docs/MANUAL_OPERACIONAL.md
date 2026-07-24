# Manual operacional - Diário de Obra Suite v1.1.0

## 1. Preparação no computador

Execute `INSTALAR_E_INICIAR.bat` na primeira utilização. Nas próximas, use `INICIAR.bat`. O programa procura uma porta livre entre 8765 e 8795 e abre o Gestor no navegador. Mantenha a janela do terminal aberta.

### Cadastros iniciais

Cadastre nesta ordem:

1. obras e contratos;
2. funcionários;
3. equipes e encarregados;
4. atividades e unidades;
5. veículos;
6. categorias de impedimento.

Use códigos estáveis, por exemplo `OBR-023`, `EQ-02`, `FUN-014` e `ATV-034`. Esses códigos relacionam o diário aos cadastros e evitam registros ambíguos.

Depois de salvar, exporte `configuracao_campo.json` e distribua-o aos encarregados.

## 2. Aplicativo de Campo - método principal

Publique a pasta criada por `PREPARAR_CAMPO_NETLIFY.bat` em HTTPS. No celular, abra o endereço e use a opção do navegador para instalar o aplicativo.

### Sequência de preenchimento

1. **Identificação:** obra, equipe, data, turno, intervalo e clima.
2. **Equipe:** presentes, funções, horas normais e extras.
3. **Atividades:** serviço, local, quantidade, unidade, percentual e observação.
4. **Recursos:** materiais e equipamentos que afetem o acompanhamento.
5. **Despesas:** refeições, extras e abastecimento.
6. **Deslocamento:** veículo, placa, KM inicial e final.
7. **Segurança:** DDS, APR, EPI, isolamento, permissão e ocorrência.
8. **Impedimentos:** categoria, impacto, duração, responsável e ação.
9. **Fotos:** legenda e vínculo com atividade ou ocorrência.
10. **Encerramento:** observações, assinatura e geração do pacote.

O rascunho é salvo automaticamente. Ao repetir o diário anterior, as despesas do novo dia são zeradas e o KM final anterior é sugerido como KM inicial.

### Envio

Envie o arquivo `Pacote_...zip`. Não extraia nem altere seus arquivos internos. O ZIP contém o PDF para leitura, o JSON para atualização automática, as fotos e o manifesto de integridade.

## 3. Importação no Gestor

Abra a aba **Importar** e selecione um ou vários arquivos.

Estados possíveis:

- **Importado:** aceito sem advertência relevante;
- **Importado com ressalva:** aceito, mas exige conferência;
- **Duplicado:** o mesmo conteúdo já foi recebido;
- **Conflito:** mesmo ID e revisão com conteúdo diferente;
- **Rejeitado:** estrutura, validação, segurança ou integridade inválida.

Em caso de correção, gere uma nova revisão. Não sobrescreva a revisão anterior.

### Aprovação

Abra o diário, confira:

- obra, data e equipe;
- PDF e dados estruturados;
- horas e efetivo;
- atividades e quantidades;
- despesas e KM;
- impedimentos, segurança e fotos.

Depois marque como aprovado, aprovado com ressalva ou rejeitado. Registre a justificativa nos dois últimos casos.

## 4. PDF de contingência

Quando a PWA não puder ser usada, preencha o PDF disponível em:

`app/static/downloads/Modelo_Diario_Obra_Contingencia.pdf`

Campos mínimos:

- código e nome da obra;
- data;
- código e nome da equipe;
- encarregado.

Preencha também despesas, KM, atividades e equipe sempre que aplicável. Salve o PDF original, mantendo os campos editáveis. Não imprima em PDF e não achate o formulário.

## 5. Google Forms + Sheets

Use esta alternativa para piloto rápido, temporários ou terceirizados com internet.

1. Baixe `Integracao_Google_Forms_Sheets.zip` na aba de implantação do Gestor.
2. Abra o arquivo `README_GOOGLE_FORMS.md`.
3. Crie um projeto no Google Apps Script.
4. Cole `DiarioObraGoogle.gs` e execute `criarEstruturaDiarioObra()`.
5. Autorize o acesso ao Forms, Sheets, Docs, Drive e gatilhos.
6. Envie o formulário criado às equipes.
7. Baixe o ZIP gerado no Drive e importe-o no Gestor.

O Google Forms não é o fluxo offline. Para locais com sinal instável, use a PWA.

## 6. Indicadores e consolidação

O Gestor calcula automaticamente:

- quantidade de diários;
- pessoas e homens-hora;
- atividades e produção;
- impedimentos e horas perdidas;
- despesas totais;
- quilometragem percorrida;
- fotografias e situação de aprovação.

O total semanal deve ser obtido pelo Gestor; não precisa ser digitado no diário diário.

## 7. Rotina de gestão

- diariamente: importar, conferir e aprovar;
- semanalmente: analisar horas perdidas, despesas, KM e pendências;
- semanalmente: gerar backup completo;
- após alteração cadastral: exportar nova configuração para o campo;
- mensalmente: arquivar relatórios, PDFs e backup em local protegido.

## 8. Primeiro teste recomendado

Use `docs/exemplos/Pacote_Diario_Exemplo.zip`:

1. importe o pacote;
2. confira o diário e o PDF;
3. valide os indicadores de despesas e KM;
4. aprove ou rejeite o registro;
5. gere CSV e backup;
6. depois faça um diário real com uma única equipe.
