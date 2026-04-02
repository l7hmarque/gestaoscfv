## Plano: Módulo da Equipe Técnica

### Resumo

Criar um módulo dedicado para Assistentes Sociais e Psicólogas com: prontuário de atendimentos por participante, dashboard técnico com indicadores relevantes, e alertas compartilhados (frequência + matrículas pendentes). O prontuário fica vinculado ao perfil do participante e é exportável em PDF profissional.

---

### 1. Migração SQL — Tabela `atendimentos`

Nova tabela para registrar atendimentos técnicos:


| Coluna             | Tipo                      | Descrição                                                                                                                   |
| ------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`               | uuid PK                   | &nbsp;                                                                                                                      |
| `participante_id`  | uuid NOT NULL             | Ref participante                                                                                                            |
| `profissional_id`  | uuid NOT NULL             | Ref profiles (quem atendeu)                                                                                                 |
| `data_atendimento` | date NOT NULL             | &nbsp;                                                                                                                      |
| `tipo`             | text NOT NULL             | visita_domiciliar, atendimento_individual, atendimento_familiar, encaminhamento, busca_ativa, acolhida, desligamento, outro |
| `descricao`        | text NOT NULL             | Relato do atendimento                                                                                                       |
| `encaminhamento`   | text                      | Encaminhamento realizado (se houver)                                                                                        |
| `sigiloso`         | boolean DEFAULT true      | Visível apenas para técnicos e coordenação                                                                                  |
| `created_at`       | timestamptz DEFAULT now() | &nbsp;                                                                                                                      |


**RLS**: SELECT/INSERT/UPDATE/DELETE somente para roles `tecnico` e `coordenacao`. Visitante e educador não acessam.

---

### 2. Página `/equipe-tecnica` — Painel Técnico

Nova página `src/pages/equipe-tecnica/EquipeTecnicaPage.tsx` com abas:

**Aba "Dashboard":**

- KPIs: Total atendimentos (mês), atendimentos por tipo (pie chart), participantes atendidos (unique count), encaminhamentos pendentes
- Alertas de frequência (mesma lógica da TurmaDetalhePage: 3+ faltas ou adesão < 65%)
- Banner de matrículas pendentes (count + link para `/participantes?status=pendente`)
- Gráfico: atendimentos por mês (line chart)
- Indicadores sugeridos: % participantes com laudo, distribuição por vulnerabilidade, participantes sem atendimento há 30+ dias

**Aba "Atendimentos":**

- Lista de todos os atendimentos com filtros (período, tipo, profissional)
- Botão "Novo Atendimento" que abre formulário com select de participante + campos
- Cada registro mostra: participante, data, tipo, resumo, profissional

**Aba "Alertas":**

- Participantes com alerta de frequência (3+ faltas consecutivas ou adesão < 65%)
- Matrículas pendentes aguardando aprovação
- Participantes sem atendimento técnico há 30+ dias (sugestão) - revogar.

---

### 3. Prontuário no Perfil do Participante

`**ParticipantePerfilPage.tsx**`: Adicionar seção "Prontuário Técnico" (visível apenas para `tecnico` e `coordenacao`), abaixo de "Observações Sigilosas":

- Lista cronológica de atendimentos daquele participante
- Botão "Novo Atendimento" inline (formulário compacto: data, tipo, descrição, encaminhamento)
- Botão "Exportar Prontuário PDF"

---

### 4. Exportação do Prontuário em PDF

Função `exportProntuarioPdf(participante, atendimentos)` em `useDocumentExport.ts`:

- Header institucional: "PRONTUÁRIO TÉCNICO — SCFV/CAIA"
- Dados do participante: nome, data nascimento, faixa etária, bairro, período, responsáveis, contatos, escola, série, laudo, vulnerabilidade
- Tabela cronológica de atendimentos: data, tipo, profissional, descrição, encaminhamento
- Observações sigilosas (se houver)
- Rodapé: data de emissão, profissional que exportou
- Design técnico com cores institucionais (vermelho CAIA)

---

### 5. Navegação e Roteamento

- `AppSidebar.tsx`: Item "Equipe Técnica" (ícone `ShieldCheck` ou `HeartHandshake`) — visível para todos mas funcionalidades restritas por RLS
- `App.tsx`: Rota `/equipe-tecnica`

---

### 6. Sugestões de funcionalidades extras incluídas


| Funcionalidade                   | Descrição                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Agendamento de atendimentos      | Campo `data_agendamento` futuro, aparece como lembrete na aba Alertas                          |
| Indicador "sem atendimento 30d"  | Participantes ativos que não têm nenhum registro de atendimento nos últimos 30 dias - revogar. |
| % com laudo                      | KPI mostrando quantos participantes ativos possuem laudo registrado                            |
| Distribuição por vulnerabilidade | Gráfico com categorias de vulnerabilidade dos participantes                                    |
| Encaminhamentos ativos           | Contador de atendimentos tipo "encaminhamento" sem resolução                                   |


---

Funcionalidade: com base nos dias de atendimento das turmas e informacoes necessarias, mostrar mapa de calor de dias da semana com probabilidade de maior volume de usuarios.  
Funcionalidade: enviar recado a educador/profissional = seleciona pra quem e o recado e sobre qual participante é (opcional), o recado vai aparecer no mural somente pro educador/profissional marcado. Profissional marcado vai receber um alerta em um menu de notificacoes (que sempre fica no header de todas as paginas) -> educador pode checar "Ciente!" e técnico sabe que ele viu o recado.  
Funcionalidade: educador pode apertar botao no header da pagina para enviar recado aos tecnicos, podendo vincular a um participante tambem. tecnicos sao notificados tambem em sessao de notificacoes, e tambem vai aparecer em mural apenas visivel pros tecnicos.

### Arquivos


| Arquivo                                              | Mudança                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| Migração SQL                                         | Tabela `atendimentos` + RLS para tecnico/coordenacao         |
| `src/pages/equipe-tecnica/EquipeTecnicaPage.tsx`     | Nova — dashboard + atendimentos + alertas                    |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Seção prontuário com lista + novo atendimento + exportar PDF |
| `src/hooks/useDocumentExport.ts`                     | Função `exportProntuarioPdf`                                 |
| `src/components/AppSidebar.tsx`                      | Item "Equipe Técnica"                                        |
| `src/App.tsx`                                        | Rota `/equipe-tecnica`                                       |
