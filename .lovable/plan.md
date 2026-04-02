

## Plano: Limitar upload a 1 arquivo por categoria + compressão automática

### Resumo

Restringir cada campo de upload a **1 arquivo** por categoria (substituindo se já existir), aceitar apenas **imagem ou PDF**, e aplicar **compressão automática** em imagens antes do envio.

### Mudanças

**1. `src/hooks/useDocumentScanner.ts`** — Nova função utilitária `compressFileForUpload`
- Exportar uma função que recebe um `File` e retorna um `File` comprimido
- Se for imagem: redimensiona (max 1600px), converte para JPEG quality 0.7, retorna como File
- Se for PDF: retorna sem alteração (PDFs já são compactos)
- Limite de 5MB após compressão — rejeita com erro se ultrapassar

**2. `src/pages/matricula/MatriculaPublicaPage.tsx`**
- Remover `multiple` do input de arquivo (linha 640)
- Em `handleFileSelected`: aceitar só 1 arquivo, validar tipo (image/* ou application/pdf), comprimir se imagem, e **substituir** doc existente da mesma categoria (em vez de acumular)
- Badge de contagem mostra apenas "1" ou nada

**3. `src/pages/participantes/ParticipanteNovoPage.tsx`**
- Em `handleUploadFile`: validar tipo, comprimir imagem, substituir doc existente da mesma categoria no array `pendingDocs`

**4. `src/pages/participantes/ParticipantePerfilPage.tsx`**
- Em `handleUploadDoc`: validar tipo, comprimir imagem antes de converter para PDF e fazer upload

### Detalhes técnicos

A compressão usa Canvas API (já presente no `compressImage` existente). A nova função será similar mas retorna `File` em vez de `ScannedPage`, com max dimension reduzido para 1600px e quality 0.7 para melhor compressão. PDFs passam direto sem alteração.

| Arquivo | Mudança |
|---|---|
| `src/hooks/useDocumentScanner.ts` | Exportar `compressFileForUpload(file): Promise<File>` |
| `src/pages/matricula/MatriculaPublicaPage.tsx` | 1 arquivo por categoria, compressão, sem `multiple` |
| `src/pages/participantes/ParticipanteNovoPage.tsx` | 1 arquivo por categoria, compressão |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Compressão antes do upload |

