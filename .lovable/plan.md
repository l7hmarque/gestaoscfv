

## Plano: Scanner FTP, Fluxo Financeiro, Recados Aprimorados e Lista de Presença em Tabela

São 5 blocos de trabalho. Vou detalhar cada um.

---

### 1. Importação via Scanner FTP (Financeiro + Chamadas dos Educadores)

**Contexto**: Scanners FTP gravam arquivos em uma pasta de rede. Como o app roda no navegador, não há acesso direto ao FTP do scanner. A abordagem viável é:

**Abordagem**: Criar uma interface de **upload em lote** que simula o fluxo do scanner — o usuário seleciona múltiplos arquivos (PDFs/imagens) de uma pasta local (onde o scanner FTP grava) e o sistema processa cada um.

**Para o Financeiro**:
- Na aba de Despesas, botão "Importar Documentos do Scanner" que aceita múltiplos arquivos
- Cada arquivo é comprimido, enviado ao Storage, e opcionalmente passa pela IA (detect-despesa-from-doc) para pré-preencher dados
- Fila visual mostrando progresso de cada arquivo com status (processando / detectado / confirmado)

**Para os Educadores (Chamadas Assinadas)**:
- Na página de Turmas ou Relatórios, botão "Upload de Chamada Assinada"
- Educador seleciona a turma, mês/ano, e faz upload do PDF/imagem digitalizada
- Arquivo é salvo no bucket `documentos` com categoria `chamada_assinada`
- Esses arquivos ficam disponíveis para anexar ao REO

**Arquivos afetados**:
- `src/pages/financeiro/FinanceiroPage.tsx` — importação em lote financeiro
- `src/pages/turmas/TurmaDetalhePage.tsx` — upload de chamada assinada
- Migração: tabela `chamadas_assinadas` (turma_id, mes_referencia, arquivo_url, uploaded_by, created_at)

---

### 2. Melhorar Fluxo Financeiro (Pipeline de Compras)

**Problema**: Informações espalhadas entre abas, difícil saber o que falta para fechar cada compra.

**Solução**: Adicionar um **painel de status por despesa** na aba principal, com indicadores visuais claros:

- Cada despesa mostra badges de status: ✅ NF Anexada, ✅ Boleto Anexado, ✅ Comprovante Anexado, ⏳ Aguardando Pagamento, ✅ Pago
- Filtros rápidos: "Pendentes", "Aguardando Pagamento", "Completas"
- Card resumo no topo: "X despesas completas / Y pendentes / Z aguardando pagamento"
- Ao clicar em uma despesa, abrir painel lateral ou dialog mostrando todos os documentos vinculados e o que falta

**Arquivos afetados**:
- `src/pages/financeiro/FinanceiroPage.tsx` — filtros, badges de completude, card resumo

---

### 3. Lista de Presença no Relatório Exportado (Tabela com Checkboxes)

**Problema**: No PDF/DOCX exportado, a lista de presença aparece como texto corrido, difícil de ler.

**Solução**: Já existe uma tabela no DOCX (linhas 461-478 de useDocumentExport.ts) com colunas Nº/Nome/Presente/Justificativa. O problema deve estar no **PDF** (linhas 608-622) que usa autoTable mas pode estar ficando ruim visualmente. Vou:

- Garantir que no DOCX a tabela use ☑/☐ ao invés de ✓/✗ para melhor legibilidade
- No PDF, melhorar o autoTable com cores (verde para presente, vermelho para ausente) e checkbox visual
- Verificar se a lista no template também está formatada corretamente

**Arquivo afetado**:
- `src/hooks/useDocumentExport.ts` — seções de presença no DOCX e PDF

---

### 4. Recados/Notificações Aprimorados

**Mudanças necessárias**:

a) **Número de identificação**: Adicionar coluna `numero` (serial auto-incremento) na tabela `recados`

b) **Remetente vê seus recados**: Modificar o filtro no `NotificationBell.tsx` para incluir recados onde `remetente_id === myProfileId`

c) **Clicável com detalhes**: Ao clicar em uma notificação, abrir um dialog com o conteúdo completo, histórico de status (lido/ciente), e link para o participante

d) **Badge no perfil do profissional**: Na página `ProfissionalPerfilPage`, mostrar badge com contagem de recados não lidos

e) **Auditoria**: Registrar no `audit_log` quando um recado é criado, lido ou marcado como ciente

**Arquivos afetados**:
- Migração: `ALTER TABLE recados ADD COLUMN numero serial`
- `src/components/NotificationBell.tsx` — filtro expandido, dialog de detalhes, número de ID
- `src/components/SendRecadoDialog.tsx` — log de auditoria ao enviar
- `src/pages/profissional/ProfissionalPerfilPage.tsx` — badge de recados

---

### 5. Sobre a Integração FTP Direta

Uma integração FTP nativa (onde o app se conecta diretamente ao scanner) **não é possível no navegador** por questões de segurança. As alternativas são:

- **Opção atual (recomendada)**: O scanner FTP grava numa pasta local/rede → o usuário abre essa pasta no dialog de upload do navegador → seleciona todos os arquivos → o sistema processa em lote
- **Opção avançada (futura)**: Criar uma Edge Function que monitora um bucket S3/Storage onde um script local (rodando no servidor do scanner) faz upload via API

---

### Prioridade de Implementação

1. Lista de presença em tabela nos relatórios exportados (rápido)
2. Recados aprimorados (número, clicável, auditoria, badge)
3. Upload em lote de documentos (financeiro + chamadas)
4. Pipeline visual do fluxo financeiro
5. Upload de chamadas assinadas pelos educadores

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| Migração SQL | `numero` serial em recados + tabela `chamadas_assinadas` |
| `src/hooks/useDocumentExport.ts` | Tabela de presença com ☑/☐ e cores |
| `src/components/NotificationBell.tsx` | Dialog detalhes, filtro remetente, número ID, auditoria |
| `src/components/SendRecadoDialog.tsx` | Auditoria ao enviar |
| `src/pages/financeiro/FinanceiroPage.tsx` | Upload lote, pipeline visual, filtros |
| `src/pages/turmas/TurmaDetalhePage.tsx` | Upload chamada assinada |
| `src/pages/profissional/ProfissionalPerfilPage.tsx` | Badge recados |

