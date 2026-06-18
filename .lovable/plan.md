## Objetivo

Enriquecer o XLSX `SysCFV_PresentesMaio2026_2026-06-18_173301.xlsx` com a auditoria de presenças de maio/2026: para cada participante listado, mostrar em quais datas houve presença, quem registrou e a evidência (log do sistema).

## Fontes de dados

1. **`presenca`** (check-in diário) — colunas: `participante_id`, `data`, `presente`, `criado_por`, `created_at`.
2. **`relatorio_presenca`** (presença vinculada a relatório de atividade) — JOIN com `relatorios_atividade` para obter `data`, `criado_por`, `created_at`.
3. **`audit_log`** — buscar entradas referentes a inserção/edição em `presenca` e `relatorio_presenca` no intervalo 01–31/maio/2026 (filtro por `tabela` e `registro_id`/payload).
4. **`profiles`** — resolver `criado_por` (UUID) → nome do profissional.

## Estrutura do novo arquivo

Arquivo novo (versionado, não sobrescreve o original):
`/mnt/documents/SysCFV_PresentesMaio2026_Auditoria_v2_{YYYY-MM-DD}_{HHmmss}.xlsx`

### Abas

1. **18 abas originais** (bairro × período × faixa) — mantidas iguais à v1, com colunas adicionais:
   - `#`, `Nome Completo`, `Idade`, `Data de Nascimento`
   - **Datas com Presença (Maio)** — lista compacta `DD/MM` separadas por vírgula
   - **Qtd. Presenças**
   - **Registrado por (resumo)** — nomes únicos dos profissionais que marcaram, separados por `;`

2. **Aba `Auditoria Detalhada`** — uma linha por (participante × data × fonte):
   - `Nome Completo`, `Bairro`, `Período`, `Faixa`
   - `Data` (DD/MM/2026)
   - `Fonte` (`presenca` ou `relatorio_presenca`)
   - `ID do Registro` (UUID da linha de presença/relatorio_presenca)
   - `Marcado por` (nome do profissional via `profiles`)
   - `UUID do autor`
   - `Registrado em` (timestamp `created_at`)
   - `Relatório vinculado` (UUID do `relatorios_atividade`, se aplicável)
   - `Log de auditoria` (texto: ação + timestamp + usuário do `audit_log` correspondente; se ausente, marcar `— sem entrada em audit_log —`)

3. **Aba `Resumo por Data`** — agregação por data de maio:
   - `Data`, `Qtd. Participantes Presentes`, `Qtd. Registros (presenca)`, `Qtd. Registros (relatorio_presenca)`, `Profissionais que registraram` (lista única)

## Detalhes técnicos

- Query única via `psql COPY` juntando `presenca` + `relatorio_presenca` + `relatorios_atividade` + `participantes` + `bairros` + `profiles`, filtrada por datas de maio/2026 e pelos participantes da lista v1.
- Query separada em `audit_log` filtrando `created_at` em maio/2026 e `tabela IN ('presenca','relatorio_presenca')`, com cruzamento por `registro_id`.
- Quando não houver linha em `audit_log` (registros antigos ou sem trigger), preencher com fallback: `INSERT detectado via created_at={timestamp} por {profile.nome}` (a partir do próprio registro).
- Geração com `openpyxl` (estilo grayscale do padrão SysCFV, header institucional via `xlsxInstHeader` equivalente, auto-fit 60 chars).
- Sem alterações no app, no banco ou em edge functions.

## Entrega

Novo arquivo `SysCFV_PresentesMaio2026_Auditoria_v2_*.xlsx` em `/mnt/documents/`, exposto via `<presentation-artifact>`. Arquivo v1 permanece intacto.