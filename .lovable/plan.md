## Objetivo

Gerar uma ficha de cadastro individual para cada um dos **320 participantes** (qualquer status: ativo, busca_ativa, desligado), preservando 100% o layout do `.docx` enviado (logo, fonte Nunito, tabelas, cabeçalho), e entregar tudo empacotado em um único `.zip` em `/mnt/documents/`.

## Estratégia

Trabalho como **script Python local** (fora do código do app) — é uma entrega pontual, não uma feature do sistema. Nenhum arquivo do projeto será editado.

### Fluxo

1. **Carregar dados** (1 query consolidada):
   - `participantes` (todos os 320, inclusive `is_teste`) com join em `bairros` (território), `pontos_transporte` (transporte) e turma principal via `turma_participantes` + `turmas`.
   - Para cada participante, buscar **histórico de presença completo**: união de `presenca` direta + interseção via `relatorio_presenca` ↔ `relatorios_atividade` (data + nome/tipo da atividade), deduplicado por (data, atividade).

2. **Preencher o modelo `.docx`** (uma cópia por participante):
   - Descompactar `word/document.xml` uma vez como template-string.
   - Substituir cada bloco `{...}` pelo dado real, usando regex tolerante a quebras de run XML (faço um pré-processo que mescla runs adjacentes para garantir que os placeholders fiquem contíguos).
   - Checkboxes de moradia: trocar o placeholder inteiro por `( X )` ou `(   )` conforme `situacao_moradia`.
   - Pág. 3 — histórico de presença: substituir o placeholder de instrução por uma **tabela OOXML real** (preto/branco, fonte Nunito 10pt, 2 colunas: Data `DD/MM/AAAA` | Atividade), uma linha por presença, ordem cronológica decrescente. Se zero presenças: linha única "Sem presenças registradas".
   - Re-zipar como `.docx` válido.

3. **Converter cada `.docx` → `.pdf`** via LibreOffice headless (`run_libreoffice.py --convert-to pdf`), em lote.

4. **Empacotar** em `/mnt/documents/SysCFV_Fichas_Participantes_2026-06-19.zip`, nome de cada PDF: `SysCFV_Ficha_{NomeTitleCase}_{YYYY-MM-DD}.pdf` (sanitizando caracteres inválidos).

5. **QA visual** (obrigatório):
   - Converter 5 PDFs amostrais (1º, 80º, 160º, 240º, último) para JPG via `pdftoppm` e inspecionar com `code--view`.
   - Checar: logo presente, fonte Nunito mantida, acentuação correta, nenhum `{...}` residual, checkboxes coerentes, tabela de presença renderizada, sem páginas em branco/quebras estranhas.
   - Se algo quebrar, ajustar o script e regerar só os afetados.

## Mapeamento de placeholders → banco

| Placeholder | Fonte |
|---|---|
| nome completo | `participantes.nome_completo` (Title Case) |
| D.N | `data_nascimento` → `DD/MM/AAAA` |
| CPF participante | `participantes.cpf` (formatado `000.000.000-00`) ou "sem registro do dado" |
| GÊNERO | `genero` |
| ORIGEM DO ENC. | `origem_encaminhamento` ou "sem registro do dado" |
| TERRITÓRIO | `bairros.nome` (Alvorada / Parque Independência / Jardim Irene) |
| ESCOLA | `escola` |
| SÉRIE | `serie` (extrair número) |
| TURNO escola | derivado de `dias_contraturno` ou campo específico — fallback "sem registro do dado" |
| TURMA | `turmas.nome` da turma principal (via `turma_participantes`) |
| TRANSPORTE | `pontos_transporte.nome` ou "não precisa" |
| RESP. LEGAL / CPF / VÍNCULO / CONTATO | `responsavel1_nome`, `responsavel1_cpf`, `vinculo_resp1`, `responsavel1_whatsapp` |
| LOGRADOURO / NÚMERO / BAIRRO | `endereco_rua`, `endereco_numero`, `endereco_bairro` |
| Moradia (4 checkboxes) | `situacao_moradia` → marca uma `( X )` |
| LAUDO? | `laudo` (regra "sim" → "Sim, não registrado ou não especificado"; "não" → "Não possui") |
| RESTR. ALIMENTAR? | `restricao_alimentar` (mesma regra) |
| OUTRA CONDIÇÃO? | `outras_condicoes` ou "Nenhuma registrada" |
| Histórico presença | tabela montada de `presenca` + `relatorio_presenca`+`relatorios_atividade` |

## Riscos & mitigação

- **Placeholders quebrados entre `<w:r>`:** mesclo runs antes do replace (script `extract_document.py` da skill docx já faz isso).
- **Nomes longos / caracteres inválidos no filename:** sanitizo (`re.sub(r'[^\w\s-]','')`, trim, max 80 chars) e adiciono sufixo `_id8` se houver colisão.
- **LibreOffice lento para 320 docs:** processo em lotes paralelos (4 workers) com `run_libreoffice.py`; estimativa ~5-10 min total.
- **Memória/zip grande:** PDFs A4 simples ficam ~50-150 KB → zip final estimado 20-50 MB, dentro do limite.
- **Dados faltantes:** todo campo nulo vira "sem registro do dado" (ou regra equivalente acima), nunca string vazia.

## Entrega

Um único artifact:
```
<presentation-artifact path="SysCFV_Fichas_Participantes_2026-06-19.zip" mime_type="application/zip"></presentation-artifact>
```
Acompanhado de um resumo: total gerado, eventuais participantes pulados (e motivo), amostras de QA inspecionadas.

## Detalhes técnicos

- Linguagem: Python 3 no sandbox (psycopg2/psql para dados, `zipfile`+`re` para docx, `subprocess` para LibreOffice, `zipfile` para pacote final).
- Sem alterações no repositório, sem migrations, sem deploy.
- Tempo estimado de execução: 8-12 minutos.
