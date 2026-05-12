Diagnóstico encontrado:

1. Causa direta do loading infinito no botão de login

- Arquivo: `src/pages/auth/LoginPage.tsx`
- O botão entra em loading com `setLoading(true)` antes de chamar `signIn(email, password)`.
- Arquivo: `src/contexts/AuthContext.tsx`
- `signIn()` chama `supabase.auth.signInWithPassword(...)` sem `try/catch`.
- Na reprodução pelo browser, essa chamada rejeitou com `TypeError: Failed to fetch` dentro de `signInWithPassword`.
- Como a Promise rejeita antes de retornar `{ error }`, o código em `LoginPage` nunca chega em `setLoading(false)`. Resultado: o botão fica em “Entrando...” para sempre.

2. Causa provável do travamento ao entrar no sistema

- O login em si está falhando no fetch para o endpoint de autenticação no ambiente de preview.
- Evidência: console do browser mostrou `TypeError: Failed to fetch` em `signInWithPassword`, passando por `src/contexts/AuthContext.tsx` e `src/pages/auth/LoginPage.tsx`.
- A Cloud respondeu como saudável, e os logs de autenticação vieram vazios, o que indica que a requisição nem chegou corretamente ao backend de autenticação.
- Isso bate com um problema conhecido do preview: o script/proxy do ambiente Lovable pode interceptar/quebrar requisições de auth. O teste mais seguro é validar o login no domínio publicado/custom domain.

3. Outro ponto que pode gerar spinner infinito em rotas protegidas

- Arquivo: `src/contexts/AuthContext.tsx`
- `getSession()` também não tem `catch` nem timeout/fallback.
- Se `getSession()` rejeitar ou ficar pendurado, `loading` permanece `true` e `ProtectedRoute` fica mostrando o spinner central indefinidamente.

4. Consultas disparadas após sessão existente

- Ao abrir `/login` com sessão já existente, havia várias requisições `profiles`, `user_roles`, `participantes`, `recados`, `mural_posts` abortadas (`ERR_ABORTED`).
- Isso parece efeito colateral de navegação/abort de página, não a causa primária do botão travado.
- Ainda assim, o app dispara muitas consultas iniciais após login, o que pode piorar a percepção de travamento quando a rede/backend está lento.

5. Relação com o travamento anterior em “Confirmar e lançar 37 despesas”

- Arquivo: `src/pages/financeiro/FinanceiroPage.tsx`
- A função `confirmAndSaveImportedDocs()` coloca `savingDocs = true`, faz matching de orçamento e grava todas as despesas em um único `.insert(cleanRows)`.
- Ela não usa `try/finally`, não tem timeout, não grava em chunks e não preserva snapshot local antes do envio.
- Se `applyOrcamentoMatching()` ou a requisição de insert travar/rejeitar fora do caminho previsto, o loading fica preso e o usuário não tem confirmação se gravou ou não.
- A tentativa de consulta direta aos lançamentos recentes também retornou timeout de conexão, então é possível que o lote tenha ficado preso por latência/conexão no backend naquele momento.

Plano de correção recomendado:

1. Tornar autenticação resiliente

- Envolver `signIn`, `signUp`, `signOut` e `getSession()` com `try/catch/finally`.
- Garantir que qualquer falha de rede retorne erro controlado e nunca deixe loading infinito.
- Adicionar timeout de segurança para `getSession()` e `signInWithPassword()`.

2. Melhorar o feedback do login

- Em falha `Failed to fetch`, mostrar mensagem clara: falha de conexão/autenticação temporária, tentar novamente ou usar o domínio publicado.
- Destravar o botão sempre.
- Se já houver sessão válida e o usuário acessar `/login`, redirecionar de forma segura ou exibir opção de sair/trocar conta.

3. Blindar rotas protegidas contra spinner eterno

- Em `AuthProvider`, se a sessão inicial falhar, finalizar `loading` e tratar como usuário não autenticado.
- Em `ProtectedRoute`, manter fallback seguro para erro de auth em vez de spinner infinito.

4. Corrigir lançamento financeiro em lote

- Alterar `confirmAndSaveImportedDocs()` para usar `try/catch/finally`.
- Salvar snapshot local temporário do lote antes de enviar.
- Inserir despesas em chunks pequenos, por exemplo 5 por vez.
- Exibir progresso real: “Lançando 10/37”.
- Após cada chunk, confirmar sucesso e manter controle dos itens já gravados.
- Só apagar documentos da Caixa de Entrada depois de todos os chunks confirmados.

5. Verificação pós-correção

- Testar login no preview e no domínio publicado.
- Testar falha simulada de rede para confirmar que o botão destrava.
- Testar lote pequeno e lote grande no financeiro, validando que não há loading infinito e que o usuário recebe resultado claro.
- Analisar cloud usage e querys para otimizacao