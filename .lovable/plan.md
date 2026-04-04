

## Plano: Corrigir duplicatas de participantes (case-sensitivity)

---

### Problema

A busca por duplicatas nas Edge Functions `public-matricula` e `public-check-participante` usa `.eq("nome_completo", nomePadronizado)`, que é case-sensitive no Postgres. Se o registro original foi criado sem UPPERCASE (pelo formulário interno), a busca não encontra e cria duplicata.

---

### Correção (2 partes)

#### Parte 1 — Corrigir Edge Functions (prevenir novas duplicatas)

**`supabase/functions/public-matricula/index.ts`**
- Trocar `.eq("nome_completo", nomePadronizado)` por busca case-insensitive usando `.ilike("nome_completo", nomePadronizado)` nas duas queries de verificação de duplicata
- Manter o `nomePadronizado` UPPERCASE para o payload de inserção/atualização

**`supabase/functions/public-check-participante/index.ts`**
- Mesma correção: `.ilike("nome_completo", nomePadronizado)` na busca

#### Parte 2 — Unificar duplicatas existentes no banco

**Script SQL via migration:**
- Identificar pares de duplicatas (mesmo nome case-insensitive + mesma data de nascimento)
- Para cada par, manter o registro com `updated_at` mais recente (ou `created_at` mais recente)
- Transferir vínculos do registro antigo (turma_participantes, presenca, participante_documentos, atendimentos, relatorio_presenca) para o registro mantido
- Deletar o registro duplicado

#### Parte 3 — Garantir UPPERCASE no formulário interno

**`src/pages/participantes/ParticipanteNovoPage.tsx`**
- Adicionar `.trim().toUpperCase()` ao `nome_completo` antes do insert, para consistência com o fluxo público

---

### Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/public-matricula/index.ts` | `.eq` → `.ilike` para busca de duplicatas |
| `supabase/functions/public-check-participante/index.ts` | `.eq` → `.ilike` para busca |
| Migração SQL | Script de merge de duplicatas existentes |
| `src/pages/participantes/ParticipanteNovoPage.tsx` | Uppercase no nome antes do insert |

