

## Plano: Filtros na Busca Ativa + Correção de Badge de Status

### Problemas identificados

1. **Filtros insuficientes** — A busca ativa só tem 2 filtros (status genérico e bairro). Faltam filtros por: período (manhã/tarde), faixa etária, turma, quantidade de faltas, e se já teve contato de busca ativa ou não.

2. **Badge incorreto** — Na linha 836, participantes com status `busca_ativa` estão caindo no ramo `else` do ternário (`p.status === "ativo" ? "secondary" : "destructive"`), recebendo badge `destructive` (vermelho = "desligado"). O mesmo ocorre na linha 421-423 que agrupa `inativo` e `desligado` com o mesmo `motivo_alerta: "Desligado/Inativo recente"`. Participantes com `busca_ativa` devem ter badge laranja/amarelo, não vermelho.

### Mudanças

**1. Mais filtros na Busca Ativa** (`EquipeTecnicaPage.tsx`)

Adicionar filtros:
- **Período** (manhã/tarde/integral) — filtra por `p.periodo`
- **Faixa etária** (6-8, 9-11, 12-17, idosos) — derivada de `data_nascimento`
- **Turma** — dropdown com turmas ativas, filtra via `turmaParticipantes`
- **Qtd mínima de faltas** — slider ou select (2, 3, 5, 10+)
- **Contato realizado** — "Todos", "Sem contato", "Com contato" — baseado em `buscaAtivaRegistros`
- **Busca textual** — campo de texto para nome

**2. Corrigir badge de status** (`EquipeTecnicaPage.tsx`)

Na renderização do card (linha 836):
- `busca_ativa` → badge laranja (`bg-orange-100 text-orange-800`)
- `desligado` → badge vermelho (destructive)
- `ativo` → badge secundário
- Usar `STATUS_LABELS` e `STATUS_COLORS` de `constants.ts` para consistência

Na detecção de alertas (linha 421):
- Separar `inativo`/`busca_ativa` de `desligado` no motivo de alerta
- `busca_ativa` → motivo "Em busca ativa"
- `desligado` → motivo "Desligado recente"

**3. Borda do card** (linha 821)

Atualizar a cor da borda-esquerda:
- `ativo` → amarelo/amber (faltas)
- `busca_ativa` → laranja
- `desligado` → vermelho

### Arquivo editado

| Arquivo | Mudança |
|---|---|
| `src/pages/equipe-tecnica/EquipeTecnicaPage.tsx` | Filtros adicionais + correção de badges + labels de motivo |

### Zero alteração em lógica de negócio ou banco de dados

