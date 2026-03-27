

## Plano: Scan de Documentos com Câmera → PDF

### Ideia central
Ao clicar "Escanear" em qualquer categoria de documento, o sistema abre a câmera do celular. O usuário tira a foto do documento, e o sistema **converte automaticamente a imagem em PDF** antes de fazer o upload. Fotos adicionais podem ser adicionadas ao mesmo PDF (scan multi-página).

### Funcionalidades

1. **Captura via câmera** — Botão "Escanear" usa `<input type="file" accept="image/*" capture="environment">` para abrir a câmera traseira do dispositivo
2. **Conversão imagem → PDF** — Usa `jsPDF` (já instalado) para converter a foto capturada em um PDF A4, centralizando a imagem e mantendo proporção
3. **Scan multi-página** — Após a primeira foto, o usuário pode "Adicionar página" para capturar mais fotos e juntar tudo em um único PDF
4. **Upload manual** — Botão "Upload" continua aceitando PDF ou imagem diretamente (imagens também convertidas para PDF)
5. **Categorias** — Ficha de Inscrição, Laudo Médico, Receita de Medicamento, Comprovante Escolar, Termo de Autorização de Imagem, Outro
6. **Tabela `participante_documentos`** — Registra cada documento com categoria, nome, URL e data
7. **Gestão no perfil** — Seção "Documentos" na página do participante para visualizar, adicionar e excluir documentos por categoria

### Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `participante_documentos` com RLS |
| `src/hooks/useDocumentScanner.ts` | Criar — hook com lógica de captura câmera + conversão imagem→PDF via jsPDF |
| `src/pages/participantes/ParticipanteNovoPage.tsx` | Refatorar seção de documentos para upload/scan categorizado |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Adicionar seção "Documentos" com listagem, scan, upload e exclusão |

### Fluxo do scan
1. Usuário clica "Escanear" na categoria desejada
2. Câmera abre (celular) ou seletor de arquivo (desktop)
3. Foto capturada → `jsPDF` cria um PDF A4 com a imagem ajustada
4. Opção "Adicionar página" para scan multi-página (cada foto vira uma página do mesmo PDF)
5. "Finalizar" → upload do PDF ao bucket `documentos/{participante_id}/{categoria}_{timestamp}.pdf` + registro na tabela

### Detalhes técnicos
- Conversão usa `jsPDF` + `addImage()` com redimensionamento proporcional para A4
- Imagens comprimidas via Canvas (`toDataURL('image/jpeg', 0.85)`) antes de inserir no PDF
- `<input capture="environment">` garante câmera traseira no mobile
- Nomenclatura: `SysELO_Doc_{categoria}_{YYYY-MM-DD}_{HHmmss}.pdf`

