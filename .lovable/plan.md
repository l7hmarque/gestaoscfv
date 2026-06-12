# Saneamento — versão final aprovada

## Decisões consolidadas
- **Grupo A (5 ativos)**: limpar campos de desligamento, manter `status='ativo'`.
- **Grupo B (6 desligados)**: `status='desligado'`, `data_desligamento=NULL`, `desligado_registrado_em=now()`.
- **`turma_participantes` do Grupo B**: `data_saida = data da última P` ou, se nunca houve P, `data_saida = data_entrada`. Na prática todos caem no segundo caso (zero P).
- **`presenca` do Grupo B**: apagar **apenas registros com `presente = false` E `justificada = false`** (faltas puras, F). Manter **J (justificada)** — pois se foi justificada, havia vínculo real reconhecido.

## Migration (uma única transação)

1. **5× `UPDATE participantes`** (Grupo A): zera `data_desligamento`, `motivo_desligamento`, `desligado_registrado_em`, `justificativa_desligamento`.
2. **6× `UPDATE participantes`** (Grupo B): seta `status='desligado'`, `data_desligamento=NULL`, `desligado_registrado_em=now()`, `motivo_desligamento` preservado quando vier do import, `justificativa_desligamento` = nota explicativa do saneamento.
3. **Para cada `turma_participantes` aberto dos 6 do Grupo B**:
   ```sql
   UPDATE turma_participantes
      SET data_saida = COALESCE(
            (SELECT MAX(data_aula) FROM presenca
              WHERE participante_id = tp.participante_id
                AND turma_id = tp.turma_id
                AND presente = true),
            tp.data_entrada
          ),
          motivo_saida = 'Saneamento 12/06/2026: vínculo encerrado por inexistência de presença real'
    WHERE ...
   ```
4. **`DELETE FROM presenca`** dos 6 do Grupo B onde `presente = false AND justificada = false` (apaga só **F**, preserva **J**).
5. **11× `INSERT INTO audit_log`** (`acao='saneamento_data_desligamento'`) com payload `{antes, depois, faltas_apagadas: N}` por participante.

## Verificação pós-migration
SELECT consolidado mostrando:
- Estado final dos 11 participantes (status + todos os campos de desligamento).
- Vínculos de turma dos 6 do Grupo B com `data_saida` calculada.
- Contagem de registros `presenca` removidos por participante.
- Amostra: contagem de membros das turmas afetadas em maio/2026 e junho/2026 antes vs. depois (para evidenciar a correção retroativa dos KPIs).

## Próximas etapas (fora desta migration)
- **Trigger preventivo `participantes_status_sync`** (rejeita `data_desligamento > CURRENT_DATE`; limpa campos quando status sai de `desligado`).
- **Auditoria ampla "Zero P"** dos 175 candidatos, com aprovação em blocos.
- **`get_participantes_turma` / RPCs de chamada**: garantir filtro `tp.data_saida IS NULL OR tp.data_saida > data_da_chamada` para que vínculos fechados retroativamente não reapareçam.
