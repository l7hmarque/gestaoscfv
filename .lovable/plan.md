## Plano: Correções e Novas Funcionalidades

Este é um conjunto grande de mudanças. Vou dividir em blocos priorizados.

---

### 1. BUG FIX — Campos de texto no cadastro de participante

**Causa raiz**: O componente `Field` está definido **dentro** do corpo do componente `ParticipanteNovoPage` (linha 204). Isso faz com que o React o trate como um componente novo a cada re-render, desmontando e remontando o `<input>`, causando perda de foco ao digitar.

**Correção**: Mover `Field` para fora do componente, recebendo `form`, `set` como props, ou substituir por JSX inline.

**Arquivo**: `src/pages/participantes/ParticipanteNovoPage.tsx`

---

### 2. Relatórios no Financeiro — Consolidação

**O que**: Na página `/financeiro`, disponibilizar 3 downloads:

- **REO** (XLSX + PDF) — já existe via edge function, adicionar botões diretos
- **Prestação de Contas** (XLSX + PDF) — já existe parcialmente, consolidar
- **SIT .txt** — já implementado

**Alteração**: Reorganizar a seção de exportações em `FinanceiroPage.tsx` com botões claros para cada relatório, cada um baixando tanto XLSX quanto PDF simultaneamente (ou com dropdown).

**Arquivo**: `src/pages/financeiro/FinanceiroPage.tsx`

---

### 3. PDFs com layout customizado

Para gerar PDFs que sigam fielmente o layout dos seus documentos institucionais, a melhor abordagem é:

**O que você precisa me fornecer**: Faça upload dos arquivos `.docx` ou `.pdf` dos modelos diretamente neste chat. Eu vou analisar a estrutura (cabeçalhos, tabelas, margens, fontes) e replicar no código usando `jsPDF` + `autoTable`, ou gerar HTML→PDF via edge function.

**Não precisa converter para HTML** — basta enviar os documentos originais (.docx/.pdf) que eu extraio o layout.

---

### 4. Geração de turmas em lote — Dias por bairro/faixa

**O que**: Ao gerar turmas em lote, permitir especificar dias da semana diferentes para cada combinação bairro + faixa etária.

**UX proposta**: 

1. Usuário seleciona bairros, faixas e períodos (como hoje)
2. Abaixo, aparece uma grade com as combinações geradas
3. Cada linha da grade tem checkboxes de dias da semana editáveis
4. Por padrão, todas começam com os dias selecionados no filtro geral
5. Usuário ajusta individualmente se necessário

**Arquivo**: `src/pages/turmas/TurmaNovaPage.tsx`

---

### 5. Relatório da Equipe Técnica

**O que**: Nova funcionalidade na página `/equipe-tecnica` para gerar relatório com:

- Seletor de intervalo de datas (início/fim)
- Lista de atendimentos no período
- Para cada atendimento: participante, tipo, descrição, encaminhamentos
- Exportar em XLSX e PDF

**Arquivo**: `src/pages/equipe-tecnica/EquipeTecnicaPage.tsx`

---

### 6. Rotas de Transporte — Cronograma do Motorista

**O que**: Na aba Transporte, nova funcionalidade para:

- Criar rotas diárias (ex: "Rota Segunda Manhã") agrupando pontos numa ordem
- Quadro visual tipo cronograma semanal para o motorista consultar
- Cada rota mostra: horário, pontos em sequência, bairro, nº de participantes

**Necessita**: Nova tabela `rotas_transporte` no banco (id, nome, dia_semana, periodo, ordem dos pontos como JSON ou tabela associativa).

**Arquivos**: 

- Migração SQL para `rotas_transporte` e `rota_pontos`
- `src/pages/dashboard/DashboardTransporteTab.tsx`

---

### Ordem de implementação sugerida

1. **Bug fix campos de texto** (imediato, 1 arquivo)
2. **Dias por bairro/faixa no lote** (1 arquivo)
3. **Relatório equipe técnica** (1 arquivo)
4. **Consolidar downloads no financeiro** (1 arquivo)
5. **Rotas de transporte** (migração + 1 arquivo)
6. **PDFs com layout** (após receber os modelos)

### Sobre os PDFs

Envie os modelos (.docx ou .pdf) dos relatórios REO e Prestação de Contas neste chat para que eu replique o layout fielmente nos PDFs gerados pelo sistema.  
  
Mantenha esse plano, mas nao precisa implementar a rota de transporte agora. Antes de iniciar, aguarde eu enviar os documentos modelo. Para facilitar, liste no chat os documentos que preciso enviar os modelos.