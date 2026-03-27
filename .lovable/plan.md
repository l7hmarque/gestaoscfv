

# Fase 1 — SysELO: Base + Turmas + Presenca + Relatorio de Atividades + Planejamento

## Resumo

Construir o sistema completo da Fase 1 incluindo: design system, autenticacao, cadastro de participantes com importacao em lote, gestao de turmas, presenca digital/exportavel, relatorio de atividades com avaliacao Likert e fotos, e planejamento de atividades com exportacao DOCX/PDF.

---

## Dados Mapeados dos Arquivos

### Relatorio de Atividades (campos do formulario + planilha)
- Data, Dia da Semana, Profissional, Bairro, Faixa Etaria, Periodo
- Tipo de Atividade Realizada (ex: "Educando")
- Nome da Atividade (livre ou selecionar de planejamento proprio)
- Selecao de multiplas turmas cadastradas
- Competencias Likert 1-5: Iniciativa, Autonomia, Colaboracao, Comunicacao, Respeito Mutuo
- Score ELO = media das 5 competencias
- Checkboxes: Engajamento (participativo, disperso, conflitos, boa interacao, intervencao)
- Checkboxes: Situacoes relevantes (nenhuma, conflito, vulnerabilidade, encaminhamento, comunicacao familia)
- Checkboxes: Objetivo (alcancado, parcialmente, nao alcancado)
- Situacoes/Observacoes (texto livre)
- Intervencoes Realizadas (texto livre)
- Upload de ate 5 fotos
- Numero de Participantes, Ausentes, Total Matriculados, % Adesao
- Analise IA (texto gerado automaticamente)
- Presenca individual: marca presente/ausente cada participante da turma selecionada

### Planejamento de Atividades (campos)
- Educador/Facilitador, Grupo (faixa etaria), Bairro, Periodo
- Tema da Atividade ou Demanda
- Titulo da Atividade
- Questao Geradora / Desafio
- Forma de Avaliacao (multipla escolha: Ficha Observacao, Rubrica, Likert, Autoavaliacao, Roda de Conversa, Portfolio)
- Objetivos Foco (texto livre, multiplos)
- Data de Aplicacao
- Roteiro da Atividade (texto livre, passos numerados)
- Materiais Necessarios
- Apoio Tecnico (texto livre)
- Selecao de turmas cadastradas

---

## Arquitetura Tecnica

### Tabelas Supabase (adicoes para esta fase)

```text
-- Tabelas base (ja planejadas)
profiles, user_roles, bairros, pontos_transporte,
participantes, turmas, turma_participantes, presenca

-- NOVAS: Planejamento
planejamentos (
  id, educador_id FK profiles,
  titulo, tema, questao_geradora,
  objetivos text, forma_avaliacao text[],
  roteiro text, materiais text, apoio_tecnico text,
  data_aplicacao date,
  created_at, updated_at
)

planejamento_turmas (id, planejamento_id FK, turma_id FK)

-- NOVAS: Relatorio de Atividades
relatorios_atividade (
  id, educador_id FK profiles,
  data date, dia_semana text,
  tipo_atividade text, nome_atividade text,
  planejamento_id FK planejamentos (nullable),
  -- Likert 1-5
  iniciativa int, autonomia int, colaboracao int,
  comunicacao int, respeito_mutuo int, score_elo decimal,
  -- Checkboxes (arrays de opcoes selecionadas)
  engajamento text[], situacoes_relevantes text[],
  objetivo_alcancado enum[alcancado,parcial,nao_alcancado],
  -- Textos
  observacoes text, intervencoes text,
  -- Contagens
  num_participantes int, num_ausentes int,
  num_matriculados int, pct_adesao decimal,
  -- IA
  analise_ia text,
  created_at
)

relatorio_turmas (id, relatorio_id FK, turma_id FK)

relatorio_fotos (id, relatorio_id FK, foto_url text, ordem int)

relatorio_presenca (
  id, relatorio_id FK, participante_id FK,
  presente boolean, justificativa text
)
```

### Rotas (completas da Fase 1)

```text
/login
/                        — Home (atalhos rapidos)
/participantes           — Lista com filtros
/participantes/novo      — Cadastro
/participantes/importar  — Import XLSX
/participantes/:id       — Perfil
/turmas                  — Lista de turmas
/turmas/nova             — Criar turma
/turmas/:id              — Detalhe + participantes
/presenca                — Marcar presenca do dia
/presenca/historico      — Historico mensal
/presenca/exportar       — Gerar lista XLSX/PDF
/planejamentos           — Lista de planejamentos do educador
/planejamentos/novo      — Criar planejamento
/planejamentos/:id       — Visualizar/editar
/relatorios              — Lista de relatorios do educador
/relatorios/novo         — Criar relatorio de atividade
/relatorios/:id          — Visualizar relatorio
```

---

## Etapas de Implementacao

### 1. Design system + Layout
- Paleta vermelho/azul/offwhite no `index.css`
- `AppSidebar` com categorias: Inicio, Participantes, Turmas, Presenca, Planejamento, Relatorios
- Layout responsivo com `SidebarProvider`

### 2. Autenticacao (Lovable Cloud)
- Tabelas `profiles` + `user_roles` + trigger
- Login por email/senha
- `ProtectedRoute`

### 3. Banco de dados — migrations
- Todas as tabelas listadas acima
- RLS por role
- Seed bairros + pontos transporte

### 4. Cadastro de participantes
- Formulario completo (mapeado da ficha de inscricao)
- Upload foto, lista com filtros, perfil individual

### 5. Importacao em lote
- Upload XLSX, mapeamento automatico, preview, insercao batch

### 6. Gestao de turmas
- CRUD turmas (ordinaria/extraordinaria), dias da semana, educador
- Popular com participantes, quick update periodo

### 7. Presenca digital + exportacao
- Interface de marcacao por turma/data
- Calendario mensal (somente dias da turma)
- Exportar lista de chamada XLSX/PDF

### 8. Planejamento de atividades
- Formulario: titulo, tema, questao geradora, objetivos, roteiro, materiais, apoio tecnico
- Selecao de turmas cadastradas
- Selecao de forma de avaliacao (checkboxes multiplos)
- Data de aplicacao
- Lista de planejamentos do educador (filtro por turma, data)
- Visualizacao individual
- Exportacao DOCX/PDF seguindo modelo enviado (cabecalho SCNSA, secoes I-IV)

### 9. Relatorio de atividades
- Formulario completo:
  - Selecionar turma(s) → popula automaticamente lista de participantes
  - Nome da atividade: livre ou selecionar de planejamentos proprios
  - Tipo de atividade
  - Marcacao de presenca individual (presente/ausente) integrada ao relatorio
  - Avaliacao Likert 1-5 para cada competencia (slider ou radio)
  - Score ELO calculado automaticamente (media)
  - Checkboxes de engajamento, situacoes, objetivo
  - Campos texto: observacoes e intervencoes
  - Upload de ate 5 fotos
  - Contagem automatica de presentes/ausentes/matriculados e % adesao
- Lista de relatorios com filtros (educador, turma, data)
- Visualizacao individual com layout do modelo
- Exportacao DOCX/PDF seguindo modelo enviado (cabecalho, dados, competencias, fotos em Anexo I)
- A presenca registrada no relatorio tambem alimenta a tabela `presenca` (sincroniza)

### 10. Integracao presenca ↔ relatorio
- Ao salvar relatorio, os dados de presenca individual sao gravados na tabela `presenca`
- % frequencia do participante e calculada a partir de todas as presencas registradas
- Dashboard futuro consumira esses dados

---

## Detalhes Tecnicos

- **Exportacao DOCX**: biblioteca `docx` (docx-js) no frontend para gerar documentos seguindo os modelos enviados
- **Exportacao PDF**: `jsPDF` para listas de chamada e versao PDF dos relatorios/planejamentos
- **Exportacao XLSX**: `SheetJS` (xlsx) para listas de presenca e importacao
- **Upload de fotos**: Supabase Storage buckets
- **Likert UI**: componente slider ou grupo de radio buttons estilizados (1-5 com labels: Muito Baixo → Excepcional)
- **Score ELO**: media simples das 5 competencias, exibido com 2 casas decimais

## Fora do Escopo
Feed social, financeiro, dashboard, painel motorista/cozinheiro, mural, tickets, prestacao de contas — fases seguintes.

