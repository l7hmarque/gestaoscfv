

## Plano: Inserir fotos no DOCX + Novas tags + Nome do grupo + Desligamento com motivo + Alerta de transferência

---

### Parte 1 — Inserir imagens reais no DOCX do relatório (plano anterior aprovado)

**Arquivo:** `src/hooks/useDocumentExport.ts`

- Adicionar `ImageRun` ao import do `docx`
- Criar helper `fetchPhotosAsBuffers(fotos)`: para cada `foto_url`, faz `fetch` → blob → `createImageBitmap` para obter dimensões → escala para largura máx 450px mantendo proporção
- Na função `exportRelatorioDocx`, tanto no template quanto no fallback, após presença: seção "Registro Fotográfico" com `ImageRun` + legenda
- Legenda: `{DATA} - {NOME_ATIVIDADE} - Grupos: {TURMAS}` (ex: "04/03/26 - Oficina de Karatê - Grupos: 6-11 anos, Jardim Irene, Manhã")
- Fotos que falhem no fetch são silenciosamente ignoradas

---

### Parte 2 — Novas tags de exportação

#### `{PONTO_TRANSPORTE}` — Ponto de transporte do participante

**Arquivo:** `src/hooks/useDocumentExport.ts` (em `buildFichaTemplateData`)
- Receber o nome do ponto de transporte (já resolvido no perfil via join com `pontos_transporte`)
- Adicionar `PONTO_TRANSPORTE: p._ponto_transporte || "—"` ao template data

**Arquivo:** `src/pages/participantes/ParticipantePerfilPage.tsx`
- Na chamada `exportFichaInscricaoDocx(p)`, injetar `_ponto_transporte` no objeto passado (já tem `pontos` carregados)

**Arquivo:** `src/components/TemplateTagMapper.tsx`
- Adicionar `{ value: "ponto_transporte", label: "Ponto de transporte" }` em `SYSTEM_FIELDS["ficha_inscricao.docx"]`
- Adicionar `PONTO_TRANSPORTE: "ponto_transporte"` em `AUTO_MATCH`

#### `{PERIODO_SCFV}` — Período inverso (manhã→tarde, tarde→manhã)

**Arquivo:** `src/hooks/useDocumentExport.ts`
- Em `buildFichaTemplateData`: `PERIODO_SCFV: p.periodo === "manha" ? "Tarde" : p.periodo === "tarde" ? "Manhã" : "—"`
- Em `buildRelatorioTemplateData`: idem, usar o período da turma principal

**Arquivo:** `src/components/TemplateTagMapper.tsx`
- Adicionar em ambos os SYSTEM_FIELDS e AUTO_MATCH

#### `{NOME_GRUPO}` — Nome customizado do grupo da turma

**Migração SQL:** Adicionar coluna `nome_grupo text` na tabela `turmas`

**Arquivo:** `src/pages/turmas/TurmaDetalhePage.tsx`
- No formulário de edição, adicionar campo "Nome do Grupo" (Input texto)
- Salvar em `turmas.nome_grupo`
- Na exibição do detalhe, mostrar o nome do grupo como info se preenchido
- **Manter** o nome técnico "Bairro - Faixa - Período" em menus/listagens

**Arquivo:** `src/hooks/useDocumentExport.ts`
- Em `buildRelatorioTemplateData`: `NOME_GRUPO: turmaData?.nome_grupo || turmaNames.join(", ")`

**Arquivo:** `src/components/TemplateTagMapper.tsx`
- Adicionar campo e auto-match

---

### Parte 3 — Desligamento com justificativa e motivo padrão

#### Migração SQL
```sql
ALTER TABLE participantes ADD COLUMN justificativa_desligamento text;
ALTER TABLE participantes ADD COLUMN motivo_desligamento text;
```

#### Motivos padrão de desligamento
```
"Mudança de município"
"Mudança de bairro"
"Idade fora da faixa"
"Desistência voluntária"
"Evasão / Infrequência"
"Encaminhamento para outro serviço"
"Situação familiar"
"Outro"
```

#### `src/pages/participantes/ParticipantePerfilPage.tsx`
- Ao alterar status para "desligado": abrir dialog solicitando:
  - `data_desligamento` (obrigatório)
  - `motivo_desligamento` (select com opções padrão, obrigatório)
  - `justificativa_desligamento` (textarea, opcional)
- **Mudança crítica:** NÃO remover participante das turmas. Manter o vínculo mas marcar como desligado
- Após desligamento, nos indicadores (presença, adesão, ELO): desconsiderar presenças registradas após a `data_desligamento`

#### Tag `{JUST_DESLG}` na ficha de inscrição
**Arquivo:** `src/hooks/useDocumentExport.ts`
- `JUST_DESLG: p.justificativa_desligamento || "—"`
- `MOTIVO_DESLG: p.motivo_desligamento || "—"`

---

### Parte 4 — Desligado permanece na turma mas não contabiliza

#### `src/pages/turmas/TurmaDetalhePage.tsx`
- Na listagem de membros: mostrar badge "Desligado" + data para participantes desligados
- Nos cálculos de alertas e stats: filtrar registros de presença após `data_desligamento`
- No dashboard da turma: excluir desligados da contagem de matriculados ativos

#### `src/pages/presenca/PresencaExportarPage.tsx` e relatório mensal
- Na matriz de frequência: mostrar presenças do participante até a data de desligamento
- Após desligamento: marcar com "D" (ou célula vazia) nas datas seguintes
- Na lista de chamada impressa: indicar "(Desligado em DD/MM)" ao lado do nome

#### `supabase/functions/generate-relatorio-mensal/index.ts` e `DashboardRelatorioMensalTab.tsx`
- Excluir participantes desligados da contagem de matriculados do mês (se `data_desligamento < início_do_mês`)
- Para desligados no meio do mês: contar até a data de desligamento

---

### Parte 5 — Alerta de transferência de turma

#### Trigger no `ParticipantePerfilPage.tsx` (automação 3 existente)
- Quando bairro/período/faixa etária muda e participante está ativo: em vez de transferir automaticamente, **solicitar aprovação**
- Mostrar dialog: "Dados alterados. Deseja transferir [Nome] da turma [Anterior] para [Nova]?"
- Ao aprovar:
  - Manter o histórico de presença na turma anterior intacto
  - Criar novo vínculo na turma compatível
  - Registrar a transferência (data, turma_origem, turma_destino) — pode ser feito via recado/notificação

#### Notificação ao educador
- Ao confirmar transferência: inserir recado automático para o `educador_id` da turma de destino
- Conteúdo: "[Nome] foi transferido para sua turma [Turma] em [Data]"
- Usar tabela `recados` existente (remetente = coordenação/sistema profile)

#### Migração SQL (opcional — log de transferências)
```sql
CREATE TABLE participante_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id uuid NOT NULL,
  turma_origem_id uuid,
  turma_destino_id uuid,
  data_transferencia date NOT NULL DEFAULT CURRENT_DATE,
  motivo text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE participante_transferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read transferencias" ON participante_transferencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-visitante manage transferencias" ON participante_transferencias FOR ALL TO authenticated USING (NOT has_role(auth.uid(), 'visitante'::app_role));
```

#### Listas de chamada e relatórios
- Na lista de chamada impressa/exportada: participantes transferidos aparecem até a data de transferência com indicação "(Transferido em DD/MM)"
- % de frequência individual é preservado e contínuo entre turmas (não reseta)

---

### Parte 6 — Alinhamento ENG/SIT (plano anterior já aprovado e implementado)

Já aplicado. Tags ENG_1-4, SIT_1-5, OBJ_1-3 alinhadas com template institucional.

---

### Resumo de arquivos e mudanças

| Arquivo | Mudança |
|---|---|
| Migração SQL | ADD `nome_grupo` em turmas, ADD `justificativa_desligamento`/`motivo_desligamento` em participantes, CREATE `participante_transferencias` |
| `src/hooks/useDocumentExport.ts` | ImageRun para fotos, novas tags (PONTO_TRANSPORTE, PERIODO_SCFV, NOME_GRUPO, JUST_DESLG, MOTIVO_DESLG), legenda nas fotos |
| `src/components/TemplateTagMapper.tsx` | Novos campos em SYSTEM_FIELDS e AUTO_MATCH |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Dialog de desligamento com motivo/justificativa, aprovação de transferência com dialog, injetar _ponto_transporte na exportação |
| `src/pages/turmas/TurmaDetalhePage.tsx` | Campo nome_grupo, badge desligado nos membros, filtrar indicadores por data_desligamento |
| `src/pages/presenca/PresencaExportarPage.tsx` | Marcar desligados/transferidos na matriz |
| `supabase/functions/generate-relatorio-mensal/index.ts` | Excluir desligados dos indicadores a partir da data |
| `src/pages/dashboard/DashboardRelatorioMensalTab.tsx` | Mesma lógica de exclusão de desligados |
| `src/components/NotificationBell.tsx` | Nenhuma mudança (já suporta recados) |

### Novas tags completas adicionadas

| Tag | Doc | Descrição |
|---|---|---|
| `{PONTO_TRANSPORTE}` | ficha_inscricao.docx | Ponto de transporte do participante |
| `{PERIODO_SCFV}` | ficha/relatório | Período inverso (manhã→tarde) |
| `{NOME_GRUPO}` | relatório/ficha | Nome customizado do grupo da turma |
| `{JUST_DESLG}` | ficha_inscricao.docx | Justificativa de desligamento |
| `{MOTIVO_DESLG}` | ficha_inscricao.docx | Motivo padrão de desligamento |
| `{FOTOS}` | relatório (imagens) | Fotos embutidas com legenda |

