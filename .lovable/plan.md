

## Plano: Substituir Script RPA por Despesa.txt (pipe-separated)

### Alteração única em `src/pages/financeiro/FinanceiroPage.tsx`

Substituir a função `generateRPAScript` (linhas 439-513) e o botão (linhas 536-538) por:

**Função `generateDespesaTxt`:**
- Sem linha de cabeçalho — começa direto com dados
- Separador `|` entre campos
- Formato por linha: `CódigoLançamento|DataDespesa|Valor|CNPJ|TipoDocumento|NúmeroDocumento|Descrição`
- Valor sem "R$", sem pontos de milhar, com ponto decimal: `714.00`
- Campos sem dado ficam vazios entre pipes: `dado1||dado3`
- CNPJ só dígitos
- Descrição com pipes internos removidos
- Data convertida de `YYYY-MM-DD` para `DD/MM/YYYY`
- Extensão obrigatoriamente `.txt`
- Nome do arquivo: `SysELO_Despesa_{mesRef}_{timestamp}.txt`

**Botão:** texto "Exportar SIT", ícone `Download`

### Exemplo de saída

```text
12345/2026|06/04/2026|714.00|12345678000199|Nota Fiscal|101|Compra de materiais
|15/04/2026|250.50||Recibo||Serviço de limpeza
```

