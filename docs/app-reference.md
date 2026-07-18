# Referência de código

## `js/app.js`
- `APP` — estado global: `catalog`, `drawings`, `currentExtraction`, `currentFile`, `reviewRows`
- `switchTab(name)` — troca de aba (`upload`/`review`/`catalog`)
- `fetchStore(store)` / `saveStore(store, array)` — GET/POST em `data.mjs`
- `toast(msg)` — notificação simples no rodapé
- `escapeHtml(str)`, `uuid()` — utilitários

## `js/upload.js`
- `resizeImage(file, maxSize, quality, callback)` — downscale de fotos via canvas (mesmo padrão do `gluton`)
- `readFileAsBase64(file, callback)` — usado para PDF, sem downscale
- `handleDrawingFile(file)` → `analyzeDrawing(base64, mimeType)` — POST pra `analyze-drawing`, resultado vai pra `APP.currentExtraction` e troca pra aba Revisão

## `js/review.js`
- `buildReviewRows()` — monta `APP.reviewRows` a partir da extração, já rodando o matching de catálogo por linha
- `renderReview()` / `renderReviewPreview()` / `renderReviewTable()` — desenham a tela
- `wireReviewEvents()` — delegação de eventos (editar polos, expandir evidência, aceitar sugestão de catálogo, cadastrar item novo inline)
- `confirmReviewList()` — grava a lista revisada no store `drawings`

## `js/catalog.js`
- `renderCatalog()` — desenha a tabela do catálogo
- `createCatalogEntry(fields)` — usado tanto pela tela de Catálogo quanto pelo botão inline da Revisão
- `deleteCatalogEntry(id)`

## `js/match.js`
Funções puras, sem estado, ver `docs/catalog-schema.md` para o algoritmo.

## CSS
`css/style.css` — cores por `prefers-color-scheme`, `--tap: 48px` pra alvos de toque no mobile, `.review-layout` vira duas colunas a partir de 900px.
