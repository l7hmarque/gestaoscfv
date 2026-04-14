
## Plano: Cronograma Semanal — Redesign com Drag & Drop

### 1. Filtrar apenas bairros SCFV no cronograma

Filtrar `bairros` para mostrar apenas Jardim Irene, Alvorada e Parque Independência usando `isBairroSCFV` de `constants.ts`.

### 2. Visual — Bordas e cores

- Bordas `border-2` com cores distintas por bairro
- Slots preenchidos com cor por tipo (educador, oficineiro, turma)

### 3. Drag & Drop — Stack lateral de recursos

Layout 2 colunas:
- **Sidebar**: Stacks arrastáveis de educadores, oficineiros e turmas com indicador de slots ocupados
- **Grade**: 3 bairros × 2 períodos × 5 dias

HTML5 Drag & Drop nativo com efeitos visuais de pick & drop, highlight animado na célula-alvo, salvamento automático via upsert.

### 4. Menu de Regras e Disponibilidade

Painel "Configurações" com:
- Disponibilidade dos profissionais (dias × períodos)
- Regras configuráveis (mínimo dias/bairro, máximo slots/profissional, rodízio oficinas)

Nova tabela SQL: `cronograma_disponibilidade`

### 5. Validação em tempo real

Warnings visuais para conflitos, indisponibilidade, mínimo de dias não atendido.

### 6. Relatório técnico — Manual E com IA

Botão "Gerar Relatório do Cronograma" disponível TANTO para montagem manual quanto para geração com IA:
- Analisa a distribuição atual do cenário ativo (mesmo que montado manualmente pelo usuário)
- Gera relatório técnico: critérios atendidos, pontos fracos, sugestões de melhoria organizacional
- Exportável em PDF/DOCX

### 7. Geração automática com IA (botão separado)

Botão "Gerar Cronograma Otimizado" que preenche a grade automaticamente usando Lovable AI, considerando regras e disponibilidade cadastradas. Após gerar, o relatório técnico também é produzido.

### 8. FIX: Exportações sempre geram arquivo novo

**Problema**: ao exportar listas de presença, o sistema serve versão cacheada antiga (ex: paleta azul em vez da nova grayscale).

**Solução**: Garantir que toda exportação recalcula e gera o arquivo do zero a cada clique:
- Verificar se há memoização/cache de blob ou URL em `exportSingleListaPresenca`, `exportAllListasPresenca` e nos componentes que os chamam
- Verificar se há Service Worker ou cache HTTP interferindo
- Garantir que o `buildSheet` é chamado fresh a cada export

### Arquivos afetados

1. **SQL migration**: tabela `cronograma_disponibilidade`
2. **`src/pages/cronograma/CronogramaPage.tsx`**: reescrita completa
3. **`src/lib/constants.ts`**: importar `BAIRROS_SCFV`
4. **Componentes/hooks de exportação**: fix de cache
5. **Edge function ou Lovable AI inline**: geração de relatório técnico + cronograma otimizado
