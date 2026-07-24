# Diário de Obra Suite v1.1.0

Solução híbrida para registrar diários de obra no celular e consolidá-los automaticamente no computador da gestão.

A fonte operacional é o **JSON estruturado**. O **PDF** é o documento visual e formal. Ambos são enviados no mesmo pacote ZIP, com fotografias e manifesto de integridade.

## Componentes incluídos

### 1. Aplicativo de Campo - fluxo principal

Aplicação React + TypeScript preparada como PWA:

- interface responsiva para celular e tablet;
- rascunho salvo automaticamente no dispositivo;
- funcionamento offline após a primeira abertura por HTTPS;
- identificação da obra, contrato, equipe, turno e clima;
- efetivo, função, horas normais e extras;
- atividades com código, local, quantidade, unidade e percentual;
- materiais e equipamentos relevantes;
- refeições, despesas extras e abastecimento;
- veículo, placa, quilometragem inicial e final;
- checklist de segurança e ocorrências;
- impedimentos, impacto e horas perdidas;
- fotografias com legenda e vínculo;
- assinatura do encarregado e assinatura opcional do cliente;
- geração de PDF, JSON e ZIP com manifesto SHA-256;
- repetição controlada dos dados do diário anterior.

### 2. Gestor Local

Aplicação React + TypeScript servida por FastAPI, com banco SQLite local:

- importação de ZIP estruturado, PDF preenchível ou JSON;
- validação de formato, campos, manifesto, hashes e limites de arquivo;
- detecção de duplicidade, conflito e nova revisão;
- fila para aprovação, ressalva ou rejeição;
- indicadores de diários, pessoas, homens-hora, atividades e produção;
- despesas diárias e quilometragem por obra;
- impedimentos, horas perdidas e fotografias;
- cadastros de obras, funcionários, equipes, atividades e veículos;
- exportação CSV, auditoria e backup ZIP completo.

### 3. PDF preenchível de contingência

O modelo possui **4 páginas e 189 campos AcroForm**:

1. identificação e equipe;
2. atividades executadas;
3. despesas, deslocamento e segurança;
4. impedimentos, observações e assinaturas.

O PDF salvo com os campos preservados pode ser importado diretamente no Gestor.

### 4. Integração Google Forms + Sheets

A pasta `google_sheets` e o download disponível no Gestor contêm:

- `DiarioObraGoogle.gs`: Apps Script que cria o formulário, a planilha, a pasta no Drive e o gatilho de envio;
- `Modelo_Diario_Obra_Google_Sheets.xlsx`: estrutura de referência e mapeamento;
- `README_GOOGLE_FORMS.md`: implantação passo a passo.

A automação gera PDF, JSON, manifesto e ZIP compatíveis com a mesma tela de importação do Gestor. Esta alternativa é indicada para piloto rápido ou equipes terceirizadas com acesso à internet.

## Fluxo de dados

```text
Aplicativo de Campo / Google Forms / PDF de contingência
                         |
                         v
               PDF + JSON + fotos
                         |
                         v
               pacote ZIP com hashes
                         |
                         v
                  Gestor Local
                         |
        SQLite + documentos + indicadores
```

## Instalação no Windows

1. Descompacte integralmente `DiarioObraSuite_v1.1.0.zip`.
2. Mantenha a pasta em um local definitivo, fora de pastas temporárias.
3. Execute `INSTALAR_E_INICIAR.bat`.
4. Aguarde a criação do ambiente Python, a instalação das dependências e a validação.
5. O Gestor será aberto no navegador.
6. Nas próximas utilizações, execute apenas `INICIAR.bat`.

### Requisitos

- Windows 10 ou 11;
- Python 3.11 ou superior, com `Add Python to PATH` habilitado;
- Chrome, Edge ou navegador equivalente;
- internet na primeira instalação para baixar as dependências;
- HTTPS para instalar e utilizar plenamente o modo offline da PWA no celular.

Depois da instalação, o Gestor funciona localmente sem servidor externo.

## Implantação recomendada

1. Abra **Cadastros** e substitua os dados de demonstração.
2. Cadastre obras, funcionários, equipes, atividades e veículos.
3. Em **Implantação**, exporte `configuracao_campo.json`.
4. Importe essa configuração no Aplicativo de Campo.
5. Preencha um diário de teste e gere o pacote ZIP.
6. No Gestor, abra **Importar**, selecione o ZIP e confira os resultados.
7. Faça um piloto com uma equipe antes de expandir para todas as obras.

## Publicação da PWA

Execute `PREPARAR_CAMPO_NETLIFY.bat`. Serão gerados:

- `distribuicao/Campo_Netlify/`;
- `distribuicao/Campo_Netlify.zip`.

Publique a pasta no Netlify ou em outro servidor HTTPS. O endereço resultante poderá ser instalado no celular como aplicativo.

## Formatos aceitos pelo Gestor

### ZIP recomendado

```text
diario.json
diario.pdf
manifest.json
fotos/
assinaturas/
```

### PDF preenchível

Use o arquivo:

`app/static/downloads/Modelo_Diario_Obra_Contingencia.pdf`

Preencha em um leitor que preserve AcroForm. Não use “Imprimir em PDF” e não achate o documento antes da importação.

### JSON

Pode ser importado diretamente desde que siga o schema `1.1`.

## Arquivos de apoio

- `docs/exemplos/Pacote_Diario_Exemplo.zip`: pacote pronto para testar a importação;
- `docs/exemplos/Diario_Exemplo_Preenchido.pdf`: exemplo visual preenchido;
- `docs/exemplos/diario_exemplo.json`: exemplo estruturado;
- `app/static/downloads/Integracao_Google_Forms_Sheets.zip`: pacote de integração Google;
- `docs/RELATORIO_VALIDACAO.md`: resultados técnicos da versão.

## Backup

Use **Baixar backup completo** no Gestor. O ZIP inclui banco SQLite, PDFs, pacotes originais, anexos, configuração e identificação da versão. Armazene cópias periódicas em local corporativo protegido.

## Validação

Execute `VALIDAR.bat` para repetir:

- compilação dos módulos Python;
- seis testes automatizados;
- geração e leitura do PDF de 4 páginas e 189 campos;
- integridade e segurança dos pacotes ZIP;
- duplicidade, conflitos e revisões;
- despesas e quilometragem;
- sintaxe dos aplicativos JavaScript compilados.

Consulte o relatório de validação para o escopo completo e as limitações do teste.
