# Code reference

## `js/app.js`
- `APP` — global state: `catalog`, `drawings`, `currentExtraction`, `currentFiles`,
  `previewZoom`, `reviewRows`, `reviewFilters`, `expandedGroups`
- `switchTab(name)` — tab switching (`upload`/`review`/`catalog`)
- `fetchStore(store)` / `saveStore(store, array)` — GET/POST against `data.mjs`
- `toast(msg)` — simple bottom notification
- `escapeHtml(str)`, `uuid()` — utilities

## `js/upload.js`
- `resizeImage(file, maxSize, quality, callback)` — canvas-based photo downscale (same
  pattern as `gluton`)
- `readFileAsBase64(file, callback)` — used for PDFs, no downscale
- `handleDrawingFiles(fileList)` — accepts multiple files (`multiple` input), prepares
  all in parallel, builds `APP.currentFiles` and calls `analyzeDrawing(files)`
- `analyzeDrawing(files)` — calls `POST analyze-drawing` **once per file, in sequence**
  (not in parallel — avoids overloading the API and keeps the "file N of M" progress
  indicator meaningful), accumulates results, then calls `mergeExtractions(results)`
- `mergeExtractions(results)` — concatenates `components` from every response,
  deduplicating by `tag + component_type` (keeps the version with `poles` determined if
  one of the two is `not_available`)

## `js/review.js`
- `buildReviewRows()` — builds `APP.reviewRows` from the extraction, already running
  catalog matching per row
- `renderReview()` / `renderReviewPreview()` / `renderReviewTable()` — draw the screen
- `applyPreviewZoom()` / `wireZoomControls()` — +/− zoom on the drawing preview (image
  or PDF), via CSS transform on `#preview-zoom-target`
- `buildGroups(entries)` / `groupHeaderRowHtml()` — collapses repeated tags (e.g.
  DCR1..DCR16) into one expandable group row showing quantity; singleton items render
  directly as a normal row
- `wireReviewEvents()` — event delegation (edit poles, expand evidence, accept a
  catalog suggestion, register a new item inline, expand/collapse a group)
- `confirmReviewList()` — saves the reviewed list to the `drawings` store

## `js/catalog.js`
- `renderCatalog()` — draws the catalog table
- `createCatalogEntry(fields)` — used both by the Catalog screen and the inline button
  on the Review screen
- `deleteCatalogEntry(id)`

## `js/match.js`
Pure, stateless functions — see `docs/catalog-schema.md` for the algorithm.

## CSS
`css/style.css` — fixed dark/amber technical theme, `--tap: 48px` for mobile tap
targets, `.review-layout` becomes two columns from 900px up.
