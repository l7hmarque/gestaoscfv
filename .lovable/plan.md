## Diagnóstico atual (38 turmas ativas)

Rodei um varredor agora:

- ✅ **0 turmas sem educador** (Laila, Fabio, Jenifer e Felipe cobrem 100%)
- ✅ **0 turmas vazias** (todas com participantes)
- ✅ **0 duplicatas** por oficina+bairro+faixa+período
- ✅ **0 turmas sem dias da semana**
- ⚠️ **3 turmas com ≤2 participantes** (todas no turno Tarde de ALVORADA 6-8) — possível gargalo
- ⚠️ **4 participantes ativos sem nenhuma turma vinculada** — gap real
- ⚠️ **ATIVIDADES CULTURAIS, ESPORTE e KARATE não têm faixa 12-17** — só DANÇA tem (unificada multi-bairro). Falta de cobertura para adolescentes nessas oficinas
- ℹ️ 2 turmas com bairro NULL: `DANCA E POESIA — 12-17 — TODOS OS BAIRROS` (manhã e tarde) — intencional, mas o restante da UI precisa saber lidar

## O que vou fazer

### 1. TurmasPage — painéis por oficina
Em vez do grid plano atual, agrupar em **um painel por oficina**, cada painel com:

```text
┌── KARATE  ·  Felipe Gomes da Silva  ·  12 turmas  ·  100 part. ─┐
│  [card turma 1]  [card turma 2]  [card turma 3] ...             │
└─────────────────────────────────────────────────────────────────┘
┌── DANÇA E POESIA  ·  Fabio  ·  10 turmas  ·  168 part. ─────────┐
│  ...                                                             │
└──────────────────────────────────────────────────────────────────┘
```

- Cabeçalho mostra educador(es) vinculado(s), contagem de turmas e total de participantes
- Cards continuam clicáveis para /turmas/:id (mesma navegação)
- Filtros (busca, período, faixa, status) continuam funcionando — só muda o agrupamento visual

### 2. Botão "PDF Relação de Turmas"
Novo botão no header da TurmasPage. Gera **um PDF** com:

- Capa institucional (SysCFV, data de geração, total de turmas/participantes)
- Uma seção por oficina (com educador no topo)
- Para cada turma: nome, bairro, período, faixa, dias da semana, educador, lista numerada de participantes (com marcador BA para busca ativa)
- Rodapé com paginação

Usa `jspdf` + `jspdf-autotable` (já no projeto se possível, senão adiciono).

### 3. Painel "Revisar educadores das turmas"
Novo botão no header (`<UserCheck/> Revisar educadores`). Abre um Dialog mostrando **todas as 38 turmas agrupadas por oficina**, cada linha com:

- Nome da turma
- Combobox de educador (lista de profissionais ativos) — pré-preenchido com o atual
- Botão "Salvar tudo" no rodapé que persiste só as mudanças

Mesmo sem nenhuma turma faltando educador hoje, o painel serve para você revisar/confirmar rapidamente.

### 4. Melhor seletor de turma em /presenca e /relatorios/novo
Mudar a hierarquia para **OFICINA → BAIRRO → PERÍODO/FAIXA** (faz mais sentido já que a chamada é por oficina):

```text
KARATE
 ├── ALVORADA
 │    ├── Manhã · 6-8
 │    ├── Manhã · 9-11
 │    ├── Tarde · 6-8
 │    └── Tarde · 9-11
 ├── JARDIM IRENE
 │    └── ...
 └── PARQUE INDEPENDÊNCIA
      └── ...
```

- Extrair em `<TurmaSelectAgrupado>` reutilizável (Presença usa Select; Relatório Novo usa lista de checkboxes — ambos usam a mesma estrutura agrupada).
- Indicador ★ continua para turmas vinculadas ao educador da sessão.
- Turmas "TODOS OS BAIRROS" (DANÇA 12-17) ficam em um grupo "Multi-bairro" no topo da oficina.

### 5. Card de diagnóstico de gaps no topo da TurmasPage
Banner compacto colapsável com os 3 alertas acima:

- "3 turmas com baixa frequência (≤2 participantes)" → clica e expande
- "4 participantes ativos sem turma" → link para /participantes filtrado
- "Cobertura 12-17 ausente em KARATE, ESPORTE, ATIV. CULTURAIS" → informativo

## O que NÃO vou fazer agora
- Não vou alterar `educador_id` de nenhuma turma automaticamente (você decide no painel novo)
- Não vou criar turmas 12-17 faltantes — só alerto (você decide se vale abrir)
- Não vou desativar as 3 turmas baixa frequência — só alerto

## Arquivos afetados
- `src/pages/turmas/TurmasPage.tsx` (reagrupar + 2 botões novos + banner)
- `src/components/TurmaSelectAgrupado.tsx` (novo)
- `src/components/ReviewEducadoresDialog.tsx` (novo)
- `src/lib/exportRelacaoTurmasPdf.ts` (novo — geração do PDF)
- `src/pages/presenca/PresencaPage.tsx` (usa o novo Select)
- `src/pages/relatorios/RelatorioNovoPage.tsx` (usa o novo agrupamento)

Sem mudanças de schema, RLS ou edge function.
