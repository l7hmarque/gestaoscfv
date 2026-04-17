

## Análise das listas de março/2026

**Estrutura confirmada:** 18 páginas — uma por turma (Bairro × Faixa × Período × Dia da semana). Marcações:
- `●` (bolinha preta) = **presente**
- `F` ou `C` = **falta**
- Vazio = sem registro
- Anotações manuscritas à margem indicam ações que a coordenação sinalizou em papel (ex: "p/ manhã", "p/ tarde", "→ Alvorada", "Adolescentes", "desligado", nomes manuscritos adicionando alunos novos).

**Observações importantes:**
1. Várias turmas têm muitos `F` consecutivos com anotação "p/ manhã" ou "p/ tarde" ao lado — indicando que o aluno foi para o **outro período** (a chamada que rodou anteriormente entendeu como evasão, mas era trocade turno).
2. Há nomes **sublinhados/manuscritos** no fim de algumas listas (ex: Enzo Gabriel, Jhonatan Felipe na pág. 1) = inclusões feitas no papel que provavelmente nunca entraram no sistema, ou entraram em outra turma.
3. Página 1 (JI 9-11 Tarde): ~6 alunos com presença real (Isac, Leonardo, Pedro, Enzo, Jhonatan, Kmila) — os demais com 5×F são candidatos a transferência para a manhã ou desligamento.
4. Páginas 5 e 6 (PI 9-11 Tarde/Manhã): muitas anotações cruzadas "→ Adolescentes", "→ Alvorada", "p/ tarde" — indica realocações pendentes.
5. Página 9 (JI 6-8 Manhã): "Realizado" e setas indicam transferências p/ tarde.

## Plano de ação

### Fase 1 — Extrair e estruturar (esta etapa, sem alterar dados)
1. Para cada uma das 18 páginas, montar uma tabela limpa com:
   - Bairro, Faixa, Período, Dia da semana
   - Lista de participantes da turma original
   - Presenças por data (●), faltas (F/C), vazios
   - Anotações manuscritas relevantes (transferência, desligamento, novo nome)
2. Cruzar cada nome com a base `participantes` (busca fuzzy por nome + bairro) para descobrir:
   - **ID atual** do participante
   - **Período cadastrado** hoje no SysCFV
   - **Status** atual (ativo / desligado / busca_ativa)
   - **Turma vinculada** hoje (`turma_participantes` ativo)
3. Gerar um **relatório de divergências** em XLSX salvando em `/mnt/documents/`:
   - **Aba "Reposicionar"** — alunos cujo período da chamada ≠ período cadastrado
   - **Aba "Sem vínculo"** — ativos com presença marcada mas sem `turma_participantes` ativo
   - **Aba "Candidatos a desligamento"** — 5 faltas seguidas + nenhuma anotação de transferência
   - **Aba "Manuscritos"** — nomes que aparecem na lista mas não constam no sistema (precisam matrícula ou são duplicata)
   - **Aba "Inserir presença"** — todas as presenças `●` que não estão na tabela `presenca` nem `relatorio_presenca` para março/2026

### Fase 2 — Você revisa o XLSX
Você revisa cada aba, marca quais linhas aprova (coluna "Confirmar S/N"), e me devolve o arquivo. Isso evita repetir o erro da auto-transferência (movimentar gente sem revisão humana).

### Fase 3 — Aplicar mudanças aprovadas (próximo ciclo, com sua confirmação)
Para cada aba aprovada, executo:
- **Reposicionar:** atualiza `participantes.periodo`, fecha `turma_participantes` antigo (`data_saida`), abre vínculo na turma do período correto, registra `participante_transferencias` com motivo "Ajuste retroativo lista chamada março/2026", grava em `audit_log`.
- **Sem vínculo:** abre vínculo `turma_participantes` na turma compatível.
- **Candidatos a desligamento:** apenas LISTA — desligamento sempre passa por sua decisão manual via UI.
- **Manuscritos:** lista para você matricular ou identificar duplicata via merge.
- **Inserir presença:** popula `presenca` retroativa com `data` correta, `presente=true`, `registrado_por=` seu user_id, `justificativa="Importação lista chamada março/2026"`.

### Detalhes técnicos
- Uso `supabase--read_query` para mapear nomes → IDs (com `pg_trgm` similarity ≥ 0.6 e filtro por bairro).
- Uso `code--exec` (Python + pandas + openpyxl) para gerar o XLSX com as 5 abas, formatação grayscale (padrão SysCFV), AutoFit.
- **Não toco em nenhum dado** nesta fase — só leitura + geração do arquivo.
- O XLSX vem com colunas pré-preenchidas e uma coluna **"Confirmar (S/N/Outro)"** vazia para você marcar.

### Não-objetivos
- **Não vou** mover ninguém automaticamente nesta fase.
- **Não vou** desligar ninguém automaticamente.
- **Não vou** inserir presença sem você ver a lista antes.

### Próximo passo
Aprovando, parto para a Fase 1 e te entrego o XLSX de divergências para revisão.

