

## Plano: Paleta grayscale nas listas de presença exportadas

### Mudança

Atualizar todos os estilos de cor em `src/lib/exportListaPresenca.ts` para usar apenas preto, cinza e branco, substituindo azuis (#1A5276, #2C3E50, #EBF5FB) e verde (#D5F5E3).

### Mapeamento de cores

| Elemento | Cor atual | Nova cor |
|---|---|---|
| Cabeçalho institucional (fundo) | Azul claro #EBF5FB | Cinza claro #F0F0F0 |
| Cabeçalho institucional (texto) | Azul #1A5276 | Preto #000000 |
| Subtítulo (texto) | Azul escuro #2C3E50 | Preto #333333 |
| Título "LISTA DE PRESENÇA" (fundo) | Azul #1A5276 | Preto #333333 |
| Título (texto) | Branco #FFFFFF | Branco #FFFFFF (mantém) |
| Nome da turma (fundo) | Verde #D5F5E3 | Cinza médio #E0E0E0 |
| Cabeçalho tabela (fundo) | Azul #1A5276 | Cinza escuro #444444 |
| Cabeçalho tabela (texto) | Branco | Branco (mantém) |
| Desligados (strike color) | #999999 / #CC8800 | #999999 / #888888 |

### Arquivo afetado

- `src/lib/exportListaPresenca.ts` — apenas substituição de valores de cor nos objetos de estilo (linhas ~52-95)

Nenhuma alteração de estrutura, apenas valores hexadecimais.

