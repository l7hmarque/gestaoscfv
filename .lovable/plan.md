## Plano: Conta de Visitante (Modo Demo)

### Ideia central

Botão "Experimentar como Visitante" na tela de login que faz login automático com uma conta demo. O visitante navega e interage normalmente, mas todas as operações de escrita (salvar, deletar, editar) são interceptadas e mostram um toast "Modo demonstração — alterações não são salvas" sem executar a operação.

---

### Etapas

#### 1. Adicionar `visitante` ao enum `app_role`

- Migration: `ALTER TYPE app_role ADD VALUE 'visitante'`

#### 2. Criar conta demo via edge function (one-time)

- Email: `visitante@syselo.demo` / Senha: `visitantecaia`
- Criar user via admin API, atribuir role `visitante`
- Pode ser executado manualmente uma vez pela DevPage ou via edge function

#### 3. Botão na LoginPage

- Abaixo do formulário: botão outline "Experimentar como Visitante" com ícone de olho
- Ao clicar, faz `signIn("visitante@syselo.demo", "visitantecaia")` automaticamente
- Texto auxiliar: "Navegue pelo sistema sem alterar dados reais"

#### 4. Hook `useIsDemo()`

- **Arquivo novo:** `src/hooks/useIsDemo.ts`
- Busca roles do usuário logado e retorna `true` se tiver role `visitante`
- Cache com React Query para não repetir consulta

#### 5. Interceptar escritas nas páginas

- Criar helper `guardDemo(isDemo: boolean): boolean` que, se demo, dispara toast e retorna `true` (bloqueia)
- Aplicar no início de cada `handleSave`, `handleDelete`, `handleSubmit` dos arquivos:
  - `ParticipanteNovoPage`, `ParticipantePerfilPage`
  - `TurmaNovaPage`, `TurmaDetalhePage`
  - `PlanejamentoNovoPage`, `PlanejamentoDetalhePage`
  - `RelatorioNovoPage`, `RelatorioDetalhePage`
  - `PresencaPage` (salvar presença)
  - `DevPage` (gestão de roles)

Padrão simples em cada handler:

```typescript
const isDemo = useIsDemo();
// no handler:
if (isDemo) { toast.info("Modo demonstração — alterações não são salvas"); return; }
```

#### 6. RLS adicional (segurança no banco)

- Política de INSERT/UPDATE/DELETE nas tabelas principais negando para role `visitante` via `has_role`
- Garante que mesmo manipulando o frontend, nada é gravado

---

### Arquivos modificados


| Arquivo                        | Mudança                                     |
| ------------------------------ | ------------------------------------------- |
| Migration SQL                  | `ALTER TYPE app_role ADD VALUE 'visitante'` |
| `src/hooks/useIsDemo.ts`       | Novo hook + helper `guardDemo`              |
| `src/pages/auth/LoginPage.tsx` | Botão "Experimentar como Visitante"         |
| ~10 páginas de formulário      | Guard no início dos handlers de escrita     |
