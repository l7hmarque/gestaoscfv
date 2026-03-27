

## Plano: Automações e Sincronizações de Dados

Análise completa das correlações entre tabelas e as automações necessárias para manter consistência.

---

### Mapa de correlações identificadas

```text
participantes ──┬── turma_participantes ── turmas
                ├── presenca
                ├── relatorio_presenca
                ├── participante_documentos
                └── pontos_transporte (via ponto_transporte_id)

turmas ──┬── turma_participantes
         ├── presenca
         ├── relatorio_turmas
         └── planejamento_turmas

profiles ──┬── turmas (educador_id)
           ├── relatorios_atividade (educador_id)
           └── planejamentos (educador_id)
```

---

### Automações necessárias

#### 1. Desligar participante → cascata de limpeza
**Quando:** status muda para `"desligado"` em `ParticipantePerfilPage.handleSave`
**Ações automáticas:**
- Deletar de `turma_participantes`
- Toast: "Participante removido de X turma(s)"

#### 2. Novo participante → auto-vincular a turmas compatíveis
**Quando:** `ParticipanteNovoPage.handleSubmit` finaliza com status `"ativo"`
**Ações automáticas:**
- Calcular faixa etária via `calcFaixaFromDate(data_nascimento)`
- Buscar turmas ativas com mesmo `bairro_id` + `periodo` + `faixa_etaria`
- Inserir em `turma_participantes`
- Toast: "Vinculado automaticamente a X turma(s)"

#### 3. Mudar bairro/período/data nascimento → realocar turmas
**Quando:** campos `bairro_id`, `periodo` ou `data_nascimento` mudam em `ParticipantePerfilPage.handleSave` e status é `"ativo"`
**Ações automáticas:**
- Comparar valores antigos vs novos
- Se mudou: deletar vínculos antigos, buscar turmas compatíveis, inserir novos vínculos
- Toast informando realocação
- Sem `confirm()` — execução silenciosa com feedback via toast

#### 4. Filtrar pontos de transporte por bairro
**Quando:** participante tem `bairro_id` selecionado (novo cadastro e perfil)
**Ação:** mostrar apenas pontos do bairro selecionado; limpar `ponto_transporte_id` se trocar bairro e ponto não pertence ao novo

#### 5. Desativar turma → não aparecer para novos vínculos
**Já funciona parcialmente.** Garantir que a busca de turmas para auto-vínculo filtre `ativa = true`.

#### 6. Extrair `calcFaixaFromDate` para reuso
**Mover** de `TurmaNovaPage.tsx` para `src/lib/constants.ts` e importar nos 3 arquivos que precisam.

---

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/constants.ts` | Exportar `calcFaixaFromDate` |
| `src/pages/participantes/ParticipanteNovoPage.tsx` | Auto-vincular a turmas após cadastro; filtrar pontos por bairro |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Cascata ao desligar; realocar ao mudar bairro/período/idade; filtrar pontos por bairro |
| `src/pages/turmas/TurmaNovaPage.tsx` | Importar `calcFaixaFromDate` de constants |

### O que NÃO será feito via frontend (já coberto ou desnecessário)
- **Foreign keys no banco**: não existem e adicionar agora quebraria inserts existentes — a lógica fica no app
- **Triggers no banco**: evitados por complexidade de manutenção — automações ficam no frontend com feedback visual
- **Cascata em presença**: registros de presença históricos permanecem mesmo após desligamento (são dados de auditoria)

