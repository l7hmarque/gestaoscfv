## Por que Resumo mostra 86 e Metas mostra 319

São duas lógicas diferentes contando a mesma população:

**Resumo — "ATENDIDOS NO MÊS" = 86** (`generate-relatorio-mensal/index.ts:294`)
```ts
const atendidosIds = new Set(activePresencas.filter(p => p.presente).map(p => p.participante_id));
```
→ `Set` de **participante_id único** em todo o mês. Cada pessoa conta **1 vez**, não importa quantas turmas/bairros frequentou.

**Metas — "Total" = 319** (`generate-relatorio-mensal/index.ts:487–527`)
```ts
bairroStats[bairroNome].criancasManha.add(pres.participante_id);
// ...
totalCriancas += (cm + ct);  // por bairro
```
→ `Set` por **bairro × período**, depois somado entre os 3 bairros. Causa **3 inflagens**:

1. **Mesmo participante em bairros diferentes** conta múltiplas vezes (ex.: criança em uma atividade no JARDIM IRENE e outra no PARQUE INDEPENDÊNCIA = 2).
2. **Período `integral`** soma a mesma criança em `criancasManha` E `criancasTarde` → conta **2x dentro do mesmo bairro** (linhas 512–513).
3. **Sub-total "Total crianças" por bairro** soma `cm + ct` sem deduplicar o caso integral, e o "TOTAL GERAL" soma esses sub-totais inflados.

86 × ~3,7 = 319 — bate com participantes que apareceram em turmas de bairros diferentes ao longo do mês.

---

## O que vou alterar

### 1. Remover `integral` do sistema (você não trabalha com ele)

**Edge `generate-relatorio-mensal/index.ts`:**
- Linhas 512–513: remover ramo `periodo === "integral"`. Período passa a ser estritamente `manha` ou `tarde`.
- Linha 330 (`periodoLabelMap`): remover case `"integral"`.

**Front:**
- `src/pages/presenca/PresencaPage.tsx` linha ~209: remover `<SelectItem value="integral">Integral</SelectItem>`.
- Buscar outras ocorrências (`rg "integral"`) em `TurmaNovaPage`, `TurmaDetalhePage`, `MatriculaPublicaPage`, constants — remover opção dos selects e dos rótulos. **Não** mexer em dados antigos no banco (turmas legadas com `periodo='integral'` continuam existindo); apenas a UI deixa de oferecer e os relatórios passam a tratar como `manha` (fallback seguro: se vier `integral`, contar só como `manha`).

### 2. Corrigir contagem de atendidos na aba Metas

Trocar a contagem por **bairro de residência do participante** (não bairro da turma) e deduplicar globalmente:

```ts
// pseudo-código novo (substitui linhas 487–530)
const atendidosUnicos = new Set(activePresencas.filter(p => p.presente).map(p => p.participante_id));
const bairroStats = {/* manha:Set, tarde:Set, idosos:Set por bairro */};

atendidosUnicos.forEach(pid => {
  const part = partMap.get(pid);
  const bairroNome = bairroMap.get(part.bairro_id);     // bairro do PARTICIPANTE
  if (!BAIRROS_SCFV.includes(bairroNome)) return;
  const isIdoso = calcAge(part.data_nascimento) >= 60;
  const periodo = part.periodo === "tarde" ? "tarde" : "manha"; // integral → manha
  if (isIdoso) bairroStats[bairroNome].idosos.add(pid);
  else if (periodo === "tarde") bairroStats[bairroNome].criancasTarde.add(pid);
  else bairroStats[bairroNome].criancasManha.add(pid);
});
```

Resultado: cada participante aparece **uma única vez** no Metas, no seu bairro de cadastro, no seu período. O somatório `cm + ct + idosos` entre os 3 bairros vai bater exatamente com os 86 do Resumo (+ idosos, se houver).

### 3. Espelhar a mesma correção em

- `src/hooks/useRelatorioGestao.ts` (mesma lógica de Metas no Relatório de Gestão PDF/XLSX).
- `supabase/functions/generate-relatorio-gdoc/index.ts` se replicar a contagem.

### 4. QA

Rodar o Relatório Mensal de Maio/2026 e conferir: total da aba Metas (manha + tarde + idosos somados nos 3 bairros) = ATENDIDOS NO MÊS do Resumo. Validar Presença Digital sem a opção Integral.

---

## Fora de escopo

- Não mexo em dados históricos (`turmas.periodo = 'integral'` existentes permanecem; só somem da UI e são tratadas como `manha` nos relatórios).
- Não mudo a regra do Resumo (já está correta).
- Não mexo nas listas de frequência mensais (Sheets) — período `manha`/`tarde` já é tratado lá sem `integral` na coluna de filtros.

Confirma para eu seguir?
