

## Entendimento

Você vai me enviar de volta a planilha `SysCFV_DivergenciasChamada_2026-03.xlsx` que gerei, com a coluna **"Ação Sugerida"** editada por você (nas 5 abas) refletindo o que **deve** ser feito — não o que sugeri. Adicionalmente, está enviando agora o **PDF DESLIGAMENTOS.pdf** com nomes + datas de desligamento que devem ser cruzados com a aba **"Candidatos Desligamento"**.

Pode haver duplicação: alguns participantes podem aparecer tanto no PDF quanto marcados manualmente por você na planilha. A fonte de verdade é o que estiver decidido — se aparece em qualquer um dos dois com decisão de desligar, desliga; usar a data mais antiga entre as duas fontes quando houver conflito.

## Plano

### Fase A — Análise (esta etapa, sem alterar dados)
1. Ler o PDF `DESLIGAMENTOS.pdf` com `document--parse_document` e extrair pares **Nome → Data desligamento** (incluindo motivo se houver).
2. Aguardar você me reenviar o XLSX revisado.
3. Para cada aba da planilha revisada, mapear linha por linha as ações que você marcou:
   - **Reposicionar**: `MUDAR_PERIODO` / `MANTER` / `DESLIGAR` / `OUTRO`
   - **Sem Vínculo**: `VINCULAR` / `DESLIGAR` / `IGNORAR`
   - **Candidatos Desligamento**: `DESLIGAR` / `MANTER` / `BUSCA_ATIVA` (cruzando com PDF)
   - **Manuscritos-Desligados**: `MATRICULAR` / `MERGE` / `IGNORAR`
   - **Inserir Presença**: `INSERIR` / `IGNORAR`
4. Cruzar **Candidatos Desligamento × PDF**:
   - Match fuzzy nome (similarity ≥ 0.7), mesmo bairro
   - Se PDF diz "desligar em DD/MM" e você marcou MANTER → respeitar **sua decisão** (você é a fonte final)
   - Se você marcou DESLIGAR sem data e PDF tem data → usar a data do PDF
   - Se ambos dizem desligar com datas diferentes → usar a **mais antiga**
5. Gerar um **plano de execução consolidado em XLSX** (`SysCFV_PlanoExecucao_2026-03.xlsx`) com uma aba única listando todas as operações finais resolvidas:
   | Ordem | Ação | Participante | ID | Data | Motivo | Origem (PDF/XLSX/Ambos) | Tabelas afetadas |

### Fase B — Você revisa o plano consolidado
Confere se as resoluções de conflito ficaram corretas (especialmente onde PDF e XLSX divergem). Aprova ou ajusta.

### Fase C — Execução (próximo ciclo, com sua confirmação)
Para cada linha aprovada, executar via `supabase--read_query` (leitura) + tool de insert (escrita):
- **Desligar**: `UPDATE participantes SET status='desligado', data_desligamento=X, motivo_desligamento=Y` + fechar `turma_participantes` (data_saida) + `audit_log`
- **Reposicionar período**: `UPDATE participantes SET periodo=X` + fechar vínculo antigo + abrir vínculo novo + inserir `participante_transferencias` + `audit_log`
- **Vincular**: inserir em `turma_participantes` (data_entrada=hoje) + `audit_log`
- **Inserir presença retroativa**: inserir em `presenca` (data, presente=true, justificativa="Importação lista chamada março/2026") + `audit_log`
- **Matricular novo**: criar em `participantes` com dados básicos do PDF + bairro deduzido da turma da lista
- **Merge**: chamar edge function `merge-participantes`

Tudo registrado em `audit_log` com user_nome="Sistema (importação chamada março/2026)" e justificativa apontando origem (PDF / XLSX / decisão manual).

### Não-objetivos
- Não vou desligar/reposicionar/inserir nada antes de você aprovar o **Plano de Execução Consolidado** da Fase B.
- Não vou usar minhas sugestões originais — apenas as **suas decisões editadas** + cruzamento com o PDF.
- Em caso de conflito irreconciliável (ex: nome no PDF que não bate com nada), gero uma aba separada **"Pendentes"** para resolução manual.

### Próximo passo
Me envie o XLSX revisado. Em paralelo, parto agora para a Fase A passo 1 (extrair o PDF) para já ter os dados prontos quando o XLSX chegar.

