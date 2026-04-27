
# Estratégia Revisada — Listas de Frequência (preenchida) vs Listas de Chamada (em branco)

## 1. Glossário oficial (a ser adotado em todo o sistema)

Para eliminar ambiguidade, fixamos **dois termos distintos** com finalidades opostas:

| Termo oficial | Estado | Finalidade | Tom |
|---|---|---|---|
| **Lista de Frequência** | Preenchida com dados do sistema (■ presente / vazio ausente) | Anexar a relatórios oficiais, REO, prestação de contas, gestão | Documento comprobatório |
| **Lista de Chamada** | Em branco (linhas vazias para marcação manual) | Imprimir e usar fisicamente durante a atividade | Instrumento de coleta |

Tudo o que hoje aparece como "Lista de Presença" será renomeado conforme a finalidade real, em **rótulos da UI, títulos dos documentos e nomes de arquivos**.

### Regra de naming dos arquivos
| Tipo | Padrão |
|---|---|
| Frequência preenchida (mensal por turma) | `SysCFV_ListaFrequencia_{Turma}_{YYYY-MM}.{ext}` |
| Frequência preenchida (anexa ao relatório) | `SysCFV_Relatorio_{timestamp}.docx` (já contém a frequência da atividade) |
| Chamada em branco (mensal por turma) | `SysCFV_ListaChamada_{Turma}_{YYYY-MM}.{ext}` |
| Chamada em branco (avulsa por data) | `SysCFV_ListaChamada_{Turma}_{YYYY-MM-DD}.{ext}` |

---

## 2. Arquitetura proposta — uma fonte única, dois modos

Hoje há **3 fluxos paralelos** que produzem listas (relatório, matriz mensal, lista em branco) com cabeçalhos, larguras e regras de marcação inconsistentes. A proposta é centralizar:

### 2.1 Módulo único `src/lib/listaFrequencia.ts`
Expõe uma única API:

```
buildLista({
  modo: 'frequencia' | 'chamada',     // preenchida ou em branco
  escopo: 'atividade' | 'mensal',     // 1 atividade (data única) ou várias datas
  formato: 'docx' | 'pdf' | 'xlsx',
  turma | turmas[],
  participantes[],
  datas[],                             // datas a renderizar como colunas
  presencas?: PresencaMap,             // obrigatório quando modo='frequencia'
  educador, periodo, bairro, mes, ano
})
```

Internamente decide cabeçalho, marcadores, largura de colunas, rodapé e legenda. Os 3 caminhos atuais passam a ser apenas wrappers.

### 2.2 Marcadores padronizados (paleta SCNSA já aprovada)
| Estado | Lista de Frequência | Lista de Chamada |
|---|---|---|
| Presente | célula com **■** preto sobre fundo `#1F3864` (azul SCNSA) | célula vazia com borda |
| Ausente | célula vazia (branco) | célula vazia com borda |
| Justificada | **J** em vermelho `#9E1B32` | célula vazia com borda |
| Feriado/sem aula | **—** cinza `#5A6770` | **—** cinza `#5A6770` (já preenchido pelo sistema) |
| Participante em busca ativa | sufixo `(BA)` no nome em vermelho `#9E1B32` | mesmo sufixo |
| Participante desligado/transferido na data | sufixo `(D dd/mm)` ou `(T)` em cinza | idem |

### 2.3 Diferenças de layout entre os dois modos

**Lista de Frequência (preenchida):**
- Cabeçalho com **identificação do documento como comprobatório**: "LISTA DE FREQUÊNCIA — {Turma} — {Mês}/{Ano}"
- Coluna assinatura **apenas do educador** no rodapé (não por linha)
- Rodapé com: total de presentes, total de ausentes, % de adesão, data de geração, hash curto do documento (`SHA-256[:8]`) para validação
- Legenda: ■ Presente · J Justificada · — Sem aula · (BA) Em busca ativa · (D) Desligado · (T) Transferido
- Vai para `biblioteca_documentos` como `tipo='lista_frequencia'`

**Lista de Chamada (em branco):**
- Cabeçalho: "LISTA DE CHAMADA — {Turma} — {Mês}/{Ano} — Para preenchimento manual"
- Linhas mais altas (44pt em vez de 28pt) para acomodar caneta
- Coluna "Observações" larga no fim (para o educador anotar justificativas)
- Rodapé com **3 linhas de assinatura**: Educador, Coordenação, Data
- Sem hash, sem totais
- **Não vai** para a biblioteca (é instrumento de campo, não documento oficial)

---

## 3. Pontos de geração no sistema (estado-alvo)

| Origem | Modo | Quem dispara | Formatos |
|---|---|---|---|
| `/relatorios/:id` (anexo do relatório) | Frequência (1 data) | Educador ao exportar relatório | DOCX + PDF |
| `/presenca/exportar` aba **Frequência** | Frequência (mensal) | Coordenação/Educador | DOCX + PDF + XLSX |
| `/presenca/exportar` aba **Chamada** | Chamada (mensal ou avulsa) | Educador para imprimir | PDF (prioritário) + XLSX (fallback) |
| `/turmas/:id` botão "Frequência do mês" | Frequência (mensal) | Educador da turma | XLSX (rápido) |
| `/turmas/:id` botão "Chamada para imprimir" | Chamada (mensal) | Educador da turma | PDF |
| `/turmas` botão "Chamadas em massa" | Chamada (mensal, todas as turmas) | Coordenação | ZIP de PDFs |
| Hub `/relatorios/exportar` → REO/Mensal | Frequência (mensal, todas) | Coordenação | XLSX consolidado |

---

## 4. Mudanças concretas nesta rodada

Combinando esta revisão com o plano anterior (paleta SCNSA, checkbox ■, turmas em lista, tipo humanizado, "Atividades Realizadas"):

### 4.1 Renomeações de UI
- `/presenca/exportar`: aba/seção "Lista de Presença" → split em **dois cards**:
  - Card 1: **"Lista de Frequência (preenchida)"** — botões DOCX, PDF, XLSX
  - Card 2: **"Lista de Chamada (em branco)"** — botão PDF "Gerar para impressão"
- `/turmas/:id`: botão "Lista de Presença" vira dois: **"Frequência do Mês"** (XLSX) e **"Chamada para Imprimir"** (PDF)
- `/turmas`: "Exportar Listas" vira **"Exportar Chamadas em Massa (PDF)"**
- Anexo do relatório: o DOCX/PDF da atividade traz a seção como **"Lista de Frequência"** (não mais "Lista de Presença")

### 4.2 Implementação técnica
1. Criar `src/lib/listaFrequencia.ts` com a API unificada e helpers compartilhados (cabeçalho, rodapé, legenda, marcadores).
2. Migrar `exportListaPresencaPdf`, `exportSingleListaPresenca`, `exportAllListasPresenca`, `exportMatrizFrequenciaDocx`, `exportMatrizFrequenciaPdf` para usar o módulo central. Preservar assinaturas para não quebrar callers.
3. Criar **novo** `gerarListaChamadaPdf()` e `gerarListaChamadaPdfLote()` específicos para o modo em branco com layout otimizado para impressão (linhas altas, coluna observações, 3 assinaturas).
4. No anexo do relatório (`useDocumentExport.ts` linha ~498): trocar título "LISTA DE PRESENÇA" → "LISTA DE FREQUÊNCIA", remover coluna "Assinatura" do participante, manter educador no rodapé, aplicar marcador ■ na presença.
5. Aplicar todas as melhorias visuais já aprovadas (paleta SCNSA, checkbox preenchido, turmas em linha, tipo humanizado, "Atividades Realizadas").

### 4.3 Sem mudança de banco
Tudo permanece em `relatorio_presenca`, `presenca`, `participantes`. Nenhuma migração necessária.

### 4.4 Atualizações de memória
- Atualizar `mem://funcionalidades/presenca-logica` com o glossário oficial (Frequência ≠ Chamada).
- Atualizar `mem://constraints/nomenclatura-arquivos` com os novos padrões `ListaFrequencia` e `ListaChamada`.
- Atualizar `mem://estilo/documentos-institucionais-padrao` registrando exceção de paleta SCNSA para listas e relatórios.

---

## 5. Mapa Mental — Fluxo das Listas no SysCFV

```text
                            ┌─────────────────────────────────────┐
                            │   PARTICIPANTES + TURMAS (cadastro) │
                            └──────────────┬──────────────────────┘
                                           │
                ┌──────────────────────────┴──────────────────────────┐
                │                                                     │
        ANTES da atividade                                  DURANTE/APÓS atividade
                │                                                     │
                ▼                                                     ▼
    ┌─────────────────────────┐                       ┌──────────────────────────────┐
    │  LISTA DE CHAMADA       │                       │  RELATÓRIO DE ATIVIDADE       │
    │  (em branco, p/ imprimir)│                      │  (educador marca presença     │
    │                          │                      │   via UI ou digita o que      │
    │  Origem:                 │                      │   anotou na chamada física)   │
    │  • /presenca/exportar    │                      │                               │
    │    "Chamada"             │                      │  Origem:                      │
    │  • /turmas/:id           │                      │  • /relatorios/novo           │
    │    "Chamada p/ imprimir" │                      │  • /relatorios/:id editar     │
    │  • /turmas               │                      └──────────────┬────────────────┘
    │    "Em massa (ZIP)"      │                                     │
    │                          │                                     │ grava em
    │  Layout:                 │                                     ▼
    │  • Linhas altas (44pt)   │                       ┌──────────────────────────────┐
    │  • Col. observações      │                       │  relatorio_presenca + presenca│
    │  • 3 assinaturas         │                       │  (banco — fonte da verdade)   │
    │  • Sem totais, sem hash  │                       └──────────────┬────────────────┘
    │                          │                                     │
    │  Formato: PDF (XLSX opc.)│                                     │ alimenta
    │  Destino: download direto│                                     ▼
    │  NÃO vai p/ Biblioteca   │                       ┌──────────────────────────────┐
    └─────────────────────────┘                        │   LISTA DE FREQUÊNCIA         │
                                                        │   (preenchida, oficial)       │
                                                        │                               │
                                                        │  Origem:                      │
                                                        │  • Anexo do relatório DOCX/PDF│
                                                        │  • /presenca/exportar         │
                                                        │    "Frequência" (mensal)      │
                                                        │  • /turmas/:id                │
                                                        │    "Frequência do Mês"        │
                                                        │  • REO / Relatório Mensal     │
                                                        │    (consolidado todas turmas) │
                                                        │                               │
                                                        │  Layout:                      │
                                                        │  • ■ presente · vazio ausente │
                                                        │  • J justificada (vermelho)   │
                                                        │  • — sem aula                 │
                                                        │  • (BA) (D) (T) sufixos       │
                                                        │  • Totais + % adesão          │
                                                        │  • Hash curto p/ validação    │
                                                        │  • Assinatura SÓ do educador  │
                                                        │                               │
                                                        │  Formatos: DOCX + PDF + XLSX  │
                                                        │  Destino: download + Biblioteca│
                                                        │  (biblioteca_documentos)      │
                                                        └──────────────┬────────────────┘
                                                                       │
                                                                       ▼
                                                        ┌──────────────────────────────┐
                                                        │   USOS DOWNSTREAM             │
                                                        │  • Anexo de REO               │
                                                        │  • Prestação de Contas        │
                                                        │  • Relatório de Gestão        │
                                                        │  • Auditoria Coordenação      │
                                                        │  • Dashboards (KPI adesão)    │
                                                        └──────────────────────────────┘
```

### Regras de formatação (ambos os modos)
- **Cabeçalho institucional:** PREFEITURA MUNICIPAL DE MEDIANEIRA / SECRETARIA DE ASSISTÊNCIA SOCIAL / CAIA / SCFV — Sociedade Civil Nossa Senhora Aparecida
- **Paleta SCNSA:** título `#9E1B32`, faixas de cabeçalho de tabela `#1F3864`, fundo de info `#E8EEF5`, texto auxiliar `#5A6770`
- **Fonte:** Arial 10pt corpo, 12pt títulos, 14pt cabeçalho do documento
- **Datas:** `DD/MM` no corpo da tabela; `DD/MM/AAAA HH:mm` no rodapé de geração
- **Página:** A4 retrato (210×297mm) com margens 15mm; matriz mensal pode usar paisagem se >15 dias
- **Rodapé sempre presente:** "Documento gerado pelo SysCFV em {data} — {usuário}" + paginação "Página X de Y"
- **Sanitização:** valores nulos/`undefined` viram "—" via `safeStr()` (já existe)

---

## 6. Resumo do que será implementado

1. Glossário Frequência ≠ Chamada aplicado a UI, títulos e arquivos.
2. Módulo unificado `src/lib/listaFrequencia.ts` consolidando os 3 fluxos.
3. Novo gerador específico para Lista de Chamada (PDF para impressão).
4. Renomeação dos botões em `/presenca/exportar`, `/turmas/:id` e `/turmas`.
5. Aplicação da paleta SCNSA, checkbox ■, turmas em linha, tipo humanizado, "Atividades Realizadas" e remoção da coluna assinatura do participante na frequência.
6. Atualização de 3 memórias para fixar o glossário e o padrão.

Sem migração de banco. Sem alterações em Edge Functions nesta rodada (REO/Mensal continuam funcionando — só consumirão o novo módulo numa próxima iteração se você aprovar).
