# Relatório de validação - Diário de Obra Suite v1.1.0

Data: 23/07/2026

## Resultado geral

A versão foi aprovada nos testes automatizados, na validação da API, na geração/importação dos documentos e na inspeção visual dos PDFs.

## Escopo executado

| Área | Verificação | Resultado |
|---|---|---|
| Python | Compilação dos módulos de backend, scripts e testes | Aprovado |
| Modelos | Schema 1.1, normalização e limites de percentual | Aprovado |
| Banco | Criação SQLite e migração das colunas de despesas/KM | Aprovado |
| PDF | Geração do AcroForm com 4 páginas e 189 campos | Aprovado |
| PDF | Extração de equipe, atividade, despesa, KM e impedimento | Aprovado |
| PDF visual | Renderização das 4 páginas sem corte ou sobreposição | Aprovado |
| PDF visual | Comparação entre PDFium e Poppler | Aprovado com diferenças pequenas de antialiasing |
| Pacote | Importação de ZIP com JSON, PDF, manifesto e fotografia | Aprovado |
| Integridade | Confirmação dos hashes SHA-256 do JSON e PDF | Aprovado |
| Segurança | Rejeição de manifesto adulterado | Aprovado |
| Segurança | Rejeição de caminho ZIP inseguro | Aprovado |
| Controle | Duplicidade, conflito de revisão e nova revisão | Aprovado |
| Indicadores | Pessoas, homens-hora, produção, impedimentos e horas perdidas | Aprovado |
| Indicadores | Despesas totais e quilometragem percorrida | Aprovado |
| API | Saúde, sistema, configuração, importação e dashboard | Aprovado |
| Exportação | CSV consolidado com despesas e KM | Aprovado |
| Backup | ZIP com banco, PDF, pacote, anexo e configuração | Aprovado |
| Frontend | Compilação TypeScript realizada e sintaxe JS validada pelo Node.js | Aprovado |
| Google | Sintaxe do Apps Script e integridade do pacote de integração | Aprovado |
| Planilha | Estrutura XLSX, títulos, validações e ausência de erros de fórmula | Aprovado |

## Testes automatizados

Foram executados 6 testes unitários/de integração:

1. configuração padrão válida;
2. validação e normalização do diário;
3. geração, preenchimento e extração do PDF;
4. importação, métricas, duplicidade, conflito e revisão;
5. rejeição de adulteração no manifesto;
6. rejeição de pacote com caminho interno inseguro.

Resultado: **6 de 6 aprovados**.

## Teste completo da API

Em uma base temporária isolada foi importado `Pacote_Diario_Exemplo.zip`. O sistema retornou:

- HTTP 200 na importação;
- integridade do JSON e do PDF confirmada;
- 1 diário;
- 27 homens-hora;
- 2 atividades;
- 1 impedimento;
- 1,5 hora perdida;
- R$ 383,50 em despesas;
- 156 km percorridos;
- 1 fotografia;
- CSV gerado;
- backup ZIP íntegro com 6 itens.

Também foram verificados HTTP 200 em `/api/health`, `/api/system`, `/api/config`, `/api/dashboard` e na leitura do diário importado.

## PDF

O preflight confirmou:

- 4 páginas A4;
- arquivo não criptografado;
- PDF aberto normalmente pelo PyMuPDF;
- 189 campos e 189 anotações AcroForm;
- ausência de XFA;
- formulário não classificado como documento escaneado.

As quatro páginas foram inspecionadas visualmente após renderização. O exemplo preenchido também foi renderizado, incluindo marcações de segurança, despesas e quilometragem.

## Integração Google

Foram validados localmente:

- sintaxe JavaScript do arquivo `DiarioObraGoogle.gs`;
- correspondência dos títulos principais com o modelo XLSX;
- tratamento de números com vírgula ou ponto;
- estrutura do JSON schema 1.1;
- estrutura do manifesto SHA-256;
- integridade do ZIP de distribuição.

A criação real do Formulário, gatilho e arquivos no Google Drive exige autorização em uma conta Google e deve ser confirmada durante a implantação do cliente. Isso não afeta o fluxo principal PWA + Gestor.

## Dependências e navegador

Os aplicativos TypeScript foram compilados e os dois arquivos JavaScript resultantes passaram no `node --check`. A instalação do Windows baixa React 18, ReactDOM 18 e pdf-lib antes de iniciar o sistema. O ambiente controlado desta validação não possuía acesso externo para repetir esse download; por isso, o teste visual completo no navegador deve ser repetido pelo `INSTALAR_E_INICIAR.bat` no computador de implantação.

## Recomendação de implantação

Executar um piloto com uma equipe durante alguns dias antes da expansão. O piloto deve confirmar:

- tempo real de preenchimento;
- atividades e unidades usadas pela empresa;
- política de comprovantes e fotografias;
- canal de envio dos pacotes;
- responsáveis por conferência e aprovação;
- rotina de backup e retenção dos documentos.
