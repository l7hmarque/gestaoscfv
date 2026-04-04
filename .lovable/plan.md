

## Plano: Alinhar tags ENG/SIT com as opções reais do formulário e do template institucional

---

### Problema

Existem 3 listas de opções de engajamento/situações desalinhadas no código:

**Formulário (RelatorioNovoPage.tsx):**
- ENG: "Alta participação", "Participação parcial", "Pouca interação", "Dispersão", "Resistência"
- SIT: "Conflito entre participantes", "Dificuldade de compreensão", "Participante em crise", "Destaque positivo", "Necessidade de encaminhamento"

**Exportação DOCX (useDocumentExport.ts):**
- ENG: "Participaram ativamente", "Demonstraram interesse", "Houve resistência inicial", "Precisaram de estímulo constante", "Interagiram entre si"

**TemplateTagMapper labels:**
- ENG: "Participaram ativamente", "Demonstraram interesse", "Houve resistência inicial", "Precisaram de estímulo", "Interagiram entre si"
- SIT: "Conflito entre participantes", "Avanço significativo", "Dificuldade de concentração", "Acolhimento emocional", "Destaque positivo"

**Template institucional do usuário (imagem):**
- Engajamento: Grupo participativo, Grupo disperso, Boa interação entre participantes, Necessitou intervenção do educador
- Situações: Nenhuma ocorrência, Conflito entre participantes, Situação de vulnerabilidade identificada, Encaminhamento necessário, Comunicação com família/responsável

Nenhuma das listas bate entre si. Preciso definir **uma lista única e oficial** que será usada em todos os lugares.

---

### Solução

Atualizar as 3 listas para refletir as opções reais do template institucional SCFV:

**Engajamento do grupo (ENG_1 a ENG_4):**

| Tag | Descrição |
|---|---|
| `{ENG_1}` | Grupo participativo |
| `{ENG_2}` | Grupo disperso |
| `{ENG_3}` | Boa interação entre participantes |
| `{ENG_4}` | Necessitou intervenção do educador |

**Situações relevantes (SIT_1 a SIT_5):**

| Tag | Descrição |
|---|---|
| `{SIT_1}` | Nenhuma ocorrência |
| `{SIT_2}` | Conflito entre participantes |
| `{SIT_3}` | Situação de vulnerabilidade identificada |
| `{SIT_4}` | Encaminhamento necessário |
| `{SIT_5}` | Comunicação com família/responsável |

**Objetivo da atividade (OBJ_1 a OBJ_3):** — adicionar tags para as checkboxes de objetivo também:

| Tag | Descrição |
|---|---|
| `{OBJ_1}` | Alcançado |
| `{OBJ_2}` | Parcialmente alcançado |
| `{OBJ_3}` | Não alcançado |

---

### Arquivos e mudanças

| Arquivo | Mudança |
|---|---|
| `src/pages/relatorios/RelatorioNovoPage.tsx` | Atualizar `ENGAJAMENTO_OPT` (4 itens) e `SITUACOES_OPT` (5 itens) com os textos corretos do template institucional |
| `src/hooks/useDocumentExport.ts` | Atualizar `engOptions` e `sitOptions` na `buildRelatorioTemplateData` para mesma lista. Ajustar de 5→4 itens em ENG. Adicionar OBJ_1/OBJ_2/OBJ_3. |
| `src/components/TemplateTagMapper.tsx` | Atualizar labels em `SYSTEM_FIELDS["relatorio.docx"]` e `AUTO_MATCH` para refletir as novas opções. Ajustar ENG para 4 itens, remover ENG_5. Adicionar OBJ_1-3. |
| `src/pages/relatorios/RelatorioDetalhePage.tsx` | Nenhuma mudança necessária (já exibe badges dinâmicos do array salvo) |

### Compatibilidade com dados existentes

Os dados são salvos como arrays de strings (ex: `["Alta participação", "Dispersão"]`). Com a mudança, relatórios antigos terão textos que não batem com as novas opções, mas isso afeta apenas a checkbox na exportação DOCX — o texto continua visível como badge na UI.

