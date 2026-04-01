

## Plano: Corrigir download do Termo de Uso de Imagem

### Problema

O PDF está em `public/termo-uso-imagem.pdf`, mas o hosting de produção (Cloudflare) serve `index.html` para todas as rotas — incluindo `/termo-uso-imagem.pdf`. O navegador recebe HTML em vez do PDF, e o React Router redireciona para a página inicial.

Confirmei isso navegando para `https://gestaoscfv.lovable.app/termo-uso-imagem.pdf` — o servidor retorna `content-type: text/html`.

### Solução

Fazer upload do PDF para o Storage (bucket público) e usar a URL pública direta no link de download. Isso bypassa completamente o SPA routing.

### Passos

1. **Criar bucket público** `documentos-publicos` no Storage (via migração SQL)
2. **Fazer upload do PDF** para o bucket via edge function ou script
3. **Atualizar `MatriculaPublicaPage.tsx`** — trocar `href="/termo-uso-imagem.pdf"` pela URL pública do Storage: `{SUPABASE_URL}/storage/v1/object/public/documentos-publicos/termo-uso-imagem.pdf`

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Criar bucket público `documentos-publicos` com policy de leitura pública |
| `src/pages/matricula/MatriculaPublicaPage.tsx` | Atualizar URL do PDF para apontar ao Storage |

### Detalhes técnicos

- O bucket precisa de policy `SELECT` para `anon` (acesso público sem auth)
- A URL final será: `https://txyyncubqdsqbdnozwjz.supabase.co/storage/v1/object/public/documentos-publicos/termo-uso-imagem.pdf`
- O arquivo `public/termo-uso-imagem.pdf` pode ser mantido como backup

