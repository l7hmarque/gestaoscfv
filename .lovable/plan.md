## Registros Fotográficos — função comum a todos

Nova entrada **"Registros Fotográficos"** na seção **Principal** do menu lateral (`/registros-fotograficos`), com upload para Google Drive (pasta `MMM-AAAA` automática) + publicação automática no Feed/Mural.

### 1. Menu lateral

- Adicionar item em `AppSidebar.tsx` → grupo **Principal**: "Registros Fotográficos" (ícone `Camera`), rota `/registros-fotograficos`.
- Acesso a todos os perfis autenticados (educador, oficineiro, equipe técnica, motorista, cozinheiro, coordenação).

### 2. Página `/registros-fotograficos`

Duas seções:

- **Upload** (dropzone múltiplo, aceita JPG/PNG/HEIC, compressão client-side > 1600px / 85%):
  - Campos opcionais: 
    - Atividade/Oficina relacionada (combobox de relatórios recentes do próprio usuário, ou turma)
    - Descrição breve (textarea, máx. 280 char)
    - Marcar profissionais (multi-select de `profiles` ativos)
  - Botão "Enviar" → faz upload em paralelo, mostra progresso.
- **Galeria** (grid responsivo, paginada):
  - Filtros: mês, autor, turma/atividade
  - Cada card mostra thumb, autor, data, marcações; click abre modal com foto em alta + metadados + link Drive.
  - Coordenação pode excluir; autor pode editar descrição/marcações.

### 3. Backend — tabela `registros_fotograficos`

Campos: `id`, `autor_id` (profiles), `arquivo_url` (link público Drive), `drive_file_id`, `drive_folder_id`, `nome_arquivo` (padrão `registrosFotograficos_mmm-aa_N.jpg`), `mes_ref` (text `mmm-aaaa`), `seq` (int, contagem do mês), `descricao`, `relatorio_id` (nullable), `turma_id` (nullable), `profissionais_marcados` (uuid[]), `tamanho_bytes`, `created_at`.

- RLS: SELECT para todos autenticados; INSERT autor=self; UPDATE/DELETE pelo autor ou coordenação.
- Trigger `BEFORE INSERT` calcula `seq = COUNT(*)+1` do mesmo `mes_ref` (lock por advisory) e monta `nome_arquivo`.

### 4. Edge Function `upload-registro-fotografico`

Recebe `{ file_base64, mime, descricao?, relatorio_id?, turma_id?, profissionais_marcados? }` em chunks de 8KB.

- Garante pasta raiz "SysCFV - Registros Fotográficos" no Drive (cacheia id em `drive_folder_cache`).
- Garante subpasta `MMM-AAAA` (ex.: `MAI-2026`) — cria se não existir.
- Calcula próximo `seq` via INSERT na tabela (que retorna `nome_arquivo`).
- Faz upload multipart para Drive (gateway `google_drive`), define permissão `reader/anyone`, salva `webViewLink` e `id` na linha.
- Cria `feed_posts` (tipo `foto`, autor=mesmo profile, texto=descricao) + `feed_fotos` (url Drive) → aparece automaticamente no Feed/Mural existente.
- Em caso de erro no Drive, faz rollback da linha.

### 5. FAB

Adicionar atalho "Novo Registro Fotográfico" em `FloatingActionButton.tsx` apontando para `/registros-fotograficos`.

### 6. Auditoria

Tabela entra no trigger `fn_audit_changes` já existente para coordenação acompanhar.

### Estrutura técnica

```text
src/pages/registros-fotograficos/
  RegistrosFotograficosPage.tsx       (upload + galeria)
  components/UploadDropzone.tsx
  components/RegistroCard.tsx
src/hooks/useRegistrosFotograficos.ts
supabase/functions/upload-registro-fotografico/index.ts
supabase/migrations/<ts>_registros_fotograficos.sql
```

### Pré-requisito

Conexão **Google Drive** já existe no projeto (usada por `sync-drive-modelos`). A função usará o mesmo gateway via `GOOGLE_DRIVE_API_KEY`. Sem novas chaves necessárias.

### Perguntas rápidas antes de implementar

1. **Visibilidade da galeria**: todos veem tudo, ou cada usuário só vê os próprios + os em que foi marcado? (Coordenação sempre vê tudo.) todos veem tudo. 
2. **Limite por upload**: posso limitar a 10 fotos por envio e 8MB por foto (após compressão)? sim!
3. **Pasta Drive raiz**: posso criar/usar a pasta `SysCFV - Registros Fotográficos` na raiz do Drive conectado, ou prefere subpasta de outra pasta já existente? sim, apenas classifique por mes e ano o nome das pastas e padronize o nome das fotos.
4. **Publicação no Feed**: cria 1 post com todas as fotos do envio (galeria), ou 1 post por foto? cria 1 pont com todas as fotos, formato de carrocel. 