## Plano final validado — helpers globais com escopo cirúrgico

Auditei cada premissa contra o código real (4 sites de `toISOString`, 8 de `format(new Date())`, 81 de `error.message`, 4 de `normalize("NFD")`, e os 3 fixes já aplicados). Os riscos identificados na revisão crítica anterior se confirmaram, e o escopo abaixo está calibrado para **não quebrar nada do que já funciona hoje**.

---

### Garantias contra regressão


| Risco potencial                                                              | Mitigação aplicada no plano                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UPDATE parcial apagaria colunas se `undefined → null`                        | `sanitizeEmptyStrings` só toca `""`. `undefined` permanece intacto (JSON.stringify omite).                                                                                                                      |
| Trocar fuso UTC→local nos 4 sites de `toISOString` quebraria queries         | Esses 4 sites **não são tocados**. Helper novo é nomeado `todayLocalISO` (explícito) e só substitui os 8 `format(new Date(), "yyyy-MM-dd")` que já são locais.                                                  |
| `handleSupabaseError` esconderia stack para dev                              | Helper **sempre** chama `console.error("[supabase]", error)` antes de retornar a mensagem amigável.                                                                                                             |
| i18n quebrado com mensagens em PT-BR hardcoded                               | Mensagens vão para `pt-BR.json`/`en-US.json`/`es-AR.json`/`it-IT.json` sob `errors.db.*`. Fallback = `error.message` cru.                                                                                       |
| Migrar 55 call sites de `error.message` de uma vez = alto risco de regressão | **Não migrar em massa.** H2 só é aplicado nos 3 arquivos já em foco (`EquipeTecnicaPage`, `TurmaDetalhePage`, `ParticipantePerfilPage`) + criar o helper. Os outros 50+ ficam para migração futura caso a caso. |
| `toTitleCase` em particulas PT (`"Joao Dos Santos"`)                         | Helper `toNomeProprio` com lista de partículas. Mas **só extrai** o que já existe em `ParticipantePerfilPage:49` — comportamento idêntico ao atual.                                                             |
| Inconsistência cadastro novo (CAIXA ALTA) vs perfil (Title Case)             | **Não resolvida nesta entrega.** Decisão fora de escopo.                                                                                                                                                        |


---

### Arquivos a criar

1. `**src/lib/dbPayload.ts**` (novo)
  ```ts
   export function sanitizeEmptyStrings<T extends Record<string, any>>(
     payload: T,
     fields: string[]   // ← obrigatório, lista explícita
   ): T {
     const out: any = { ...payload };
     for (const k of fields) {
       if (out[k] === "") out[k] = null;
       // undefined NÃO é tocado — preserva semântica de UPDATE parcial
     }
     return out;
   }
  ```
2. `**src/lib/supabaseErrors.ts**` (novo)
  ```ts
   import i18n from "@/i18n";
   export function handleSupabaseError(error: any, fallback?: string): string {
     console.error("[supabase]", error);  // dev sempre vê o erro cru
     const code = error?.code;
     const key = `errors.db.${code}`;
     const translated = i18n.t(key, { defaultValue: "" });
     return translated || fallback || error?.message || "Erro desconhecido";
   }
  ```
   Cobre códigos: `22007` (data inválida), `22P02` (uuid/enum inválido), `23502` (NOT NULL), `23503` (FK), `23505` (unique), `42501` (RLS), `PGRST116` (no rows), `PGRST301` (JWT).

### Arquivos a editar (mudanças aditivas — não removem nada)

3. `**src/lib/formatDate.ts**` — adicionar `todayLocalISO()` e `todayUTCISO()`. Não tocar funções existentes.
4. `**src/lib/utils.ts**` — adicionar `stripAccents()` e `toNomeProprio()`. Não tocar `cn()` existente.
5. `**src/i18n/locales/*.json**` (4 arquivos) — adicionar bloco `errors.db.*` com 8 chaves.

### Aplicação cirúrgica (apenas os 3 arquivos já em foco)

6. `**ParticipantePerfilPage.tsx**` — substituir o loop inline `NULLABLE_EMPTY_FIELDS` por `sanitizeEmptyStrings(payload, FIELDS)`. Substituir `toTitleCase` local por import de `@/lib/utils`. Substituir o `toast.error` do save por `handleSupabaseError`.
7. `**TurmaDetalhePage.tsx**` — substituir loop inline por `sanitizeEmptyStrings`. Manter os outros `toast.error(error.message)` deste arquivo intactos (estão fora do escopo do bug original).
8. `**EquipeTecnicaPage.tsx**` — substituir loop inline por `sanitizeEmptyStrings`. Manter os outros 9 `toast.error` deste arquivo intactos.

### Fora desta entrega (decisões/riscos pendentes)

- 50+ call sites de `error.message` em outros arquivos — migração futura, 1 PR por arquivo, opcional.
- 4 sites de `toISOString().split("T")[0]` — exigem decisão por arquivo sobre semântica UTC vs local.
- Padronização CAIXA ALTA vs Title Case em nomes de participantes — aguarda decisão.
- Edge functions (Deno) — `handleSupabaseError` é client-only por design.
- Helper `upsertTurmaParticipantes` (H6) — descartado, ganho desprezível.

---

### Validação pós-implementação

- TypeScript compila (build automático do harness).
- Os 3 fluxos onde o bug original ocorria continuam funcionando (Bairro do participante, edição de turma, encaminhamento externo).
- Console mostra erros crus em qualquer falha de Supabase (verificável via DevTools).
- Nenhuma string traduzida quebra com fallback para `error.message`.

### O que **não** muda no sistema

- Nenhum arquivo de `supabase/migrations/*` é tocado.
- Nenhuma RLS, GRANT, edge function ou tipo gerado é alterado.
- Nenhuma rota, layout, componente UI ou estilo é tocado.
- Nenhum dos 50+ outros call sites de `error.message` é afetado.
- Performance idêntica (helpers são funções puras síncronas).

### Confirmação solicitada

Posso implementar com este escopo cirúrgico, ou prefere ampliar (migrar os 50+ `error.message` agora) / reduzir (só criar os helpers sem aplicar)? implemente o escopo cirurgico.