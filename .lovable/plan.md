## Levantamento de bugs do mesmo tipo

O erro original (`invalid input syntax for type timestamp with time zone: ""`) é um caso de **string vazia enviada ao Postgres para uma coluna tipada (date / timestamp / uuid / numeric)**. O Postgres aceita `null`, mas **rejeita `""`** com erros `22007` (date/timestamp) ou `22P02` (uuid/numeric).

Fiz uma varredura nos 46 arquivos do `src/` que fazem `.update()`/`.insert()`/`.upsert()` no banco. Achei **3 bugs ativos** e **1 ponto de atenção**.

### 1. `src/pages/participantes/ParticipantePerfilPage.tsx` — JÁ CORRIGIDO ✅

Já foi resolvido na última iteração. Não precisa de mais nada.

### 2. `src/pages/turmas/TurmaDetalhePage.tsx` (linhas 170–183) — RISCO BAIXO

```ts
const payload: Record<string, unknown> = { ...form };
if (!payload.bairro_id) payload.bairro_id = null;
if (!payload.educador_id) payload.educador_id = null;
if (!payload.faixa_etaria) payload.faixa_etaria = null;
```

**O que faz:** spread de todo o form da turma para um UPDATE em `turmas`.

**Por que está OK hoje:** o `form` da turma só tem 12 chaves conhecidas (`nome`, `periodo`, `faixa_etaria`, `faixas_etarias`, `tipo`, `bairro_id`, `bairro_ids`, `educador_id`, `dias_semana`, `ativa`, `oficina`, `nome_grupo`). Os 2 UUIDs já são nullificados; os enums (`periodo`, `tipo`) sempre vêm do Select com valor válido.

**Por que merece blindagem:** se amanhã alguém adicionar um campo `data_inicio` / `data_fim` / `prazo` no form ou na tabela e esquecer de tratá-lo, o bug reaparece exatamente como aconteceu em participantes.

**Correção:** trocar o bloco por normalização genérica:

```ts
const NULLABLE_EMPTY_FIELDS = ["bairro_id", "educador_id", "faixa_etaria"];
NULLABLE_EMPTY_FIELDS.forEach(k => { if (payload[k] === "" || payload[k] === undefined) payload[k] = null; });
```

**Impacto:** zero comportamental hoje, defensivo.

### 3. `src/pages/equipe-tecnica/EquipeTecnicaPage.tsx` (linhas 370–388) — BUG ATIVO

```ts
const payload: any = {
  ...encForm,                                  // <- spread de TODO encForm
  profissional_id: myProfileId,
  data_retorno: encForm.data_retorno || null,  // só este tratado
};
// usa em update E insert de encaminhamentos_externos
```

**O que faz:** salva encaminhamentos externos para CRAS / CRAS / saúde etc.

**Bug:** `encForm` tem `data_encaminhamento` (date, sempre inicializada como hoje, mas **editável**). Se o usuário limpar o input ao editar um encaminhamento, vira `""` e o UPDATE quebra com o mesmo `invalid input syntax for type date: ""`.

**Correção:** aplicar normalização a `data_encaminhamento` e `data_retorno`:

```ts
const payload: any = {
  ...encForm,
  profissional_id: myProfileId,
  data_encaminhamento: encForm.data_encaminhamento || null,
  data_retorno: encForm.data_retorno || null,
};
```

(`data_encaminhamento` é `NOT NULL` no banco — se chegar `null`, o erro vira "violates not-null constraint", que é uma mensagem clara em vez de um erro de sintaxe críptico. Pode-se adicionar um `toast.error("Data do encaminhamento obrigatória")` antes do save, conforme a validação que já existe na linha 370.)

**Impacto:** afeta SÓ o fluxo de criar/editar encaminhamentos externos (Equipe Técnica). Hoje pode estar quebrando silenciosamente para usuários que editam encaminhamentos antigos e tentam limpar a data.

### 4. Demais escritas — TODAS LIMPAS

Auditadas linha a linha e usam `field || null` por campo (sem spread perigoso):

- `ParticipanteNovoPage.tsx` ✅
- `RelatorioNovoPage.tsx` ✅
- `RelatorioDetalhePage.tsx` ✅
- `PlanejamentoNovoPage.tsx` / `PlanejamentoDetalhePage.tsx` ✅
- `RoteiroNovoPage.tsx` / `RoteiroDetalhePage.tsx` ✅
- `IntervencaoDialog.tsx` (cronograma) ✅
- `EstoqueTab.tsx` / `CardapioTab.tsx` (cozinha) ✅
- `DashboardProfissionaisTab.tsx` ✅
- `DashboardTransporteTab.tsx` ✅
- `ConfiguracoesPage.tsx` (RH inline — datas + numéricos tratados com `e.target.value || null`) ✅
- `ParticipantesPage.tsx` (status / desligamento / período) ✅
- `RegistrosTab.tsx` (coordenação) ✅
- `SiteAdminPage.tsx` ✅
- `TurmaNovaPage.tsx`, `PainelDesligamentoPage.tsx`, `PermissoesGranularesTab.tsx`, `DevPage.tsx`, `SiteContatoPage.tsx`, `SiteIndicadoresPage.tsx`, `IntegridadePage.tsx`, hooks etc. — sem padrão de risco.

## Plano de aplicação

| # | Arquivo | Mudança | Linhas |
|---|---------|---------|--------|
| 1 | `src/pages/equipe-tecnica/EquipeTecnicaPage.tsx` | Adicionar `data_encaminhamento: encForm.data_encaminhamento \|\| null` no payload de encaminhamentos | ~377 |
| 2 | `src/pages/turmas/TurmaDetalhePage.tsx` | Trocar `if (!payload.X) payload.X = null` por loop genérico em lista nomeada (defensivo, sem mudar comportamento) | 174–176 |

## Impacto da correção

**Em si mesma:**

- Fix 1 (encaminhamentos): garante que limpar a data do encaminhamento ao editar não quebra mais o save. Comportamento de UI inalterado.
- Fix 2 (turmas): zero efeito visível; só blinda contra regressões futuras.

**Em funções vinculadas:**

- Encaminhamentos têm 3 consumidores que apenas leem (`encTimer.stop`, `loadAll`, dashboard de Equipe Técnica). Nenhum depende do payload bruto — só do `id` retornado. Sem impacto.
- Turmas não muda nada (lista de campos é idêntica à condição anterior).

**Fora do escopo:**

- Não vou refatorar os outros 44 arquivos que já estão certos. Mexer neles só por uniformidade adiciona risco de regressão sem ganho.
- Não vou criar um helper global `sanitizeEmptyStrings()` — proposta para uma futura rodada de limpeza, fora do escopo deste fix urgente.

## Validação

1. Equipe Técnica → editar um encaminhamento existente → limpar campo "Data do encaminhamento" → salvar → tem que aparecer toast claro (NOT NULL ou validação pré-save), não mais "invalid input syntax".
2. Editar uma turma normalmente → continua salvando sem alterações de comportamento.
