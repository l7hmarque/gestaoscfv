

## Plano: Cronograma Multi-Turma + Regras de Frequência + Layout Horizontal de Turmas

### Problema atual
- `getSlot()` retorna **1 único slot** por célula (dia/periodo/bairro) — impossível empilhar turmas
- Cada slot tem 1 educador + 1 oficineiro + 1 turma — modelo rígido
- Sem regras de frequência semanal por turma/bairro
- Turmas ficam na sidebar lateral, difícil distinguir do bairro-local

### Mudanças

**1. Multi-slot por célula — empilhar turmas**

Trocar `getSlot` (retorna 1) por `getSlots` (retorna array). Cada turma arrastada para a mesma célula cria um **novo slot** independente. Assim "Alvorada 6-8 manhã" e "Alvorada 9-11 manhã" coexistem na mesma célula Seg/Manhã/Alvorada.

Cada slot = 1 turma + (1 educador OU 1 oficineiro). Quando o usuário arrasta um profissional para uma célula multi-slot, aparece um mini-seletor para escolher a qual turma vincular.

**2. Regras de frequência semanal por turma**

Adicionar um dialog "Regras de Frequência" onde o usuário define quantos dias por semana cada turma (ou grupo de turmas por bairro) deve ser atendida. Ex:
- Turmas "Alvorada..." → 2x/semana
- Turmas "Jardim Irene..." → 3x/semana
- Turmas "Parque..." → 2x/semana

As regras serão armazenadas na tabela `cronograma_cenarios` em uma coluna JSON `regras_frequencia`, ou em uma tabela auxiliar simples. O sistema de conflitos passa a alertar quando uma turma está abaixo do mínimo configurado.

**3. Lista de turmas horizontal abaixo da grade**

Remover turmas da sidebar. Colocá-las em uma faixa horizontal abaixo da matriz semanal, com:
- Cores derivadas do prefixo do nome da turma (bairro):
  - "ALVORADA..." → laranja (manhã tom claro, tarde tom escuro)
  - "JARDIM IRENE..." → azul (manhã claro, tarde escuro)
  - "PARQUE..." → verde (manhã claro, tarde escuro)
- Badge com contagem de slots alocados
- Indicador visual de frequência atual vs regra (ex: "2/3" em vermelho se abaixo do mínimo)
- Arrastar da faixa horizontal para a grade funciona igual ao sidebar atual

**4. Distinguir bairro-local de turma-bairro**

Na grade, os headers de linha mostram o **local** (ALVORADA, JD IRENE, PQ INDEP.). Na faixa de turmas, cada turma mostra o nome completo com badge colorida. Tooltip explica "Local de atendimento" vs "Turma por território".

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/cronograma/CronogramaPage.tsx` | Multi-slot, faixa horizontal de turmas, regras de frequência, validação |
| Migration SQL | Coluna `regras_frequencia jsonb` em `cronograma_cenarios` (ou nova tabela `cronograma_regras`) |

### Detalhes técnicos

- `getSlots(dia, periodo, bairroId)` retorna `Slot[]` em vez de `Slot | undefined`
- `handleDrop` para turmas sempre cria novo slot; para profissionais, mostra picker se >1 slot na célula
- Cores de turma: função `getTurmaColor(nome)` que extrai o prefixo do bairro e retorna par de cores (claro/escuro baseado no período da turma)
- Regras: `{ turma_prefix: string, min_dias: number }[]` salvo como JSON na coluna do cenário

### Zero alteração em lógica existente fora do cronograma

