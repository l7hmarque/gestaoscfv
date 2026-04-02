

## Plano: Evitar duplicidade de matrículas

### Problema

Atualmente, a detecção de participante existente (nome + data de nascimento) é feita apenas no frontend via `public-check-participante`. Se o responsável não espera a verificação ou envia o formulário sem o `existing_id`, a edge function `public-matricula` cria um registro duplicado sem questionar.

### Solução

Mover a validação de duplicidade para o **backend** (`public-matricula`). Antes de inserir um novo participante, a função busca se já existe alguém com o mesmo `nome_completo` + `data_nascimento`. Se encontrar:
- Trata automaticamente como rematrícula (update), mesmo sem `existing_id`
- Retorna flag `rematricula: true` na resposta para o frontend saber

### Mudanças

| Arquivo | O que muda |
|---|---|
| `supabase/functions/public-matricula/index.ts` | Antes do INSERT, buscar participante por nome+DOB. Se encontrado, converter para UPDATE automaticamente |
| `src/pages/matricula/MatriculaPublicaPage.tsx` | Exibir mensagem quando backend retorna `rematricula: true` inesperadamente |

### Detalhes técnicos

Na edge function `public-matricula`, após validar campos obrigatórios e antes do bloco de insert/update:

1. Padronizar nome e buscar: `SELECT id FROM participantes WHERE nome_completo = $nome AND data_nascimento = $dob LIMIT 1`
2. Se encontrado e `existing_id` não foi enviado → setar `existing_id` automaticamente para o ID encontrado
3. Se encontrado e `existing_id` foi enviado mas difere → rejeitar com erro (conflito)
4. O fluxo segue normalmente (update para rematrícula, insert para novo)

Isso garante que mesmo sem a verificação do frontend, o backend **nunca** cria duplicatas por nome+data de nascimento.

