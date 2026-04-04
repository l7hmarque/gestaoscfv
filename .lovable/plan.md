

## Plano: Corrigir exportação DOCX + campos faltantes + migrar CPF + mapa completo de tags

---

### 1. Bug crítico: `remapDataWithMappings` ignora o `fieldKey`

Na linha 99-112 de `useDocumentExport.ts`, a função recebe `tagMappings = { "ScoreELO": "score_elo" }` mas nunca usa o `fieldKey`. Busca `allData["SCOREELO"]` em vez de resolver via `fieldKey`.

**Correção**: Para cada `(tagName, fieldKey)`, normalizar `fieldKey` para encontrar o valor em `baseData`:

```text
tagName="ScoreELO", fieldKey="score_elo"
→ normalizar "score_elo" → "SCORE_ELO" → baseData["SCORE_ELO"] = "3.40" ✓
```

Também buscar diretamente `baseData[fieldKey]` e variantes (`UPPER`, `snake_to_UPPER_SNAKE`).

---

### 2. Migração SQL: CPF + novos campos

```sql
ALTER TABLE participantes ADD COLUMN cpf text;
ALTER TABLE participantes ADD COLUMN data_desligamento date;
ALTER TABLE participantes ADD COLUMN dias_contraturno text;
UPDATE participantes SET cpf = responsavel1_cpf WHERE responsavel1_cpf IS NOT NULL;
UPDATE participantes SET responsavel1_cpf = NULL;
```

---

### 3. Competências individuais no relatório (já existem!)

Os 5 scores + labels + score_elo JÁ estão em `buildRelatorioTemplateData` (linhas 257-267) e em `SYSTEM_FIELDS["relatorio.docx"]` (linhas 21-31). O problema é que o mapeamento não funciona por causa do bug do item 1. Com a correção, tags como `{Iniciativa}`, `{Autonomia}`, `{ScoreELO}` etc. vão funcionar.

Adicionarei também tags para as fotos do relatório (`fotos_loop` com URL de cada foto) e `num_matriculados`.

---

### 4. Mapa completo de tags por documento modelo

#### `relatorio.docx` — Relatório de Atividade

| Tag no DOCX | Campo do sistema | Exemplo |
|---|---|---|
| `{DATA}` | Data da atividade | 03/04/2026 |
| `{DIA_SEMANA}` | Dia da semana | Quinta-feira |
| `{EDUCADOR}` | Nome do educador | João Silva |
| `{TURMAS}` | Turmas vinculadas | JI 9-11 Manhã |
| `{TIPO_ATIVIDADE}` | Tipo(s) de atividade | Momento Educando |
| `{NOME_ATIVIDADE}` | Nome da atividade | Criando Nosso Site |
| `{INICIATIVA}` | Iniciativa (1-5) | 4 |
| `{INICIATIVA_LABEL}` | Iniciativa (texto) | Alto |
| `{AUTONOMIA}` | Autonomia (1-5) | 3 |
| `{AUTONOMIA_LABEL}` | Autonomia (texto) | Moderado |
| `{COLABORACAO}` | Colaboração (1-5) | 5 |
| `{COLABORACAO_LABEL}` | Colaboração (texto) | Excepcional |
| `{COMUNICACAO}` | Comunicação (1-5) | 4 |
| `{COMUNICACAO_LABEL}` | Comunicação (texto) | Alto |
| `{RESPEITO_MUTUO}` | Respeito mútuo (1-5) | 4 |
| `{RESPEITO_MUTUO_LABEL}` | Respeito mútuo (texto) | Alto |
| `{SCORE_ELO}` | Score ELO total | 4.00 |
| `{PCT_ADESAO}` | % Adesão | 85% |
| `{NUM_PRESENTES}` | Nº presentes | 16 |
| `{NUM_AUSENTES}` | Nº ausentes | 3 |
| `{NUM_MATRICULADOS}` | Nº matriculados | 19 |
| `{OBJETIVO}` | Objetivo alcançado | Alcançado |
| `{INTERVENCOES}` | Intervenções | texto livre |
| `{OBSERVACOES}` | Observações | texto livre |
| `{ANALISE_IA}` | Análise IA | texto gerado |
| `{ENG_1}` a `{ENG_5}` | Checkboxes engajamento | [X] ou [ ] |
| `{SIT_1}` a `{SIT_5}` | Checkboxes situações | [X] ou [ ] |
| `{FOTOS}` | Lista de URLs das fotos | texto |
| **Loop presença:** `{#PRESENCA}{NUM} {NOME} {STATUS}{/PRESENCA}` | Lista de presença | |

#### `planejamento.docx` — Planejamento

| Tag | Campo | Exemplo |
|---|---|---|
| `{TITULO}` | Título | Teste |
| `{EDUCADOR}` | Educador | João |
| `{DATA_APLICACAO}` | Data de aplicação | 15/04/2026 |
| `{TURMAS}` | Turmas | JI 9-11 Manhã |
| `{TEMA}` | Tema | Cidadania Digital |
| `{QUESTAO_GERADORA}` | Questão geradora | texto |
| `{OBJETIVOS}` | Objetivos | texto |
| `{ROTEIRO}` | Roteiro | texto |
| `{MATERIAIS}` | Materiais | texto |
| `{APOIO_TECNICO}` | Apoio técnico | texto |
| `{FORMA_AVALIACAO}` | Forma de avaliação | Observação, Roda |

#### `ficha_inscricao.docx` — Ficha de Inscrição

| Tag | Campo | Exemplo |
|---|---|---|
| `{NOME_COMPLETO}` | Nome | Maria Santos |
| `{CPF}` | CPF do participante | 123.456.789-00 |
| `{DATA_NASCIMENTO}` | Nascimento | 2015-03-10 |
| `{GENERO}` | Gênero | Feminino |
| `{COR_RACA}` | Cor/Raça | Parda |
| `{ESCOLA}` | Escola | E.M. Monteiro |
| `{SERIE}` | Série | 5º Ano |
| `{PERIODO}` | Período | Manhã |
| `{ENDERECO_RUA}` | Rua | Rua das Flores |
| `{ENDERECO_NUMERO}` | Número | 123 |
| `{ENDERECO_BAIRRO}` | Bairro | Centro |
| `{BAIRRO_SCFV}` | Bairro SCFV | Jardim Irene |
| `{UF_ORIGEM}` | UF | PR |
| `{SITUACAO_MORADIA}` | Moradia | Própria |
| `{RESPONSAVEL1_NOME}` | Resp. 1 nome | Ana Santos |
| `{RESPONSAVEL1_WHATSAPP}` | Resp. 1 WhatsApp | (45)99999-0000 |
| `{RESPONSAVEL2_NOME}` | Resp. 2 nome | Pedro Santos |
| `{RESPONSAVEL2_WHATSAPP}` | Resp. 2 WhatsApp | (45)99998-0000 |
| `{ORIGEM_ENCAMINHAMENTO}` | Encaminhamento | CRAS |
| `{RESPONSAVEL_TECNICO}` | Resp. técnico | Dra. Souza |
| `{CATEGORIA_VULNERABILIDADE}` | Vulnerabilidade | BPC |
| `{RESTRICAO_ALIMENTAR}` | Restrição | Lactose |
| `{LAUDO}` | Laudo | TDAH |
| `{STATUS}` | Status | Ativo |
| `{INICIOU_EM}` | Início | 2025-03-01 |
| `{DATA_DESLIGAMENTO}` | Desligamento | — |
| `{DIAS_CONTRATURNO}` | Dias contraturno | Seg, Qua, Sex |
| `{TURMAS}` | Turmas vinculadas | JI 9-11 Manhã |
| `{FOTO_URL}` | URL da foto | link |
| `{DOCUMENTOS}` | Docs anexos (lista) | Matrícula: doc.pdf |

#### `matriz_frequencia.docx` — Matriz de Frequência

| Tag | Campo |
|---|---|
| `{TURMA_NOME}` | Nome da turma |
| `{PERIODO}` | Período |
| `{FAIXA_ETARIA}` | Faixa etária |
| `{MES_ANO}` | Mês/Ano |
| `{#PARTICIPANTES}{NOME}{/PARTICIPANTES}` | Loop participantes |
| `{#DATAS}{DIA}{/DATAS}` | Loop datas |

#### Checkboxes no modelo DOCX

Não usar checkboxes nativas do Word. No template, colocar a tag diretamente (ex: `{ENG_1}`). O sistema substitui por `[X]` (marcado) ou `[ ]` (desmarcado).

---

### 5. Formulários: CPF do participante

| Arquivo | Mudança |
|---|---|
| `MatriculaPublicaPage.tsx` | Label "CPF do participante", salva em campo `cpf` |
| `ParticipanteNovoPage.tsx` | Idem |
| `ParticipantePerfilPage.tsx` | Idem no formulário de edição |
| `public-matricula/index.ts` | Receber `cpf` no payload |
| `BancoDadosPage.tsx` | Coluna CPF → `cpf` |

---

### Arquivos e mudanças

| Arquivo | Mudança |
|---|---|
| Migração SQL | ADD cpf/data_desligamento/dias_contraturno + migrar dados de responsavel1_cpf |
| `src/hooks/useDocumentExport.ts` | Corrigir `remapDataWithMappings`, expandir `buildFichaTemplateData` (novos campos + documentos + turmas), adicionar `FOTOS` ao relatório |
| `src/components/TemplateTagMapper.tsx` | Novos campos em SYSTEM_FIELDS (cpf, data_desligamento, dias_contraturno, turmas, documentos, fotos) e AUTO_MATCH |
| `src/pages/matricula/MatriculaPublicaPage.tsx` | CPF → campo `cpf` do participante |
| `src/pages/participantes/ParticipanteNovoPage.tsx` | CPF → campo `cpf` |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | CPF + data_desligamento + dias_contraturno no formulário |
| `src/pages/banco-dados/BancoDadosPage.tsx` | Coluna CPF → `cpf` |
| `supabase/functions/public-matricula/index.ts` | Campo `cpf` no payload |

