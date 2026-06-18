## Auditoria e Validação dos Dados — v4

Objetivo: garantir que cada número, nome, data e registro de auditoria no arquivo `SysCFV_PresentesMaio2026_Auditoria_v4` corresponde **exatamente** ao que está no banco de dados, sem qualquer transformação, suposição ou perda.

### 1. Reconstrução independente a partir do banco

Vou rodar consultas SQL diretamente no banco (somente leitura) e comparar linha-a-linha com o XLSX gerado. Nada será "recalculado" no Python a partir de TSVs intermediários — a fonte é o banco vivo.

Fontes oficiais consultadas:
- `presenca` (registros individuais de presença)
- `relatorio_presenca` + `relatorios_atividade` (presença via relatório de atividade)
- `participantes` (nome, DOB, bairro, período, status)
- `participante_transferencias` (para validar bairro/período na data da presença)
- `audit_log` (autor real do INSERT de cada registro)
- `profiles` (nome do profissional registrador)
- `turma_participantes` + `turmas` (vínculo na data)

### 2. Checagens de integridade

| # | Verificação | Critério de aprovação |
|---|---|---|
| 1 | Total de registros de presença em maio/2026 | Igual ao `COUNT(*)` no banco filtrado por `data BETWEEN 2026-05-01 AND 2026-05-31` |
| 2 | Participantes únicos com ≥1 presença | Igual ao `COUNT(DISTINCT participante_id)` no banco |
| 3 | Profissional registrador | Igual ao autor do **primeiro INSERT** em `audit_log` para aquele `(tabela, registro_id)`; se ausente, marcar explicitamente como "Sem log de auditoria" — nunca inventar |
| 4 | Data de cada presença | Bate com `presenca.data` ou `relatorios_atividade.iniciou_em::date` |
| 5 | Bairro/Período do participante | Reflete o vínculo **na data da presença**, não o estado atual (considerar transferências) |
| 6 | Faixa etária | Recalculada a partir de `data_nascimento` na data da presença (não na data de hoje) |
| 7 | Resumo Único — células | `COUNT(DISTINCT participante_id)` por (bairro × período × faixa) confere com SQL |
| 8 | Resumo Único — totais | Cada total (linha, coluna, geral) = DISTINCT global; nenhum participante contado 2× em totais |
| 9 | Log de auditoria por linha | Texto bate exatamente com `audit_log.dados_novos`/`acao`/`autor_nome`/`criado_em` correspondente |
| 10 | Cobertura | Nenhuma presença de maio existente no banco está ausente do XLSX; nenhuma linha do XLSX é inventada |

### 3. Relatório de divergências

Saída: arquivo `SysCFV_Auditoria_Validacao_v4_<timestamp>.xlsx` com abas:

- **Resumo Validação** — passou/falhou por verificação, com contagens lado a lado (Banco × XLSX × Diferença)
- **Divergências Detalhadas** — lista linha-a-linha de qualquer registro onde XLSX ≠ Banco (campo divergente, valor esperado, valor encontrado, `registro_id`)
- **Registros Sem Audit Log** — presenças cujo INSERT não aparece em `audit_log` (risco: profissional registrador não pode ser comprovado documentalmente)
- **Participantes Sem Vínculo na Data** — presenças onde o participante não tinha turma/bairro/período válido naquele dia
- **Conferência Resumo Único** — matriz reconstruída pelo SQL ao lado da matriz do XLSX, com células divergentes destacadas

### 4. Decisão final

- **0 divergências** → arquivo v4 está auditado e seguro para uso oficial.
- **Qualquer divergência** → v4 **não deve ser usado** como documento oficial; gero v5 corrigido apenas após você revisar o relatório de divergências e aprovar as correções.

### Detalhes técnicos

- Consultas via `supabase--read_query` (somente leitura, sem alterar o banco).
- Reconstrução em Python usando `pandas` + `openpyxl`, sem reutilizar nenhum TSV intermediário do v4.
- Comparação por `participante_id` + `data` + `fonte` + `registro_id` (chave composta única).
- Para campos textuais (nome, autor), comparação case-insensitive e com `strip()`, mas qualquer diferença real é reportada.
- O arquivo de validação tem cabeçalho institucional explicando metodologia, escopo (maio/2026), data da auditoria e fonte (banco de produção no momento da execução).
