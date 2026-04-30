## Objetivo

Permitir que o motorista confirme **embarcou / não embarcou** mesmo sem internet no caminho. As ações são salvas localmente no celular e sincronizadas automaticamente assim que o sinal voltar — sem perder nenhuma confirmação.

## Estratégia (resumo)

1. **PWA instalável** — para o motorista "instalar" o sistema no celular e o app continuar abrindo sem rede.
2. **Cache offline da página de transporte** — service worker guarda o app shell + dados do dia.
3. **Fila local de ações (IndexedDB)** — toda confirmação feita offline vira um item na fila local.
4. **Sincronização automática** — assim que detectar internet, a fila é enviada para o backend (`participante_checkins`) na ordem em que foi feita.
5. **UI clara de status** — badges mostrando "Offline", "Pendente sincronizar", "Sincronizado".

## O que será feito

### 1. Instalar PWA (vite-plugin-pwa)
- Configurar `vite.config.ts` com `VitePWA`, manifest (nome "SysCFV", ícones, tema preto/cinza), `registerType: "autoUpdate"`.
- Estratégia Workbox:
  - **App shell** (HTML/CSS/JS): `NetworkFirst` com fallback para cache.
  - **Endpoints Supabase de leitura do transporte do dia**: `StaleWhileRevalidate` com TTL de 24 h.
- Adicionar `navigateFallbackDenylist: [/^\/~oauth/, /^\/api/]` para não quebrar OAuth.
- Criar página `/install` simples explicando "Adicionar à tela inicial" no Android/iOS.
- Adicionar meta tags mobile no `index.html` (apple-touch-icon, theme-color preto).

### 2. Camada offline-first para check-ins
- **Novo arquivo `src/lib/offlineQueue.ts`**:
  - Usa IndexedDB (via `idb`) com store `transporte_pendentes`.
  - Cada item: `{ id_local, participante_id, data, periodo, embarcou, embarcou_em, criado_em, tentativas, status }`.
  - API: `enfileirar()`, `listarPendentes()`, `marcarSincronizado()`, `incrementarTentativa()`.
- **Novo `src/hooks/useTransporteOffline.ts`**:
  - Detecta `navigator.onLine` + listeners `online/offline`.
  - Faz merge dos check-ins do servidor com os pendentes locais para a UI mostrar tudo unificado.
  - Expõe `marcarEmbarque(participanteId, embarcou)` que:
    - Se online: salva direto no Supabase (comportamento atual).
    - Se offline: enfileira em IndexedDB e atualiza UI otimisticamente.
- **Sincronização automática**:
  - Ao voltar online, processa fila em ordem cronológica via `upsert` em `participante_checkins` usando chave `(participante_id, data, periodo)`.
  - Em caso de erro, mantém na fila (max 5 tentativas) e mostra toast.
  - Também tenta sincronizar a cada 30 s enquanto a aba estiver aberta.

### 3. Cache dos dados do dia para uso offline
- Quando o motorista abre a página com internet:
  - Buscar pontos, participantes ativos por ponto e check-ins do dia → salvar snapshot em IndexedDB (`transporte_snapshot_dia`).
- Quando offline:
  - `DashboardTransporteTab` carrega do snapshot local; mostra badge "Modo offline — dados de HH:MM".

### 4. UI de feedback no `DashboardTransporteTab.tsx`
- Indicador no topo: 🟢 **Online** / 🔴 **Offline** / 🟡 **N pendentes sincronizando**.
- Em cada participante com check-in feito offline: badge pequeno "⏳ Aguardando envio".
- Botão manual **"Sincronizar agora"** quando houver pendências.
- Toast ao concluir sincronização: "X embarques sincronizados".

### 5. Backend (mínimo)
- Garantir índice/constraint de unicidade em `participante_checkins(participante_id, data, periodo)` — necessário para o `upsert` do sync funcionar sem duplicar (verificar migration; se não existir, criar).

## Detalhes técnicos

- **Dependências novas**: `vite-plugin-pwa`, `workbox-window`, `idb`.
- **Arquivos novos**:
  - `src/lib/offlineQueue.ts`
  - `src/lib/transporteSnapshot.ts`
  - `src/hooks/useTransporteOffline.ts`
  - `src/pages/InstallPage.tsx` (rota `/install`)
  - `public/icon-192.png`, `public/icon-512.png` (ícones PWA preto/branco)
- **Arquivos editados**:
  - `vite.config.ts` (plugin PWA)
  - `index.html` (meta tags)
  - `src/App.tsx` (rota `/install` + registro do SW)
  - `src/pages/dashboard/DashboardTransporteTab.tsx` (usar hook offline + UI status)
- **Migration** (se necessária): unique constraint em `participante_checkins(participante_id, data, periodo)`.

## Limitações conhecidas (a comunicar ao motorista)

- O motorista precisa abrir a página **uma vez com internet no início do dia** para baixar a lista de paradas/participantes do dia.
- iOS: a instalação na tela inicial é via Safari → Compartilhar → "Adicionar à Tela de Início".
- Após instalar, o ícone do SysCFV abre direto em tela cheia, igual a um app.

## Próximos passos após aprovação

Implemento PWA + fila offline + UI, e instruo você a abrir a página uma vez com internet para o cache inicial. Depois é só testar colocando o celular em modo avião e marcando embarques.
