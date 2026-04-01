## Plano: Detecção de rematrícula + padronização + WhatsApp CTA

### Resumo

Ao preencher nome completo e data de nascimento, o sistema consulta o banco via edge function para verificar se o participante já existe. Se encontrar, popula o formulário com os dados existentes e alerta o usuário. Na tela de confirmação pós-envio, exibe link do grupo de WhatsApp do bairro selecionado.

---

### 1. Nova Edge Function `public-check-participante`

**Arquivo:** `supabase/functions/public-check-participante/index.ts`

- Recebe `nome_completo` e `data_nascimento`
- Padroniza o nome (trim, uppercase) e busca por match exato no banco (nome + data nascimento)
- Se encontrar, retorna os dados do participante (sem campos sigilosos como `observacoes_sigilosas`, `categoria_vulnerabilidade`)
- Se não encontrar, retorna `{ found: false }`
- Usa service role (público, sem auth)

### 2. Padronização de dados na edge function `public-matricula`

**Arquivo:** `supabase/functions/public-matricula/index.ts`

- Padronizar `nome_completo`: trim + UPPERCASE
- Padronizar `responsavel1_nome`, `responsavel2_nome`: trim + UPPERCASE
- Padronizar `endereco_rua`, `endereco_bairro`: trim + UPPERCASE
- Padronizar `escola`: trim + UPPERCASE
- Limpar `responsavel1_whatsapp`, `responsavel2_whatsapp`: manter apenas dígitos
- Limpar `responsavel1_cpf`: manter apenas dígitos
- Se `existing_id` for enviado (rematrícula), fazer UPDATE no participante existente em vez de INSERT, e mudar status para `pendente`

### 3. Alterações na página `MatriculaPublicaPage.tsx`

**Detecção de rematrícula:**

- Após o usuário preencher nome completo E data de nascimento, fazer debounce de 800ms e chamar `public-check-participante`
- Se encontrar cadastro existente:
  - Mostrar alerta amarelo: "Este participante já possui cadastro! Confira e atualize os dados abaixo."
  - Preencher todos os campos do formulário com os dados existentes
  - Guardar `existing_id` no state para enviar na submissão (UPDATE em vez de INSERT)
- Padronizar nome no formulário: ao sair do campo nome, converter para UPPERCASE

**Tela de confirmação pós-envio:**

- Substituir a tela atual por uma com:
  - Mensagem de agradecimento em nome da Equipe CAIA 🌍 Medianeira
  - CTA para entrar no grupo de WhatsApp do bairro:
    - ALVORADA → `https://chat.whatsapp.com/CMqGlJdUmRW0YKsGWdEZJK`
    - JARDIM IRENE → `https://chat.whatsapp.com/FTpkWJLY6TzIT25VgdmDft`
    - PARQUE INDEPENDENCIA → `https://chat.whatsapp.com/FTpkWJLY6TzIT25VgdmDft`
  - Botão verde com ícone do WhatsApp: "Entrar no Grupo do WhatsApp"
  - Botão secundário "Fazer outra matrícula"

---

### Arquivos modificados


| Arquivo                                                 | Mudança                                            |
| ------------------------------------------------------- | -------------------------------------------------- |
| `supabase/functions/public-check-participante/index.ts` | Nova: busca participante por nome+nascimento       |
| `supabase/functions/public-matricula/index.ts`          | Padronização + suporte a UPDATE (rematrícula)      |
| `src/pages/matricula/MatriculaPublicaPage.tsx`          | Detecção rematrícula + padronização + WhatsApp CTA |
