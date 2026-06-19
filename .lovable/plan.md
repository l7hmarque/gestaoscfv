
# Diagnóstico — Por que precisamos de tantos "remendos" para extrair dados fiéis?

## 1. O que o SysCFV se propõe a ser

O SysCFV existe para resolver uma dor concreta da OSC sob convênio SCFV/Assistência Social: **comprovar atendimento real ao Governo** (presença, território, faixa etária, oficinas, vulnerabilidade) com evidência auditável, sem depender de planilhas paralelas. Os KPIs que sustentam o convênio são:

- Únicos atendidos no mês × território × faixa × período
- Frequência (presenças efetivas / previstas)
- Cobertura de oficinas (Karate, Esporte, Artísticas, Dança e Poesia)
- Vulnerabilidade prioritária atendida
- Evasão / busca ativa
- Produtividade da equipe técnica

Tudo isso precisa virar **documento oficial limpo, padronizado e defensável** numa auditoria.

## 2. O que de fato aconteceu nas últimas horas

Para fechar as listas de Maio/2026 com 161 únicos, precisamos aplicar **6 fallbacks empilhados**:

| # | Sintoma | Fallback aplicado | Causa-raiz |
|---|---|---|---|
| 1 | 622 registros com `relatorios_atividade.periodo_atividade` NULL | Cair em `participantes.periodo` | Campo não-obrigatório no formulário; herdou-se a remoção da auto-transferência sem tornar o campo required |
| 2 | 106 registros sem `audit_log` (anteriores a 19/05) | Cair em `educador_id` → `profiles.nome` | `audit_log` foi adotado tardiamente; não houve backfill |
| 3 | Oficineiros (Laila, Felipe, Jenifer) registrando turmas convivência | Filtro anti-oficineiro nos Blocos A/B/D/E | Não há restrição de escopo por papel — qualquer profissional pode lançar qualquer relatório |
| 4 | Dança e Poesia sem registrador identificável | Literal "Fabio Barbosa Pereira" | Oficina existe operacionalmente mas o oficineiro não está como `profiles` ativo ou nunca foi vinculado |
| 5 | Tags de oficina inconsistentes (`tipo_atividade`) | Trocar filtro por tag pelo filtro por `educador_id` | Vocabulário de `tipo_atividade` é livre/array, sem catálogo controlado |
| 6 | Participante de Parque Independência marcado por equipe de Alvorada | Aba de divergências | Não há validação `bairro_participante == território_relator` |

E ainda: nomes de aba truncados (limite Excel 31 chars), normalização de bairro feita em runtime, "Profissional Registrador" precisando ser reconstruído via JOIN triplo (audit_log → relatorios → profiles).

## 3. Causa-raiz sistêmica (não é bug, é arquitetura)

O SysCFV opera hoje como **"cadastro permissivo + reconstituição na exportação"**:

```text
ENTRADA (qualquer um lança qualquer coisa, campos opcionais)
        │
        ▼
ARMAZENAMENTO (relatorios_atividade com 33 colunas, várias nullable, sem invariantes)
        │
        ▼
EXPORTAÇÃO (script forense reconstrói verdade via 6 fallbacks)
        │
        ▼
DOCUMENTO OFICIAL
```

Isso inverte a lógica esperada para um sistema de comprovação:

```text
ENTRADA validada → ARMAZENAMENTO íntegro → EXPORTAÇÃO trivial
```

Cada relatório de auditoria vira um projeto forense porque a **integridade foi adiada** — empurrada do momento da escrita para o momento da leitura. Resultado: toda exportação reescreve a mesma lógica de saneamento, com risco de divergir entre relatórios (o número do Bloco C pode bater num relatório e não bater em outro, dependendo de qual fallback foi aplicado).

## 4. Plano de saneamento estrutural

Quatro frentes, da mais barata e de maior impacto para a mais profunda. Cada uma é entregável independente — não precisa fazer tudo de uma vez.

### Frente 1 — Catálogos controlados (1-2 dias)

Eliminar campos livres que viram "vocabulário paralelo":

- **`tipo_oficina` enum** (`karate`, `esporte`, `artistica`, `danca_poesia`, `convivencia`) substituindo o array livre `tipo_atividade`. Migração com mapeamento determinístico dos valores atuais.
- **`papel_profissional` enum** em `profiles` (`oficineiro`, `educador_social`, `tecnico`, `coordenacao`, `apoio`).
- **`territorio` enum** já existe — garantir que `participantes.bairro` e `profiles.territorio_atuacao` usam o mesmo catálogo.

Ganho: filtros de exportação viram `WHERE tipo_oficina = 'karate'` em vez de heurística por `educador_id`.

### Frente 2 — Invariantes no momento da escrita (2-3 dias)

Mover validação do export para o insert/update:

- **Trigger** em `relatorios_atividade`: bloquear `periodo_atividade` NULL; quando NULL, preencher automaticamente com `participantes.periodo` no próprio trigger (não no export).
- **RLS/Policy de escopo por papel**: oficineiro só consegue inserir relatório com `tipo_oficina` da sua especialidade. Educador social não consegue inserir oficina.
- **Trigger de coerência territorial**: bloquear (ou marcar `flag_divergencia=true`) quando `relator.territorio != participante.bairro`. Marcar é mais seguro que bloquear — preserva o registro mas sinaliza para revisão.
- **Backfill obrigatório** de `audit_log` para os 106 registros pré-19/05 — uma vez, via migration, usando `educador_id` como autor presumido + nota "autor inferido".

Ganho: a partir da migração, **zero novos casos** precisarão de fallback. O histórico fica congelado e documentado.

### Frente 3 — Camada de verdade única (3-4 dias)

Criar uma **view materializada** `relatorios_atividade_canonico` que aplica os fallbacks **uma vez**, no banco, e é a fonte única para todas as exportações:

```text
relatorios_atividade  ──┐
audit_log             ──┼─► v_relatorio_canonico ─► todos os exports
profiles              ──┤      (periodo resolvido,
participantes         ──┘       registrador resolvido,
                                tipo_oficina resolvido,
                                divergencia_territorial flag)
```

Refatorar `exportListaPresenca.ts`, `generate-listas-frequencia-mes-*`, `generate-relatorio-mensal`, `useRelatorioGestao` para consumir essa view. Acaba a divergência entre relatórios e some o risco de cada export reimplementar fallback diferente.

### Frente 4 — Painel de qualidade de dados permanente (1 dia, depois contínuo)

Criar rota `/coordenacao/qualidade-dados` mostrando em tempo real:

- Relatórios com campos críticos faltando (período, educador, tipo_oficina)
- Divergências territoriais pendentes
- Oficineiros lançando fora do escopo
- Participantes sem turma no mês corrente
- Cobertura de `audit_log`

Cada item com link direto para correção. Vira rotina da coordenação, não evento de auditoria.

## 5. Ordem recomendada e impacto

```text
Frente 1 (catálogos)        ──► destrava as outras três
Frente 2 (invariantes)      ──► impede regressão; precisa Frente 1
Frente 4 (painel qualidade) ──► visibilidade imediata enquanto F3 não chega
Frente 3 (view canônica)    ──► consolidação final; depende de F1+F2
```

Depois das Frentes 1+2, a próxima exportação de lista de presença será **uma query**, não uma operação forense. O sistema passa a *garantir* os KPIs em vez de *reconstituí-los*.

## 6. O que NÃO está neste plano (por escolha)

- Reescrita do formulário de relatório — só ajustes pontuais para refletir os enums.
- Migração de dados históricos além do backfill de `audit_log` — o histórico fica como está, a view canônica resolve a leitura.
- Mudanças de UI/UX — a dor é de modelo de dados, não de interface.

## Próximo passo

Confirmar quais frentes priorizar. Recomendo começar por **Frente 1 + backfill da Frente 2** numa mesma migration — é o que tem maior razão impacto/risco e desbloqueia o resto.
