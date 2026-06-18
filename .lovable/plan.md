# Listas de Presença Maio/2026 — v2 (executar)

Únicos preservados: **161** (idêntico à auditoria). Verificado.

## Mudanças sobre a v1

1. **Coluna única "Profissional Registrador"** em todas as abas. Sem sufixos `(relator)`/`(registrou)`. Fonte: `audit_log.user_nome` quando existir, senão `relatorios_atividade.educador_id → profiles.nome`.
2. **Filtro anti-oficineiro nos Blocos A, B, D, E**: descarto qualquer registro cujo registrador resolvido seja Laila, Felipe ou Jenifer. 39 participantes ficam só nas abas do Bloco C (todos têm tag de oficina compatível, nenhum órfão).
3. **Dança e Poesia (manhã/tarde)**: coluna registrador = texto literal **"Fabio Barbosa Pereira"** em todas as linhas.
4. **Bloco C corrigido**:
  - Filtros por tag usam `'tag' = ANY(tipo_atividade)` (era igualdade de string).
  - Karate = registros do Felipe + tag `karate`.
  - Esporte = registros da Jenifer + tag `futebol_esportes`/`esporte_recreacao`.
  - Artísticas = registros da Laila + tag `arte_cultura` (volta a ter dados).
  - Só gera aba (profissional × bairro × faixa × período) com ≥1 registro real.
5. **Fallback de período**: `periodo_atividade` nulo → usa `participantes.periodo` (recupera 622 registros que estavam em limbo).
6. **Fallback de registrador**: 106 registros sem `audit_log` (anteriores a 19/05) usam `educador_id`. Cobertura final = 100%.
7. **Aba de validação**: total únicos = 161, registros = 819, distribuição por aba, lista de participantes que saíram dos Blocos A/B/D/E por serem registrados só por oficineiros.
8. **Aba de divergências**: ex. participante de Parque Independência marcado por equipe de Alvorada.
9. **Aba de qualidade**: relatórios com `periodo_atividade` nulo, por profissional, para cobrança.

## Saída

Arquivo único `/mnt/documents/SysCFV_ListasPresenca_Maio2026_<timestamp>.xlsx`, estilo black and white padrão SysCFV.