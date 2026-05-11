---
name: Busca Ativa (manual)
description: Classificação Busca Ativa é 100% manual; não há detecção automática nem (BA) em listas
type: feature
---
A classificação de **Busca Ativa** é exclusivamente **manual**. A equipe técnica/coordenação altera o status pelos botões do painel de Busca Ativa em `/equipe-tecnica` ou pela ficha do participante.

**Sem automações:**
- A função `recalcular_busca_ativa()` foi neutralizada (no-op) — mantida só para compatibilidade.
- Não há trigger nem cron job rodando recálculo.
- `RelatorioNovoPage.handleSave` não chama mais a RPC.
- `PresencaPage.handleSave` não reverte mais BA→ativo automaticamente.

**Marcadores em listas:** o tag `(BA)` foi removido das listas de chamada e listas de presença (single + mensal, gsheet e local). Apenas `(D)`, `(T)` e `(N)` permanecem.

**Histórico:** `busca_ativa_registros` continua sendo populado por ações manuais (botão Registrar Busca Ativa).
