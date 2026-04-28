## Roteiros de Visita Domiciliar — Equipe Técnica

Nova funcionalidade para a equipe técnica montar, executar e imprimir roteiros de visita domiciliar a partir de participantes em **Busca Ativa** e **Matrículas Pendentes** (status `busca_ativa`, `pendente` ou `incompleto`).

### Fluxo do usuário

1. Na página **Equipe Técnica**, nova aba **Roteiros de Visita**.
2. Botão "Novo Roteiro" abre wizard:
   - **Passo 1 — Dados:** título, data, horário de saída, responsáveis (multi-select de profissionais), veículo (opcional, texto livre), observações.
   - **Passo 2 — Selecionar visitas:** lista filtrável (status BA / Matrícula Pendente / ambos) agrupada por bairro, com checkbox por participante. Cada linha mostra nome, idade, bairro, telefone, último contato, motivo (BA ou matrícula nova). Contador de visitas selecionadas.
   - **Passo 3 — Ordenar:** drag-and-drop para definir ordem das visitas dentro de cada bairro (usa `@dnd-kit` já instalado).
3. Salvar gera o roteiro e redireciona para `/equipe-tecnica/roteiros/:id`.
4. **Página do Roteiro** mostra:
   - Cabeçalho com data/horário/responsáveis/total de visitas.
   - Visitas agrupadas por bairro, em cards interativos com:
     - Nome, idade/faixa, endereço completo, telefone(s), responsável familiar, observações do cadastro.
     - Badge "Busca Ativa" ou "Matrícula Nova".
     - Status da visita (Pendente / Realizada / Não atendido / Recusou / Endereço não localizado).
     - Campo de relato pós-visita + horário real + botão "Gerar atendimento" (cria registro em `atendimentos` tipo `visita_domiciliar` já vinculado).
   - Botão **Exportar PDF** (formato impressão, 1–2 cards por página, sem elementos interativos).
   - Botão **Concluir roteiro** (marca como finalizado).
5. Lista de roteiros mostra cards com data, status (rascunho/em andamento/concluído), nº visitas e progresso (X de Y realizadas).

### Estrutura de dados (novas tabelas)

```text
roteiros_visita
  id, titulo, data_visita, horario_saida, observacoes,
  responsaveis (uuid[]), veiculo, status (rascunho|em_andamento|concluido),
  criado_por (profile_id), created_at, updated_at, concluido_em

roteiro_visitas
  id, roteiro_id, participante_id, bairro_nome (cache),
  origem (busca_ativa|matricula_pendente),
  ordem (int), status_visita (pendente|realizada|nao_atendido|recusou|endereco_nao_encontrado),
  relato (text), horario_realizado (time), atendimento_id (uuid, fk gerado),
  updated_at
```

**RLS:** SELECT/INSERT/UPDATE/DELETE liberados para `tecnico` e `coordenacao` (mesmo padrão de `atendimentos`). Sem foreign keys rígidas para `auth.users`; FKs entre as duas tabelas com `on delete cascade`.

### Arquitetura técnica

- **Rotas (App.tsx):**
  - `/equipe-tecnica/roteiros/novo` → `RoteiroNovoPage` (wizard)
  - `/equipe-tecnica/roteiros/:id` → `RoteiroDetalhePage`
  - Lista integrada como nova aba dentro de `EquipeTecnicaPage` (sem nova rota só pra lista, evitando inflar sidebar).
- **Componentes novos** (`src/pages/equipe-tecnica/roteiros/`):
  - `RoteirosTab.tsx` — lista de roteiros + botão "Novo".
  - `RoteiroNovoPage.tsx` — wizard 3 passos.
  - `RoteiroDetalhePage.tsx` — cards interativos + ações.
  - `components/VisitaCard.tsx` — card único reutilizável.
  - `components/RoteiroPdfExport.tsx` — gera PDF via `jsPDF` + `autoTable` (libs já no projeto).
- **Hook:** `src/hooks/useRoteirosVisita.ts` — fetch/mutações.
- **Helper:** nome de arquivo via `sysCfvFileName("RoteiroVisita", "pdf", titulo)`.
- **Cuidados anti-quebra:**
  - Apenas **adicionar** rota e aba; não tocar em nenhum fluxo existente da `EquipeTecnicaPage` (apenas inserir 1 nova `<TabsTrigger>` + `<TabsContent>`).
  - Estado da Tab controlado (já é o padrão da página).
  - Migration cria tabelas novas sem alterar existentes.
  - Nenhuma alteração em `src/integrations/supabase/types.ts`, `client.ts`, `.env`.
  - Cast `as any` nas queries Supabase enquanto `types.ts` não regenera (padrão usado em `busca_ativa_registros` e `coordenacao_atividades`).

### Exportação PDF

- A4 retrato, cabeçalho com logo/nome do roteiro/data/responsáveis.
- Para cada bairro: título do bairro, depois cards (nº ordem + dados de cada participante, espaço para anotações).
- Layout limpo, grayscale, fonte sans, footer com paginação.
- Nome: `SysCFV_RoteiroVisita_{titulo}_{YYYY-MM-DD}_{HHmmss}.pdf`.

### Notificações

- Ao criar um roteiro, cria automaticamente um **recado técnico** para cada profissional listado em `responsaveis` (mesma mecânica usada em projetos), apontando para a URL do roteiro.

### Memória

Salvar `mem://funcionalidades/roteiros-visita-domiciliar` documentando estrutura e regras (origem BA/Matrícula, status de visita, geração automática de atendimento).

### Entregáveis

1. Migration SQL com 2 tabelas + RLS + trigger `updated_at`.
2. 5 arquivos novos em `src/pages/equipe-tecnica/roteiros/` + 1 hook.
3. 2 rotas adicionais em `App.tsx`.
4. 1 nova aba em `EquipeTecnicaPage.tsx` (alteração mínima e isolada).
5. Memória registrada.