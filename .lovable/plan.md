

## Plano: Abrir PDF no navegador em vez de baixar

Trocar o comportamento do link do Termo de Uso de Imagem para abrir em nova aba (o navegador exibe com seu reader nativo), em vez de forçar download.

### Mudança

**`src/pages/matricula/MatriculaPublicaPage.tsx`** — remover o atributo `download` do link do PDF, mantendo `target="_blank"`. O navegador abrirá o PDF no reader integrado, onde o usuário pode ler, imprimir ou baixar por conta própria.

