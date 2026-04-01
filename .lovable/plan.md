## Plano: Página pública de matrícula CAIA com uploads e aprovação

### Alterações em relação ao plano anterior

1. **Sem opção "Integral"** — apenas Manhã e Tarde
2. **Upload de documentos** — categorias: Laudo Médico, Receita, Comprovante Escolar, Outro.
3. **Branding "CAIA"** — título e design especificam "Matrícula — CAIA"
4. **Ponto de transporte** — seletor filtrado pelo bairro SCFV selecionado, com link para mapa do Google Maps
5. **Vinculação automática** — ao aprovar (mudar status de `pendente` → `ativo`), sistema vincula à turma compatível por bairro, faixa etária e período
6. **Lista de pendentes com alerta** — banner na ParticipantesPage mostrando quantidade de matrículas pendentes não visualizadas

---

### 1. Migração SQL

- Adicionar `'pendente'` ao enum `status_participante`
- Adicionar coluna `visualizado_em timestamptz` na tabela `participantes` (null = não visualizado ainda, usado para alertas)

### 2. Edge Function `public-matricula`

**Arquivo:** `supabase/functions/public-matricula/index.ts`

- Recebe dados do formulário + documentos como base64
- Insere participante com `status = 'pendente'`
- Faz upload dos documentos no bucket `documentos` (privado) e insere em `participante_documentos`
- Usa service role para bypassar RLS
- Valida campos obrigatórios (nome, responsável, whatsapp)

### 3. Página pública `/matricula`

**Arquivo:** `src/pages/matricula/MatriculaPublicaPage.tsx`

- Layout independente (sem sidebar/header do app)
- Título: "Matrícula Online — CAIA" com branding  
Subtitulo: Após realizar a matricula, necessário assinar e nos enviar Termo de Autorização de Uso de Imagem, baixe e imprima aqui: botao pra baixar o pdf do termo.
- Campos:
  - Nome completo*, Data nascimento*, Gênero, Cor/Raça
  - Escola, Série
  - **Período**: apenas Manhã ou Tarde (sem Integral)
  - Endereço: Rua, Número, Bairro
  - **Bairro SCFV**: hardcoded (JARDIM IRENE, PARQUE INDEPENDENCIA, ALVORADA)
  - **Ponto de transporte**: seletor filtrado por bairro selecionado (carrega pontos ativos via edge function ou query pública)
  - Link: "Confira a localização dos pontos no mapa" → `https://www.google.com/maps/d/edit?mid=16Zj-8IkR-08tLtP1LxhQouLxCmuDxYg&usp=sharing`
  - Responsável 1: Nome*, CPF, WhatsApp*
  - Responsável 2: Nome, WhatsApp
  - Restrição alimentar, Observações de saúde
  - **Upload de documentos**: botões por categoria (mesmas do sistema interno), aceita PDF/imagem, múltiplos por categoria
- Tela de confirmação após envio.

### 4. Edge Function auxiliar `public-pontos`

**Arquivo:** `supabase/functions/public-pontos/index.ts`

- Retorna pontos de transporte ativos filtrados por bairro (para a página pública que não tem auth)
- Recebe `bairro_nome` como parâmetro, busca bairro_id correspondente e retorna pontos

### 5. Rota no App.tsx

- `<Route path="/matricula" element={<MatriculaPublicaPage />} />` fora do ProtectedRoute

### 6. Lista de pendentes na ParticipantesPage

**Arquivo:** `src/pages/participantes/ParticipantesPage.tsx`

- Adicionar `pendente` ao `statusLabel` e `statusColor`
- Banner no topo: "X matrículas online aguardando aprovação" (conta participantes com status `pendente`)
- Badge de alerta: se há pendentes com `visualizado_em IS NULL`, mostrar ícone de notificação
- Ao clicar no banner, filtra por status `pendente`
- Ao visualizar perfil de pendente, atualiza `visualizado_em` com timestamp atual

### 7. Aprovação com vinculação automática

**Arquivo:** `src/pages/participantes/ParticipantePerfilPage.tsx`

- Ao mudar status de `pendente` → `ativo` no save, executar lógica existente de vinculação automática (calcFaixaFromDate + match turma por bairro/faixa/período)
- A lógica de auto-link já existe no handleSave — garantir que funciona para transição `pendente` → `ativo`

---

### Arquivos modificados


| Arquivo                                              | Mudança                                        |
| ---------------------------------------------------- | ---------------------------------------------- |
| Migração SQL                                         | `pendente` no enum + coluna `visualizado_em`   |
| `supabase/functions/public-matricula/index.ts`       | Nova: insere participante + documentos         |
| `supabase/functions/public-pontos/index.ts`          | Nova: retorna pontos ativos por bairro         |
| `src/pages/matricula/MatriculaPublicaPage.tsx`       | Nova: formulário público de matrícula CAIA     |
| `src/App.tsx`                                        | Rota `/matricula` pública                      |
| `src/pages/participantes/ParticipantesPage.tsx`      | Banner de pendentes + alerta + status pendente |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Marcar `visualizado_em` + auto-link ao aprovar |
