## Plano: Logs completos no Super Admin + Busca Ativa para Equipe Técnica

### 1. Logs completos e exportáveis nas Configurações (`ConfiguracoesPage.tsx`)

Atualmente a aba "Sistema" mostra apenas as últimas 50 entradas do `audit_log`. Vamos expandir:

- **Criar aba dedicada "Auditoria"** na TabsList (nova aba entre "Equipe" e "Sistema")
- **Carregar todos os logs** (sem limit 50), com paginação client-side (50 por página)
- **Filtros**: por data (de/até), por usuário, por ação, por tabela
- **Exibir todas as colunas**: data, usuário, ação, tabela, registro_id, detalhes, justificativa
- **Botão "Exportar Auditoria"** que gera simultaneamente:
  - **XLSX** com estilo institucional (cabeçalho, bordas, auto-fit) — formato admissível para auditoria
  - **PDF** em landscape com tabela completa via jsPDF + autoTable
- Remover o preview de auditoria da aba "Sistema" (pois agora terá aba própria)

### 2. Aba "Busca Ativa" na Equipe Técnica (`EquipeTecnicaPage.tsx`)

Nova aba na TabsList com quadro visual (cards/kanban):

**Detecção automática** de participantes que precisam de busca ativa:

- Participantes **inativos/desligados** recentes (últimos 60 dias)
- Participantes ativos com **2+ faltas consecutivas** (baseado na tabela `presenca`)

**Quadro visual** (grid de cards, não tabela):

- Cada card mostra: foto (se houver), nome, status, bairro, faltas recentes, responsável/telefone
- Card clicável abre **Sheet lateral (miniatura do perfil)** com:
  - Dados pessoais (nome, nascimento, escola, bairro)
  - Responsáveis + telefones (para contato imediato)
  - Histórico de presença recente (últimos 30 dias)
  - Atendimentos anteriores relacionados (busca_ativa, visita_domiciliar)
  - Botão "Registrar Busca Ativa" que cria atendimento do tipo `busca_ativa` diretamente, com opcao de descrever detalhes da busca ativa, marcar acoes realizadas (contato whatsapp, contato telefonico, visita domiciliar, contato com a rede, e opcoes de status: busca ativa em andamento, vai retornar/ja retornou, encaminhar pra desligamento.

**Acompanhamento**:

- Mostrar badge se já teve busca ativa registrada e quando
- Filtros: por status (todos / só inativos / só com faltas), por bairro

**Exportar Relatório de Busca Ativa**:

- Botão que gera PDF landscape com a lista dos participantes detectados, dados dos responsáveis e status das buscas realizadas (reutilizando o formato já existente no `TurmaDetalhePage`)

### 3. Tabela de acompanhamento de Busca Ativa (migration)

Criar tabela `busca_ativa_registros` para rastrear o acompanhamento:

```sql
CREATE TABLE public.busca_ativa_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id uuid NOT NULL,
  profissional_id uuid NOT NULL,
  data_registro date NOT NULL DEFAULT CURRENT_DATE,
  tipo_contato text NOT NULL DEFAULT 'telefone',
  descricao text NOT NULL DEFAULT '',
  resultado text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.busca_ativa_registros ENABLE ROW LEVEL SECURITY;
-- RLS: tecnico ou coordenacao CRUD
CREATE POLICY "Tecnico ou coord manage busca_ativa" ON public.busca_ativa_registros
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'tecnico') OR has_role(auth.uid(), 'coordenacao'))
  WITH CHECK (has_role(auth.uid(), 'tecnico') OR has_role(auth.uid(), 'coordenacao'));
CREATE POLICY "Authenticated select busca_ativa" ON public.busca_ativa_registros
  FOR SELECT TO authenticated USING (true);
```

Isso permite registrar tentativas de contato (telefone, visita, WhatsApp), resultado, e gerar relatório posterior.

---

### Arquivos alterados


| Arquivo                                          | Mudança                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/pages/configuracoes/ConfiguracoesPage.tsx`  | Nova aba "Auditoria" com logs completos, filtros e exportação XLSX/PDF                   |
| `src/pages/equipe-tecnica/EquipeTecnicaPage.tsx` | Nova aba "Busca Ativa" com quadro de cards, sheet de perfil e registro de acompanhamento |
| Migration                                        | Criar tabela `busca_ativa_registros` com RLS                                             |
