## v5 — Correções e geração validada

### Bugs do v4 a corrigir

1. **Datas repetidas nas abas por profissional** (caso da Andreia/Carlos no print)
   - Causa: aba agrupa por participante mas emite N linhas (uma por `registro_id`), repetindo a string concatenada de datas em todas.
   - Correção: **1 linha por presença** (não por participante). Colunas: `Nome | Idade | Data Nasc. | Data Presença (DD/MM, singular) | Fonte | ID Registro | Registrado em | Log Auditoria`.
   - Cabeçalho da aba: bloco de resumo com `Total de presenças | Participantes únicos atendidos | Período`.

2. **PARQUE INDEPENDÊNCIA zerado no Resumo Único** (44 únicos perdidos)
   - Causa: normalização de acento inconsistente entre coluna "Bairro" e header da matriz.
   - Correção: normalizar com `unicodedata` antes do `groupby`; cabeçalho fixo com acento correto.

3. **Total Geral Único 114 em vez de 161**
   - Consequência do bug 2 + omissão de fora-de-faixa.
   - Correção: incluir todos os 161 únicos; adicionar coluna "Fora faixa (5 e ≥18)" no Resumo, sem esconder.

4. **13 células do Resumo Único com contagem errada**
   - Correção: recalcular cada célula com SQL `COUNT(DISTINCT participante_id)` direto do banco.

5. **106 registros com "Profissional Registrador" não comprovado**
   - Correção: nova coluna **"Origem do Registrador"** com 3 valores:
     - `audit_log INSERT` (713 linhas)
     - `presenca.registrado_por`
     - `Sem comprovação documental` — nome do registrador vai em branco/`(?)`, NUNCA chutar o educador da turma

### Construção

- Reconstrução 100% a partir do banco vivo via `supabase--read_query` / `psql`. Sem reuso de TSVs do v4.
- Fontes oficiais: `relatorio_presenca` (presente=true) + `relatorios_atividade.data` BETWEEN 2026-05-01 AND 2026-05-31, `participantes`, `bairros`, `audit_log`, `profiles`.
- Faixa etária calculada na data da presença (não na data de hoje).

### Aba "Validação Interna" (nova)

Executa as 11 checagens do relatório de auditoria contra o próprio v5 antes de salvar:
- Cobertura (linhas no banco = linhas no XLSX)
- DISTINCT por bairro × período × faixa = banco
- Total Geral Único = 161
- 0 nomes/datas/bairros/períodos divergentes
- Todos os PARQUE INDEPENDÊNCIA presentes
- Fora-de-faixa contabilizado
- Origem do Registrador preenchida em 100% das linhas

Se qualquer checagem falhar → script aborta e não salva o arquivo, te avisa exatamente o que falhou. Só gera o arquivo se passar tudo com 0 divergências.

### Estrutura final do v5

- **Resumo Único** — matriz Bairro × Período × Faixa (DISTINCT por célula, DISTINCT global nos totais), incluindo PARQUE INDEPENDÊNCIA e fora-de-faixa.
- **N abas por profissional** (uma por pessoa que registrou ≥1 presença em maio), com 1 linha por presença.
- **Auditoria Detalhada Completa** — todos os 819 registros com `Origem do Registrador`.
- **Validação Interna** — checagens passadas/falhadas, contagens lado a lado banco × XLSX.

### Saída

`/mnt/documents/SysCFV_PresentesMaio2026_Auditoria_v5_<timestamp>.xlsx` + relatório-resumo no chat das 11 checagens.
