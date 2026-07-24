# Changelog

## 1.1.0 - 2026-07-23

- Implementado o fluxo híbrido recomendado: PWA principal, PDF formal, JSON estruturado e ZIP com manifesto.
- Adicionados campos de refeições, despesas extras e abastecimento.
- Adicionados veículo, placa, KM inicial, KM final e cálculo de quilometragem.
- Adicionado intervalo em minutos e assinatura opcional do cliente.
- Dashboard e CSV ampliados com despesas e KM.
- PDF de contingência ampliado para 4 páginas e 189 campos.
- Gerada integração Google Forms + Sheets + Apps Script compatível com a importação.
- Criado modelo XLSX de referência e mapeamento JSON.
- Atualizados exemplos, manual, arquitetura e validações.
- Mantida migração segura para banco criado pela versão 1.0.

## 1.0.0 - 2026-07-23

- Aplicativo de campo responsivo e offline.
- Rascunho em IndexedDB.
- Cadastros importáveis por JSON.
- Equipe, produção, recursos, segurança, impedimentos, fotos e assinatura.
- PDF e pacote ZIP com manifesto SHA-256.
- Gestor local com FastAPI, React, TypeScript e SQLite.
- Importação ZIP/PDF/JSON, duplicidade, conflito e revisões.
- Dashboard, aprovação, CSV, backup e auditoria.
- PDF AcroForm de contingência.
- Instalador, validador e preparação para Netlify.
