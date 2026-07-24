# Mapeamento do formulário físico para a solução digital

| Formulário original | Aplicativo de Campo | JSON / Gestor |
|---|---|---|
| Cliente | Identificação | `projeto.cliente` |
| Data | Identificação | `data` |
| Nº da obra | Identificação | `projeto.id` |
| Obra e endereço | Identificação | `projeto.nome` / `projeto.local` |
| Serviços executados | Atividades estruturadas | `atividades[]` |
| Responsável na obra | Encarregado/assinatura | `encarregado` |
| Café da manhã, almoço, café da tarde e jantar | Despesas | `despesas` |
| Despesas extras | Despesas extras com descrição | `despesas.extras[]` |
| Abastecimento | Despesas | `despesas.abastecimento` |
| KM inicial e final | Deslocamento | `deslocamento` |
| Efetivo por função | Equipe presente | `equipe_presente[]` |
| Horário de início, saída e intervalo | Identificação do turno | `turno_inicio`, `turno_fim`, `intervalo_minutos` |
| Responsável UR e cliente | Encerramento | `assinatura_encarregado` / `assinatura_fiscal` |

## Campos acrescentados para gestão

- quantidade e unidade por atividade;
- percentual de conclusão;
- materiais e equipamentos relevantes;
- segurança, DDS, APR, EPI e ocorrências;
- impedimentos e horas perdidas;
- fotos com legenda e vínculo;
- ID único e revisão;
- contrato e centro de custo;
- status de aprovação e auditoria;
- hashes de integridade do pacote.

O campo livre “Serviços executados” foi preservado conceitualmente, porém dividido em atividades estruturadas. Isso permite consolidar produção, produtividade, custos, horas e evolução sem depender de OCR ou interpretação manual do PDF.
