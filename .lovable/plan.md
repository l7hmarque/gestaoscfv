

## Análise do Projeto — Limitações, Problemas e Pontos Cegos

### 1. SEGURANÇA — Vulnerabilidades Críticas

**1.1 Rematrícula sem validação de identidade**
A edge function `public-matricula` aceita `existing_id` diretamente do cliente. Qualquer pessoa pode enviar um UUID arbitrário e sobrescrever dados de qualquer participante. Não há validação de que o `existing_id` corresponde ao nome/data_nascimento informados.

**1.2 Edge functions públicas expõem dados sensíveis**
A função `public-check-participante` retorna CPF do responsável, WhatsApp, endereço completo, e dados de saúde (laudo) para qualquer requisição anônima. Basta saber nome + data de nascimento de uma criança para obter dados pessoais dos responsáveis.

**1.3 Sem rate limiting nas edge functions públicas**
As funções `public-matricula`, `public-check-participante` e `public-pontos` não possuem nenhum controle de taxa. Permitem brute-force para descobrir participantes cadastrados ou spam de matrículas falsas.

**1.4 Upload de arquivos sem validação de tamanho**
A matrícula pública converte arquivos para base64 e envia no body JSON. Não há limite de tamanho — um arquivo de 50MB pode derrubar a edge function ou exceder limites de memória do Deno.

---

### 2. INTEGRIDADE DE DADOS — Buracos na Sincronização

**2.1 Rematrícula sempre volta para "pendente" — perde turmas**
Quando um participante **ativo** faz rematrícula online, o status é forçado para `"pendente"` (linha 69 do `public-matricula`). Porém, os vínculos com turmas existentes NÃO são removidos. Resultado: participante pendente aparece nas listas de presença, mas não deveria.

**2.2 Desligamento não limpa presença futura**
Ao desligar um participante (`ParticipantePerfilPage` linha 119-125), os vínculos com turmas são removidos, mas registros de presença futura (se já lançados) não são apagados. Dados inconsistentes no dashboard.

**2.3 Duplicação de turma_participantes**
A automação de vinculação em `ParticipantePerfilPage` (pendente→ativo, linha 128-141) e `ParticipanteNovoPage` não verificam se o vínculo já existe antes de inserir. Se o administrador aprovar manualmente duas vezes ou vincular manualmente antes de aprovar, cria registros duplicados. A tabela `turma_participantes` não tem constraint UNIQUE em `(turma_id, participante_id)`.

**2.4 Relatório salva presença para TODAS as turmas com os MESMOS participantes**
Em `RelatorioNovoPage` (linhas 193-207), ao selecionar múltiplas turmas, a presença é salva para cada turma usando a **mesma lista de participantes**. Se turmas têm membros diferentes, participantes que não pertencem a uma turma recebem registro de presença nela.

**2.5 Presença delete+insert não é atômico**
Em `PresencaPage` e `RelatorioNovoPage`, o padrão `delete` → `insert` não é transacional. Se o insert falha após o delete, os dados de presença são perdidos sem possibilidade de recovery.

---

### 3. FLUXO DE DADOS — Inconsistências

**3.1 Faixa etária calculada dinamicamente vs. estática**
A faixa etária nunca é armazenada — é calculada a partir de `data_nascimento` em tempo real. Quando um participante faz aniversário e muda de faixa (ex: 11→12 anos), ele deveria ser realocado de turma, mas isso SÓ acontece se alguém editar o perfil. Não há automação periódica.

**3.2 Limite de 1000 registros do Supabase**
`ParticipantesPage` faz `supabase.from("participantes").select("*")` sem paginação. Com mais de 1000 participantes, dados serão silenciosamente truncados. Mesmo problema em `PresencaPage`, `TurmaDetalhePage`, `DashboardPage` e `BancoDadosPage`.

**3.3 Matrícula online não valida data_nascimento**
O formulário aceita datas futuras ou datas que resultem em idade fora da faixa atendida (ex: adulto de 30 anos). Não há validação de faixa etária elegível.

**3.4 Campo `endereco_bairro` vs `bairro_id`**
Dois conceitos de "bairro" coexistem: o bairro de residência (texto livre `endereco_bairro`) e o bairro SCFV operacional (`bairro_id`). A matrícula online preenche ambos, mas o bairro de residência não é padronizado e pode divergir.

---

### 4. UX — Problemas de Experiência

**4.1 Sem feedback de documentos já enviados na rematrícula**
Na rematrícula, o formulário popula os dados do participante, mas NÃO mostra os documentos já enviados anteriormente. O responsável não sabe quais documentos já estão no sistema.

**4.2 Matrícula online não salva rascunho**
Se o responsável perde a conexão ou fecha o navegador acidentalmente no meio do preenchimento, todos os dados são perdidos. Nenhum salvamento local.

**4.3 Aprovação de pendente é manual e desconectada**
Não há botão direto "Aprovar" na lista de pendentes. O fluxo exige: clicar no participante → editar → mudar status para "ativo" → salvar. Propenso a esquecimento de alterar o status.

---

### 5. PERFORMANCE E ESCALABILIDADE

**5.1 N+1 queries no dashboard**
`useDashboardData` carrega TODAS as tabelas em `Promise.all` sem filtros significativos. À medida que dados crescem, o carregamento ficará progressivamente mais lento.

**5.2 Documentos base64 no corpo da requisição**
Enviar múltiplos documentos como base64 em um único JSON pode facilmente atingir limites de payload (6MB padrão do Supabase Edge Functions). Idealmente deveria usar upload direto ao Storage com signed URLs.

---

### 6. RESUMO — Prioridades

| Severidade | Item | Risco |
|---|---|---|
| **CRÍTICA** | 1.1 — existing_id sem validação | Qualquer pessoa pode sobrescrever dados |
| **CRÍTICA** | 1.2 — Dados sensíveis expostos publicamente | LGPD / Privacidade de menores |
| **ALTA** | 2.1 — Rematrícula quebra status sem limpar turmas | Dados inconsistentes |
| **ALTA** | 2.3 — Duplicação turma_participantes | Contagens erradas no dashboard |
| **ALTA** | 2.4 — Presença cross-turma incorreta | Frequência inflada/incorreta |
| **MÉDIA** | 3.2 — Limite 1000 rows | Dados sumindo silenciosamente |
| **MÉDIA** | 1.3 — Sem rate limiting | Spam/brute-force |
| **MÉDIA** | 3.1 — Faixa etária sem atualização automática | Turmas desatualizadas |
| **BAIXA** | 4.3 — UX de aprovação ruim | Ineficiência operacional |
| **BAIXA** | 5.2 — Base64 no payload | Limite de upload |

