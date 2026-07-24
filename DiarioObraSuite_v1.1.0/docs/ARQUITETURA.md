# Arquitetura técnica - v1.1.0

## Princípio da solução

O PDF não é usado como única base de gestão. A aplicação preserva dois artefatos complementares:

- **PDF:** documento legível, assinável, imprimível e arquivável;
- **JSON:** fonte estruturada para cálculos, filtros, revisões e indicadores.

## Fluxos de entrada

```text
A) PWA de Campo (principal)
   -> PDF + JSON + fotos + manifesto
   -> ZIP

B) Google Forms + Sheets (alternativo)
   -> Apps Script
   -> PDF + JSON + manifesto
   -> ZIP

C) PDF AcroForm (contingência)
   -> PDF preenchido

Todos os fluxos
   -> Gestor FastAPI
   -> validação/importação
   -> SQLite + documentos
   -> dashboard, aprovação, CSV e backup
```

## Backend

- FastAPI para API e arquivos estáticos;
- Pydantic para validação do schema `1.1`;
- SQLite com WAL;
- pypdf para leitura de campos AcroForm;
- ReportLab para criação do formulário de contingência;
- armazenamento separado em `data/pdfs`, `data/packages` e `data/attachments`.

## Aplicativo de Campo

- React 18 + TypeScript compilado;
- IndexedDB para rascunho e configuração;
- Service Worker para cache offline;
- pdf-lib para gerar o PDF visual;
- JSZip para o pacote de transferência;
- Web Crypto para hashes SHA-256;
- imagens comprimidas no próprio dispositivo.

## Gestor

- React + TypeScript compilado e servido localmente;
- importação em lote;
- fila de revisão e aprovação;
- dashboard com produção, homens-hora, despesas, KM e impedimentos;
- cadastro distribuído ao campo por JSON;
- exportação CSV e backup ZIP.

## Integração Google

O Apps Script cria e conecta:

- Google Form;
- planilha de respostas;
- modelo Google Docs/PDF;
- pasta de saída no Google Drive;
- gatilho de envio;
- geração do JSON e manifesto;
- pacote ZIP compatível com o Gestor.

O modelo XLSX incluído documenta os títulos esperados e o mapeamento para o JSON.

## Identidade, duplicidade e revisão

A chave lógica é `diario_id + revisao`.

- mesmo checksum: duplicado;
- conteúdo diferente na mesma revisão: conflito;
- correção formal: nova revisão;
- versão anterior: preservada no banco e nos arquivos.

## Integridade e limites

- arquivo recebido: até 80 MB;
- ZIP: até 300 itens;
- conteúdo descompactado: até 120 MB;
- item interno: até 35 MB;
- formatos: ZIP, PDF e JSON;
- caminhos absolutos ou com `..`: rejeitados;
- hashes do manifesto: conferidos antes da importação.

## Persistência e privacidade

O Gestor opera localmente. Dados de funcionários, assinaturas, fotos e documentos permanecem na pasta da instalação, salvo quando o usuário os envia por e-mail, WhatsApp, Drive ou outro canal. A implantação deve definir acesso, backup, retenção e canal corporativo de envio.

## Evoluções possíveis

- autenticação por usuário e perfis;
- sincronização automática em nuvem;
- portal do cliente;
- planejamento e medição acumulada;
- alertas de diário atrasado;
- integração com ERP/financeiro;
- geolocalização opcional e consentida;
- assinatura eletrônica com maior nível de evidência.
