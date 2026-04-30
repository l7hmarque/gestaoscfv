---
name: Transporte offline (motorista)
description: PWA + IndexedDB queue for transport check-ins when motorista has no signal
type: feature
---
A página de transporte (`DashboardTransporteTab`) tem suporte offline para o motorista:

- **PWA** configurado em `vite.config.ts` (vite-plugin-pwa) com `NetworkFirst` para HTML, registro guardado em `src/main.tsx` que **não** ativa SW em iframes ou hosts `lovableproject.com` / `id-preview--*` (preview do editor).
- **Snapshot do dia** salvo em IndexedDB (store `transporte_snapshot`) sempre que `loadCheckinsHoje` roda online; usado como fallback quando offline.
- **Fila local** (store `transporte_pendentes`) em `src/lib/offlineDB.ts`. Cada marcação offline vira um item; `useTransporteOffline` (em `src/hooks/`) detecta `online/offline`, sincroniza via `upsert` em `participante_checkins` (chave `participante_id,data,periodo` — unique constraint já existente), tenta de novo a cada 30s e ao voltar online.
- UI mostra badges Online/Offline + "N aguardando envio" + botão "Sincronizar agora"; cada participante com pendência mostra badge "aguardando envio".
- PWA só funciona no domínio publicado (`gestaoscfv.lovable.app` / domínio próprio), não na preview do editor.
