# Correção da Biblioteca de Documentos (.docx)

## Diagnóstico

Após investigar código + dados reais:

| Verificação | Resultado |
|---|---|
| Linhas em `biblioteca_documentos` | 151 relatórios + 24 planejamentos, **todas com `origem_id` único** (constraint `UNIQUE(tipo, origem_id)` ativa) |
| Objetos no bucket `biblioteca-docx` | **0** (nada foi efetivamente persistido em Storage) |
| Relatórios totais vs registros na biblioteca | 171 relatórios reais × 151 na biblioteca → **20 faltando** |
| Erro ao baixar pela Biblioteca | Confirmado: `captureBlob` em `bibliotecaDocx.ts` tenta sobrescrever `saveAs` de um módulo ESM imutável |
| Botões "Exportar" em Detalhe / Lote | Continuam chamando `saveAs` direto — funcionam normalmente |

**Causas:**

1. **Erro "Cannot set property saveAs"** — a estratégia de monkey-patch do `file-saver` não funciona em build ESM (esbuild congela exports). Mesmo com cast `as any`, o getter do Module Record permanece read-only no runtime.
2. **Sensação de "duplicação"** — o `useQuery` `["biblioteca-sync"]` em `BibliotecaPage.tsx` (linha 68-87) tem dois problemas:
   - `setTimeout(() => refetch(), 500)` é chamado durante o render sem guarda → causa loop visual de re-fetch.
   - A cada montagem da página enfileira até 50 itens "faltantes" via RPC, e o RPC faz `ON CONFLICT DO UPDATE SET status='pendente', updated_at=now()` → cada registro existente é "tocado" e a lista parece se mexer.
   - Isso também resseta `status='gerado'` → `'pendente'` perdendo a marcação, e dispara muitas chamadas RPC desnecessárias.
3. **20 relatórios faltando** — sync só pega 50 por execução e o loop quebrado nunca completa todos.

## Correções

### 1. Substituir o monkey-patch de `saveAs` por geração direta de Blob

Em `src/lib/bibliotecaDocx.ts`, em vez de interceptar `saveAs`, vou:

- Refatorar `gerarDocxRelatorioBlob` / `gerarDocxPlanejamentoBlob` para chamar diretamente `Packer.toBlob(...)` da biblioteca `docx`, **reutilizando os mesmos builders** (`buildRelatorioTemplateData`, etc.) já presentes em `useDocumentExport.ts`.
- Para isso, vou **exportar uma função auxiliar** `buildRelatorioDocxBlob(item, turmas, presenca, fotos)` em `useDocumentExport.ts` que retorna `Blob` em vez de chamar `saveAs`. A função pública `exportRelatorioDocx` passa a ser apenas `buildRelatorioDocxBlob(...) → saveAs(...)`.
- Mesma coisa para `exportPlanejamentoDocx` → `buildPlanejamentoDocxBlob`.
- Remover `captureBlob` e a importação de `file-saver` em `bibliotecaDocx.ts`.

Resultado: download da Biblioteca passa a funcionar; downloads de Detalhe e Lote continuam idênticos (sem regressão).

### 2. Corrigir o loop de re-enqueue na BibliotecaPage

Em `src/pages/biblioteca/BibliotecaPage.tsx`:

- Remover o bloco que chama `setTimeout(refetch, 500)` durante o render (linhas 85-87) — isso é antipattern e causa o "tremor" da lista.
- Mover a sincronização para um `useEffect` que roda **uma vez por sessão** (com guard `useRef`), não a cada render.
- Ampliar o batch para 200 itens e iterar até esgotar todos os faltantes (em vez de 50 fixos).
- Após sync completo, chamar `refetch()` uma única vez.

### 3. Ajustar `enqueue_biblioteca_doc` para **não resetar status**

Migration nova: alterar a função `ON CONFLICT` para **só atualizar metadados** (titulo, educador_nome, turma_nome) e **preservar `status`, `gerado_em`, `storage_path`** quando o registro já existe. Isso elimina o problema de re-enqueue marcar tudo como pendente novamente.

### 4. Alimentar retroativamente os 20 relatórios faltantes

A correção do item 2 já cuida disso na próxima abertura da página. Adicionalmente, vou disparar uma chamada SQL imediata via migration:

```sql
-- Enfileirar todos os relatórios e planejamentos sem registro na biblioteca
INSERT INTO biblioteca_documentos (tipo, origem_id, ...) 
SELECT 'relatorio', r.id, ... FROM relatorios_atividade r
WHERE NOT EXISTS (SELECT 1 FROM biblioteca_documentos b WHERE b.tipo='relatorio' AND b.origem_id = r.id);
-- idem para planejamentos
```

(Será feito chamando o próprio `enqueue_biblioteca_doc` em loop dentro de uma DO block.)

### 5. Sobre "excluir duplicados em Storage"

**Não há duplicados** nem em Storage (0 objetos) nem na tabela (constraint UNIQUE ativa). O que o usuário percebe como duplicação é o re-render causado pelo bug do item 2. Após corrigir, o efeito visual desaparece. Não é necessária nenhuma exclusão de dados.

### 6. Botões de exportar em Detalhe/Lote

**Sem mudanças necessárias.** Eles já chamam `saveAs` diretamente e continuam baixando pelo navegador independentemente da Biblioteca. Apenas confirmo no plano que o comportamento atual é mantido.

## Arquivos afetados

- `src/lib/bibliotecaDocx.ts` — remover `captureBlob`, usar builders diretos
- `src/hooks/useDocumentExport.ts` — extrair `buildRelatorioDocxBlob` e `buildPlanejamentoDocxBlob` reutilizáveis
- `src/pages/biblioteca/BibliotecaPage.tsx` — corrigir loop de sync, mover para `useEffect` com guard
- Nova migration SQL — atualizar `enqueue_biblioteca_doc` para preservar status, e DO block para enfileirar os 20 faltantes

## Resultado esperado

- Download pela Biblioteca volta a funcionar (sem o erro de `saveAs` getter)
- Lista da Biblioteca para de "tremer"/duplicar visualmente
- Os 20 relatórios faltantes aparecem automaticamente
- Botões "Exportar .docx" em Detalhe / Lote continuam baixando pelo navegador como sempre
- Status `gerado` deixa de ser revertido a `pendente` em cada visita
