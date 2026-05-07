
# Integração Google Drive — SysCFV

Sincronização automática de planejamentos, relatórios e fotos para uma conta Google institucional única, com pastas organizadas por profissional e marca d'água de veracidade nas fotos.

## Arquitetura

```text
Conta Google da OSC (1 conexão Lovable Cloud)
└── SysCFV/
    ├── Profissionais/
    │   └── {Nome do Educador}/
    │       ├── Planejamentos/   → Google Docs nativos
    │       └── Relatórios/      → Google Docs nativos
    └── Registros Fotográficos/
        └── {YYYY-MM mês}/       → JPG com marca d'água
```

**Fluxo:** salvar relatório/planejamento → trigger no banco enfileira job → Edge Function processa em background → cria/atualiza Google Doc + envia fotos com watermark → grava `drive_file_id` e `drive_url` na linha original.

## Etapa 1 — Conexão Google Drive + Google Docs

- Conectar os connectors `google_drive` e `google_docs` (1 conta institucional única).
- Secrets ficam disponíveis automaticamente nas Edge Functions via gateway Lovable.
- Não há OAuth por usuário — toda escrita usa a conta da OSC.

## Etapa 2 — Schema de sincronização

Nova tabela `drive_sync_queue`:
- `id`, `tipo` (`planejamento` | `relatorio` | `foto`), `origem_id`, `status` (`pendente`|`processando`|`sincronizado`|`erro`), `drive_file_id`, `drive_url`, `tentativas`, `ultimo_erro`, `created_at`, `synced_at`.

Colunas adicionadas:
- `planejamentos.drive_file_id`, `planejamentos.drive_url`
- `relatorios_atividade.drive_file_id`, `relatorios_atividade.drive_url`
- `relatorio_fotos.drive_file_id`, `relatorio_fotos.drive_url`, `relatorio_fotos.veracidade_hash`, `relatorio_fotos.exif_metadata` (jsonb)

Triggers: ao `INSERT/UPDATE` em planejamentos/relatórios/fotos → enfileira em `drive_sync_queue`.

Cache de pastas — tabela `drive_folder_cache` (`profile_id`, `tipo`, `folder_id`) para evitar recriar pastas.

## Etapa 3 — Edge Function `drive-sync-worker`

Processa fila em background. Para cada job:

1. Resolve hierarquia de pastas (cria sob demanda, com cache):
   - `SysCFV/Profissionais/{Nome}/Planejamentos|Relatórios/`
   - `SysCFV/Registros Fotográficos/{YYYY-MM}/`
2. **Planejamento/Relatório → Google Doc nativo:**
   - Cria doc via `POST /documents` (Google Docs API).
   - Move para a pasta correta via Drive API (`addParents`).
   - Insere conteúdo com `batchUpdate`: título, metadados (educador, turma, data), seções (tema, objetivos, roteiro, materiais, presença, fotos como links, etc).
   - Update incremental: se já existe `drive_file_id`, faz `deleteContentRange` + reinserção.
3. **Foto → upload com watermark** (ver Etapa 4).
4. Grava `drive_file_id`/`drive_url` no registro original e marca job como `sincronizado`.

Nomes padronizados:
- Doc: `SysCFV_Relatorio_{YYYY-MM-DD}_{Titulo}_{Educador}`
- Foto: `SysCFV_Foto_{YYYY-MM-DD}_{Educador}_{Turma}_{HHmmss}_{hash8}.jpg`

Acionamento: trigger HTTP via `pg_net` quando há novos jobs + botão manual "Sincronizar agora" no detalhe.

## Etapa 4 — Marca d'água de veracidade nas fotos

Edge Function `process-foto-watermark` (chamada pelo worker):

1. Baixa a foto do Supabase Storage.
2. Extrai EXIF com `npm:exifr` — captura GPS (lat/long), data/hora original, modelo da câmera. Persiste em `relatorio_fotos.exif_metadata`.
3. Resolve **Local da foto**: reverse geocoding via Nominatim/OpenStreetMap (sem API key). Fallback: bairro do relatório.
4. Gera **código de veracidade** = SHA-256 dos bytes originais + educador_id + relatorio_id + timestamp → hash de 16 chars. Salvo em `veracidade_hash`.
5. Aplica watermark sutil com `npm:@napi-rs/canvas` (suportado em Deno):
   - Faixa semitransparente no rodapé (preto 40% opacidade, ~6% da altura).
   - Texto branco pequeno: `📍 {Local} • {DD/MM/YYYY HH:mm} • {lat,long se houver} • #{hash}`.
   - Discreto, não polui a foto.
6. Faz upload ao Drive na pasta `Registros Fotográficos/{YYYY-MM}/`.

Tela pública futura `/verificar/{hash}` (fora deste plano) poderá confirmar autoria.

**Fallback**: foto sem EXIF/GPS → usa só data do relatório + bairro da turma + hash. Watermark sempre é aplicada.

## Etapa 5 — UI

- **Detalhe de Relatório/Planejamento:** badge "📄 Aberto no Drive" (link) ou "⏳ Sincronizando..." ou "⚠️ Erro" (com retry).
- **Botão "Abrir no Google Docs"** ao lado de "Imprimir" / "Exportar".
- **Galeria de fotos:** ícone Drive em cada foto + tooltip com hash de veracidade.
- **Configurações → Integrações → Google Drive:** mostra status da conexão, contador de fila pendente, botão "Reprocessar erros".

## Detalhes Técnicos

- **Conversão Doc:** mapeia conteúdo institucional direto para `batchUpdate` (sem passar por HTML). Mantém estilo grayscale do SysCFV via `updateTextStyle`/`updateParagraphStyle` (negrito títulos, headings H1/H2).
- **Idempotência:** worker usa `drive_file_id` existente; nunca duplica.
- **Rate limiting:** processa máx. 10 jobs/invocação, com backoff (`tentativas` até 5).
- **Background:** worker invocado via `EdgeRuntime.waitUntil` para não bloquear UI; trigger pg via `pg_net.http_post`.
- **Apenas conta institucional:** RLS impede usuários comuns de ver `drive_sync_queue` (só coordenação/dev).
- **Sem OAuth por usuário:** sem login Google adicional para educadores.

## Limitações conhecidas

- Reverse geocoding gratuito (Nominatim) tem rate limit ~1 req/s — adicionamos pequeno delay no worker.
- Fotos sem GPS no EXIF (comum em WhatsApp) ficam sem coordenadas; watermark mostra apenas data/local da turma + hash.
- Quota Google Drive API: 1 bilhão de requisições/dia/projeto — não é limite real para o uso institucional.
- Conta única significa que se o token Google for revogado, toda sincronização para até reconectar.
