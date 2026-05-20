# Catálogo de Relatórios Estratégicos — SysCFV

Mapeamento de **o que monitorar** e **quais relatórios gerar** a partir dos dados já existentes no sistema (presença, turmas, atendimentos, busca ativa, encaminhamentos, transferências, desligamentos, auditoria, cozinha, transporte, formulários família, coordenação). Organizado por **destinatário**, com indicadores acionáveis e cadência sugerida.

---

## 1. Ministério Público / Promotoria da Infância e Idoso

Foco: **garantia de direitos, contraturno escolar, vínculo familiar, evasão.**

- **Relatório de Frequência por Participante (vínculo MP)** — histórico mensal de presença, faltas consecutivas, ações de busca ativa, encaminhamentos. Útil para responder ofícios sobre crianças/adolescentes específicos.
- **Relatório de Evasão e Reintegração** — desligados no período × motivo × tempo médio até retomada, com taxa de retorno via busca ativa.
- **Relatório de Encaminhamentos Externos** — quantitativo e nominal (sigiloso) por órgão (CRAS, CREAS, Conselho Tutelar, UBS, Escola), status, tempo médio de retorno.
- **Relatório de Violações Identificadas** — atendimentos sigilosos categorizados (sinais de violência, negligência, evasão escolar) com fluxo de encaminhamento.
- **Cadência:** sob demanda + consolidado semestral.

## 2. Controladoria / Tribunal de Contas

Foco: **execução da meta conveniada, comprovação de atendimento, rastreabilidade.**

- **Relatório de Execução de Metas Territoriais** — meta pactuada × atendidos únicos por bairro/período (já existe na aba Metas, formalizar como peça de prestação de contas com assinatura digital).
- **Lista Nominal de Atendidos com Frequência ≥ 50%** — comprovação mensal de atendimento efetivo (não apenas matrícula).
- **Trilha de Auditoria de Alterações Críticas** — log de exclusões, transferências, edições retroativas com justificativa e responsável (já há `audit_log`).
- **Cadência:** mensal + anual consolidado.

## 3. Secretaria Municipal de Assistência Social (SAS) / Gestão SUAS

Foco: **alimentação do RMA, Censo SUAS, pactuação SCFV.**

- **Relatório RMA-Compatível** — atendidos no mês, novos ingressos, desligamentos, perfil etário (6-8, 9-11, 12-17, idosos), por unidade/território. - edit: isso ja tem.
- **Cobertura de Público Prioritário** — % de atendidos em situação prioritária (PBF, BPC, medida protetiva, trabalho infantil identificado, violação) — exige campo no cadastro. edit: O campo no cadastro esta como Situacao de Vulnerabilidade ou Atencao Prioritaria
- **Mapa de Vulnerabilidades por Território** — densidade de busca ativa, encaminhamentos e desligamentos por bairro (heatmap já existe, formalizar export).
- **Cadência:** mensal alinhada ao calendário do RMA.

## 4. CRAS / CREAS / Rede Intersetorial

Foco: **referenciamento e contrarreferência.**

- **Ficha de Referenciamento por Participante** — síntese de 1 página: dados, turma, frequência últimos 3 meses, atendimentos, encaminhamentos abertos. Gerável em PDF a partir do perfil, de preferencia via Google Drive (docs)
- **Relatório de Casos Abertos com a Rede** — encaminhamentos sem retorno > 30 dias, para reunião de rede. edit: nao precisa.
- **Boletim Mensal de Articulação** — quantitativo de interações por órgão parceiro (origem: `coordenacao_atividades` categoria "articulacao_rede"). 
- **Cadência:** mensal + ficha sob demanda.

## 5. Conselho Tutelar / Conselho Municipal de Direitos

Foco: **monitoramento de medidas e situações de risco.**

- **Relatório de Faltas Consecutivas com Alerta** — participantes com 3+ faltas seguidas, ações de busca ativa registradas, status atual (cumpre dever institucional de comunicar evasão).
- **Relatório de Participantes sob Medida Protetiva** — exige flag no cadastro; histórico de frequência e atendimentos.

## 6. Relatórios Internos — Coordenação

Foco: **gestão operacional e pedagógica.**

- **Painel de Qualidade Pedagógica** — média ELO/ELON por turma/educador/mês, evolução de competências (já há base no dashboard).
- **Produtividade da Equipe Técnica** — atendimentos, visitas domiciliares, busca ativa, encaminhamentos por profissional (já existe, formalizar export mensal assinado, de preferencia via google drive (google docs ou google sheets).
- **Relatório de Adesão por Turma** — % presença vs. matriculados, ranking, turmas em alerta (<60%).
- **Relatório de Desligamentos Qualificados** — motivo, tempo de permanência, faixa etária, território — para entender padrões de evasão.
- **Relatório de Transferências** — fluxo entre bairros/períodos, motivos recorrentes.
- **Relatório de Vulnerabilidade Acumulada** (Equipe Técnica) — participantes com múltiplos marcadores (faltas + atendimento + encaminhamento aberto).
- **Cadência:** mensal interno + trimestral para diretoria.

## 7. Relatórios Internos — Família / Comunidade

- **Boletim do Participante** (já existe Portal Família) — formalizar export PDF trimestral com frequência, evolução, fotos autorizadas.
- **Relatório de Satisfação** — agregando respostas dos `formularios_familia`.

## 8. Indicadores transversais a destacar (todos os públicos)


| Indicador                                 | Fonte de dados                    | Uso                |
| ----------------------------------------- | --------------------------------- | ------------------ |
| Taxa de cobertura da meta                 | `bairros` × presenças únicas      | Controladoria, SAS |
| Taxa de frequência mensal                 | `presenca` + `relatorio_presenca` | Todos              |
| Tempo médio até 1ª busca ativa            | `busca_ativa_registros`           | MP, Conselho       |
| Taxa de retorno pós-busca ativa           | status pós-registro               | MP, SAS            |
| Tempo médio de resposta de encaminhamento | `encaminhamentos_externos`        | Rede               |
| Permanência média (meses)                 | `iniciou_em` → `desligado_em`     | SAS, gestão        |
| &nbsp;                                    | &nbsp;                            | &nbsp;             |
| &nbsp;                                    | &nbsp;                            | &nbsp;             |


---

## Proposta de implementação faseada

**Fase 1 — Empacotar o que já existe** (esforço baixo)
Hub `/relatorios/oficiais` com 4 peças prontas: RMA, Execução de Metas, Ficha de Referenciamento, Trilha de Auditoria. Cada uma com export PDF/DOCX padronizado (cabeçalho institucional, assinaturas, período).

**Fase 2 — Indicadores derivados** (esforço médio)
RPCs para: taxa de retorno pós-BA, tempo médio de encaminhamento, permanência média, custo per capita. Painel `/relatorios/indicadores-rede`.

**Fase 3 — Campos de qualificação** (exige migração)
Adicionar ao cadastro de participante: `publico_prioritario` (PBF, BPC, medida protetiva, trabalho infantil, violação identificada), `referenciado_cras`, `numero_nis`. Sem isso, RMA e relatórios para MP ficam incompletos. -- confirme pra mim se ja nao tem um campo no cadastro do participante e no banco de dados, me lmebro de ter enviado uma planilha pedindo pra voce atualizar as informacoes dos participantes e nela tinha a categoria de publico prioritario, com outro nome, mas tinha.

**Fase 4 — Automação de envio** (esforço alto)
Agendar envio mensal por e-mail para destinatários cadastrados (SAS, CRAS de referência), com PDF assinado e log de entrega.

---

## Pergunta para você

Quer que eu detalhe e implemente **uma destas peças primeiro** (sugiro começar pelo **Hub de Relatórios Oficiais — Fase 1**, reaproveitando 100% dos dados atuais), ou prefere priorizar a **Fase 3** para já cadastrar público prioritário e destravar o RMA completo?  
  
Quero aproveitar a criacao desse HUB para organizar tambem os outros HUBS de exportacao de relatorios/documentos. A minha ideia e deixar todas as exportacoes via Google Drive (google docs ou google sheets).  Pode me fazer perguntas de como seria melhor o hub.  
  
confirme que voce entendeu, me faca as perguntas que voce precisa e garanta que nada da versao atual sera quebrada. Sugestao: criar um ponto de restauracao dessa versao antes de implementar essas coisas novas. 