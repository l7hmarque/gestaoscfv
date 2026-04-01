

## Plano: Frequência por participante na turma + PDF profissional de Busca Ativa

---

### 1. Mostrar % de frequência e última presença de cada participante na tabela da turma

**Arquivo:** `src/pages/turmas/TurmaDetalhePage.tsx`

Os dados já são carregados na `fetchAll` (linha 88-89: `presData` com `participante_id, data, presente`). Basta calcular para TODOS os membros (não só alertas):

- Criar um estado `memberStats: Record<string, { pctFreq: number; lastDate: string | null }>` 
- No `fetchAll`, para cada membro, calcular:
  - `pctFreq = (presentes / total) * 100` (ou "—" se sem registros)
  - `lastDate` = data mais recente onde `presente === true`
- Adicionar duas colunas na tabela de participantes (linhas 380-419):
  - **Frequência** (ex: `78.5%`)
  - **Última Presença** (ex: `28/03/2026`)

### 2. Exportar Busca Ativa como PDF profissional

**Arquivo:** `src/pages/turmas/TurmaDetalhePage.tsx`

Trocar o export DOCX atual (linhas 185-239) por um PDF usando `jsPDF` + `jspdf-autotable`:

- Cabeçalho institucional com título "RELATÓRIO DE BUSCA ATIVA — SCFV"
- Dados da turma: nome, bairro, período, educador, data de emissão
- Texto: "Participantes em alerta: X"
- Tabela com colunas: Nº, Nome, Idade, Responsável 1, Telefone 1, Responsável 2, Telefone 2, Endereço, Última Presença, Motivo do Alerta
- Rodapé com "Documento gerado pelo SysELO" e data
- Fonte técnica, bordas, cabeçalhos em negrito com fundo cinza

---

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/turmas/TurmaDetalhePage.tsx` | Colunas % frequência e última presença na tabela; PDF de Busca Ativa |

