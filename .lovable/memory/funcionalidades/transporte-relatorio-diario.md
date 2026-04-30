---
name: Relatório Diário de Transporte
description: Aba Transporte agrupa embarques por bairro, permite reordenar pontos (campo `ordem`) e exporta XLSX padrão SysCFV com check-in família + embarque motorista
type: feature
---
- Tabela `pontos_transporte` tem campo `ordem` (int) — pontos são listados por bairro respeitando essa ordem (setas ↑↓ na UI).
- "Embarques de hoje" agrupa pontos por bairro, com totais por bairro e número de sequência por ponto.
- Família registra horário em `participante_checkins.confirmado_em`; motorista registra `embarcou_em`.
- Botão "Relatório do dia" gera XLSX via `src/lib/transporteRelatorio.ts` seguindo padrão institucional (cabeçalho, bordas, autoFit) e nomenclatura `sysCfvFileName("Transporte", "xlsx", "{data}_{periodo}")`.
