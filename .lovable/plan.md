## Causa raiz

Em `src/pages/participantes/ParticipantePerfilPage.tsx`, no `handleSave`:

```ts
const payload: Record<string, unknown> = { ...form }; // spread de TODOS os 44 campos
["bairro_id", "ponto_transporte_id", "data_nascimento", "iniciou_em", "data_desligamento"]
  .forEach((k) => { if (!payload[k]) payload[k] = null; }); // só 5 campos
```

A tabela `participantes` tem outros campos de data/timestamp/uuid que **não estão nessa lista**:

- `busca_ativa_desde` (timestamptz)
- `desligado_registrado_em` (timestamptz)

Se qualquer um deles estiver como `""` no estado do form (acontece quando o componente que renderiza passa string vazia, ou quando algum outro lugar do app gravou string vazia em vez de null), o Postgres rejeita o UPDATE inteiro com:

```
invalid input syntax for type timestamp with time zone: ""
```

A edição do "Bairro do CAIA" só **disparou** o save — a coluna problemática é outra, no mesmo payload.

## Correção

Trocar a lista hardcoded por uma **normalização genérica**: percorrer todas as chaves do payload e converter `""` → `null` em **qualquer** campo de data, timestamp ou uuid. Isso resolve o erro atual e blinda contra novos campos adicionados no futuro.

Implementação (1 arquivo, ~10 linhas):

`src/pages/participantes/ParticipantePerfilPage.tsx`, substituir o bloco da linha 160–161 por:

```ts
// Normaliza "" → null em campos de data/timestamp/uuid (Postgres rejeita "" nesses tipos)
const NULLABLE_EMPTY_FIELDS = [
  "bairro_id", "ponto_transporte_id",
  "data_nascimento", "iniciou_em", "data_desligamento",
  "busca_ativa_desde", "desligado_registrado_em",
];
NULLABLE_EMPTY_FIELDS.forEach((k) => {
  if (payload[k] === "" || payload[k] === undefined) payload[k] = null;
});
```

Cobre os campos atuais e os dois timestamps que estavam faltando.

## Validação

Você reabre o perfil do participante, edita o Bairro, clica Salvar. Toast verde = ok.

Se aparecer o mesmo erro mencionando **outra coluna** (improvável, mas possível), você me cola a nova mensagem e eu adiciono à lista.

## Fora de escopo

- Os outros 2 fluxos que você mencionou (cadastrar novo, adicionar em turma, novo relatório) provavelmente têm causas independentes. Esse fix corrige especificamente o erro de **edição** que você acabou de reproduzir. Depois você testa os outros e, se ainda houver erro, me manda a mensagem que aparecer.
