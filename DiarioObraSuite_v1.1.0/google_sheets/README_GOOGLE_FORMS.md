# Integração Google Forms + Google Sheets

Esta integração é uma alternativa para equipes terceirizadas ou para um piloto rápido. O fluxo principal continua sendo o aplicativo PWA de campo, porque ele funciona offline, aceita fotos e assinatura e tem validações mais completas.

## O que o script cria

- Google Form para preenchimento no celular;
- Google Sheets de respostas;
- pasta no Google Drive;
- gatilho automático para cada envio;
- PDF do diário;
- JSON estruturado;
- manifesto SHA-256;
- pacote ZIP compatível com a aba **Importar** do Gestor.

## Instalação

1. Acesse `script.google.com` e crie um projeto.
2. Apague o conteúdo inicial e cole o arquivo `DiarioObraGoogle.gs`.
3. Execute a função `criarEstruturaDiarioObra`.
4. Autorize Formulários, Planilhas, Documentos, Drive e gatilhos.
5. Abra **Execuções > Registros** para copiar os links do formulário, planilha e pasta.
6. Faça um envio de teste.
7. Na planilha, abra a aba `PACOTES_GERADOS` e baixe o ZIP.
8. Importe o ZIP no Gestor de Diário de Obras.

## Envio por e-mail opcional

Execute no editor:

```javascript
configurarEmailDestino('seu-email@empresa.com');
```

Os próximos pacotes também serão enviados ao endereço configurado.

## Limitações do modo Google

- depende de internet;
- não possui assinatura manuscrita nativa;
- fotos são registradas por link para uma pasta ou álbum;
- o formulário padrão permite até três atividades por envio;
- para operação regular, use o aplicativo PWA incluído no pacote principal.
