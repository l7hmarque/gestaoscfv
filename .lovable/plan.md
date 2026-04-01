

## Plano: Remover bairros duplicados no filtro de participantes

### Problema
O banco de dados contém bairros com nomes em caixa mista (ex: "Jardim Irene") e em maiúscula ("JARDIM IRENE"). A função `isBairroSCFV` usa comparação case-insensitive, então ambos passam no filtro — gerando duplicatas no dropdown.

### Correção em `src/pages/participantes/ParticipantesPage.tsx` (linha 99)

Adicionar um filtro extra que aceita **apenas bairros cujo nome é exatamente igual a um dos `BAIRROS_SCFV`** (comparação exata, case-sensitive):

```typescript
{bairros
  .filter((b) => BAIRROS_SCFV.includes(b.nome))
  .map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
```

Isso garante que só os registros em caixa alta ("JARDIM IRENE", "PARQUE INDEPENDENCIA", "ALVORADA") apareçam, eliminando as versões em caixa mista.

Será necessário importar `BAIRROS_SCFV` diretamente de `@/lib/constants`.

| Arquivo | Mudança |
|---|---|
| `src/pages/participantes/ParticipantesPage.tsx` | Trocar `isBairroSCFV` por `BAIRROS_SCFV.includes` no filtro de bairros |

