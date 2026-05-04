## Cadastro múltiplo de participantes (irmãos) no mesmo formulário

Permitir registrar **vários participantes de uma só vez** quando compartilham endereço, responsáveis e dados de família — comum em irmãos vindos do mesmo lar.

### Modelo conceitual

Dividir o formulário atual em dois blocos lógicos:

**Dados da Família (compartilhados — preenchidos 1x)**
- Endereço completo (rua, número, bairro texto, UF, situação de moradia)
- Responsáveis 1 e 2 (nome, vínculo, WhatsApp, CPF do responsável quando aplicável)
- Origem/encaminhamento, responsável técnico
- Categoria de vulnerabilidade
- Restrição alimentar (familiar)
- Bairro do CAIA + Ponto de transporte (geralmente o mesmo para irmãos, mas editável por participante)

**Dados Individuais (1 ficha por participante)**
- Nome completo *
- Data de nascimento, gênero, cor/raça
- CPF do participante
- Escola, série
- Período (manhã/tarde/integral) — pode variar entre irmãos
- Bairro CAIA / Ponto transporte (herdam do bloco família, mas editáveis)
- Início no SCFV
- Foto de perfil
- Laudo, remédio contínuo, outras condições de saúde
- Documentos categorizados (RG, certidão, etc.) — cada criança tem os seus

### Layout da tela

```text
┌─────────────────────────────────────────────────┐
│ [<] Novo Participante                            │
├─────────────────────────────────────────────────┤
│ DADOS DA FAMÍLIA (compartilhados)                │
│  Endereço │ Responsáveis │ Vulnerabilidade...   │
├─────────────────────────────────────────────────┤
│ PARTICIPANTES                                    │
│ ┌─ Participante 1 ──────────────── [remover] ─┐ │
│ │ Foto │ Nome │ Nasc │ CPF │ Escola │ Docs... │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─ Participante 2 ──────────────── [remover] ─┐ │
│ │ ...                                          │ │
│ └─────────────────────────────────────────────┘ │
│ [+ Adicionar outro participante (irmão)]         │
├─────────────────────────────────────────────────┤
│              [Cancelar]  [Salvar todos]          │
└─────────────────────────────────────────────────┘
```

Cada card de participante é colapsável; apenas o último fica expandido por padrão. Topo do card mostra "Participante 2 — Maria Silva (10 anos)" para navegar fácil.

### Comportamento

- **Estado**: `familia` (objeto compartilhado) + `participantes: ParticipanteIndividual[]` (array, mínimo 1).
- **Adicionar**: botão "+ Adicionar outro participante" cria nova ficha vazia (foto/docs próprios).
- **Remover**: ícone X em cada card (desabilitado quando só há 1).
- **Herança de bairro/ponto**: ao mudar bairro CAIA/ponto na família, atualiza por padrão todos os participantes que ainda não tiveram esses campos editados manualmente. Cada ficha pode sobrescrever.
- **Validação**: ao salvar, valida nome + data início de **cada** participante. Erros mostrados no card respectivo, com scroll automático para o primeiro inválido.
- **Salvamento sequencial**: para cada participante, faz upload de foto → INSERT em `participantes` (mesclando dados família + individuais) → upload de documentos → auto-vínculo a turmas compatíveis. Exibe progresso "Salvando 2 de 3...".
- **Resiliência**: se o 2º falhar mas 1º e 3º passarem, mostra toast com sucesso parcial e mantém na tela só os que falharam para nova tentativa.
- **Após sucesso total**: toast "3 participantes cadastrados" e redireciona para `/participantes`.
- **Modo edição**: continua sendo 1 participante (ParticipanteEditarPage não muda).

### Detalhes técnicos

- Refatorar `ParticipanteNovoPage.tsx` separando o estado em `familia` e `participantes[]`.
- Criar componente interno `<ParticipanteIndividualCard>` que recebe `index`, `data`, `onChange`, `onRemove`, e isola foto + documentos + scanner por ficha (cada card tem seu próprio `pendingDocs` e instância de `useDocumentScanner`).
- No submit: `for (const p of participantes) { ...mesma lógica atual... }` reutilizando o pipeline existente (upload foto, INSERT, upload docs, auto-vincular turmas). Sem mudanças de schema, sem migração SQL.
- Detecção de "campo individual editado manualmente" via flag `_overridesBairro`/`_overridesPonto` no item para evitar sobrescrita ao alterar a família.
- O CPF do **participante** continua individual (campo já é por ficha hoje, apenas mal-rotulado como `responsavel1_cpf`).
- Manter checkbox "Estrangeiro/Sem CPF" por ficha individual.
- Verificação de duplicatas (RPC `find_similar_participants` se existir no fluxo atual) executada por participante antes de inserir, com confirmação agregada caso múltiplos batam.

### Arquivos afetados

- `src/pages/participantes/ParticipanteNovoPage.tsx` — refatoração principal.
- (Opcional) extrair `src/pages/participantes/components/ParticipanteIndividualCard.tsx` para legibilidade.

Sem alterações em banco, hooks globais, RLS ou outras páginas.