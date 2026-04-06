## Plano: Portal dos Pais / Familiares (atualizado com mapa de transporte)

### Visão Geral

Criar área pública `/familia` onde pais acessam informações dos filhos sem login, autenticando via nome completo da criança + data de nascimento (com busca fuzzy). Se o responsável tem outros filhos, todos aparecem automaticamente (match por `responsavel1_nome` ou `responsavel2_nome`).

---

### Fluxo de Acesso

1. Pai acessa `/familia` → campos **Nome da criança** e **Data de nascimento**
2. Edge Function `public-familia-auth` busca exata (ilike) + fuzzy fallback (similarity > 0.5)
3. Se match fuzzy, pergunta "Este é seu filho(a)?"
4. Após confirmar, busca irmãos pelo `responsavel1_nome` ou `responsavel2_nome`
5. Retorna dados seguros (sem CPF, sem observações sigilosas)

---

### O que o pai vê por filho


| Seção                   | Dados                                                                            |
| ----------------------- | -------------------------------------------------------------------------------- |
| **Resumo**              | Nome, turma, período, status, foto                                               |
| **Transporte**          | Ponto de embarque, horários manhã/tarde, **mapa interativo com ponto destacado** |
| **Atividades Recentes** | Últimos 10 relatórios de atividade onde o filho esteve presente                  |
| **Presença**            | % frequência no mês atual e anterior                                             |
| **Recados**             | Recados enviados pela coordenação/equipe técnica para aquele participante        |
| **Formulários**         | Formulários pendentes e respondidos                                              |


---

### Mapa de Transporte (novo)

Incorporar o mapa do Google Maps com todos os pontos de transporte:

```html
<iframe src="https://www.google.com/maps/d/embed?mid=16Zj-8IkR-08tLtP1LxhQouLxCmuDxYg&ehbc=2E312F&noprof=1" width="100%" height="400"></iframe>
```

**Destaque do ponto da criança:**

- Acima do mapa, exibir card com o nome do ponto, bairro e horários (manhã/tarde) do participante
- O nome do ponto no Google Maps é intuitivo e corresponde ao cadastro — exibir texto "Localize seu ponto: **[nome do ponto]**" para o pai identificar no mapa
- Estilo visual: card com ícone MapPin + cor primária, iframe abaixo com bordas arredondadas. Cor primaria deve bater com a cor do pin dos pontos do mapa.
- Nota: o Google My Maps embed não suporta highlight programático de pins individuais via URL params, então a abordagem é indicar textualmente qual ponto procurar no mapa.

---

### Sistema de Formulários

**Nova tabela `formularios_familia`:**

- `id`, `titulo`, `descricao`, `tipo` (pesquisa, declaracao, autorizacao, outro)
- `campos` (jsonb — array de campos dinâmicos)
- `criado_por` (profile_id), `ativo`, `created_at`
- `destinatario_ids` (uuid[] — null = todos os ativos)

**Nova tabela `formulario_respostas`:**

- `id`, `formulario_id`, `participante_id`, `responsavel_nome`
- `respostas` (jsonb), `created_at`

---

### Arquivos e Alterações


| Arquivo                                           | Descrição                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/familia/FamiliaLoginPage.tsx`          | Tela de acesso: nome + data nascimento, verificação fuzzy                                                                      |
| `src/pages/familia/FamiliaDashboardPage.tsx`      | Painel com abas por filho: resumo, transporte (com mapa embed + destaque do ponto), atividades, presença, recados, formulários |
| `src/pages/familia/FormularioRespostaPage.tsx`    | Página para pai responder formulário                                                                                           |
| `supabase/functions/public-familia-auth/index.ts` | Busca participante + irmãos, retorna dados seguros                                                                             |
| `supabase/functions/public-familia-data/index.ts` | Retorna atividades, presença, recados, formulários                                                                             |
| Migração SQL                                      | CREATE `formularios_familia` + `formulario_respostas` com RLS                                                                  |
| `src/App.tsx`                                     | Rotas `/familia`, `/familia/painel`, `/familia/formulario/:id`                                                                 |


### Segurança (LGPD)

- Nenhum dado sensível exposto (CPF, observações sigilosas, prontuários)
- Edge Functions com service_role, sem JWT público
- Formulários vinculados ao participante, não ao responsável