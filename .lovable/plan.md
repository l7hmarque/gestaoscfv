

## Plano: Aprovar pendência inline + Máscaras CPF/Telefone + Renomear "Bairro SCFV"

### 1. Botão "Aprovar" na listagem de pendentes (`ParticipantesPage.tsx`)

- Na tabela, quando `status === "pendente"`, adicionar botão "Aprovar" (ícone Check) na coluna de ações, ao lado do botão "Ver"
- Ao clicar, atualizar `status` para `"ativo"` diretamente + executar a mesma automação de vínculo a turmas que já existe no `ParticipantePerfilPage` (linhas 128-141)
- Extrair a lógica de aprovação para uma função reutilizável ou duplicar inline

### 2. Botão "Aprovar" no perfil do participante (`ParticipantePerfilPage.tsx`)

- Quando `participante.status === "pendente"` e não está editando, exibir botão "Aprovar Matrícula" no header (ao lado de Editar/Imprimir)
- Ao clicar, chamar a mesma lógica: update status → ativo + vínculo automático a turmas + recarregar

### 3. Máscaras de CPF e Telefone

Criar funções utilitárias em `src/lib/utils.ts`:
- `maskCPF(value: string): string` — formata como `000.000.000-00` (aplica máscara durante digitação)
- `maskPhone(value: string): string` — formata como `(00) 00000-0000`
- `unmaskDigits(value: string): string` — remove não-dígitos para armazenamento

**Onde aplicar:**

| Página | Campo CPF | Campo Telefone |
|---|---|---|
| `MatriculaPublicaPage.tsx` | `responsavel1_cpf` — com checkbox "Estrangeiro/Sem CPF" que desativa máscara | `responsavel1_whatsapp`, `responsavel2_whatsapp` |
| `ParticipanteNovoPage.tsx` | `responsavel1_cpf` — com checkbox "Estrangeiro/Sem CPF" | `responsavel1_whatsapp`, `responsavel2_whatsapp` |
| `ParticipantePerfilPage.tsx` | `responsavel1_cpf` no modo edição — com checkbox | `responsavel1_whatsapp`, `responsavel2_whatsapp` no modo edição |
| `BancoDadosPage.tsx` | Exibir CPF e WhatsApp já formatados com máscara na renderização da coluna |

**Nota sobre o CPF**: O campo `responsavel1_cpf` no banco armazena o CPF do responsável. Conforme solicitado, será renomeado no label para "CPF do Participante" onde aplicável, e a máscara será aplicada. A opção "Estrangeiro/Sem CPF" permite texto livre sem máscara.

**Armazenamento**: Continuar armazenando apenas dígitos no banco (padronização existente). A máscara é apenas visual no input.

### 4. Renomear "Bairro SCFV" → "Bairro do CAIA que vai frequentar"

| Arquivo | Local |
|---|---|
| `MatriculaPublicaPage.tsx` | Label do Select (linha 476) |
| `ParticipanteNovoPage.tsx` | Label do Select (linha 280) |
| `ParticipantePerfilPage.tsx` | Label no modo edição (linha 321) |
| `ParticipantesPage.tsx` | Cabeçalho da tabela (linha 146) → "Bairro CAIA" (versão curta para caber) |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/utils.ts` | Funções `maskCPF`, `maskPhone`, `unmaskDigits` |
| `src/pages/participantes/ParticipantesPage.tsx` | Botão aprovar inline + renomear coluna + máscara telefone na exibição |
| `src/pages/participantes/ParticipantePerfilPage.tsx` | Botão aprovar no header + máscara CPF/telefone nos campos de edição + renomear label |
| `src/pages/participantes/ParticipanteNovoPage.tsx` | Máscara CPF/telefone + checkbox estrangeiro + renomear label |
| `src/pages/matricula/MatriculaPublicaPage.tsx` | Máscara CPF/telefone + checkbox estrangeiro + renomear label bairro |
| `src/pages/banco-dados/BancoDadosPage.tsx` | Renderizar CPF e telefone com máscara nas colunas |

