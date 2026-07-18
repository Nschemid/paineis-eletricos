function buildReviewRows() {
  var extraction = APP.currentExtraction;
  APP.reviewRows = (extraction.components || []).map(function (item) {
    var match = matchComponent(item, APP.catalog);
    var poles = item.poles;
    var resolvedVia = 'extraction';

    if (item.pole_source === 'not_available' && match.status === 'confirmed') {
      poles = match.candidates[0].poles;
      resolvedVia = 'catalog';
    }

    var suggestedCable = null;
    var cableMismatch = false;
    if (item.rated_current_a && typeof findCableForCurrent === 'function') {
      suggestedCable = findCableForCurrent(item.rated_current_a);
      if (suggestedCable && item.drawing_cable_size_mm2) {
        var statedArea = parseFloat(item.drawing_cable_size_mm2);
        if (!isNaN(statedArea) && statedArea < suggestedCable.area_mm2) cableMismatch = true;
      }
    }

    return Object.assign({}, item, {
      poles: poles,
      resolved_via: resolvedVia,
      matchStatus: match.status,
      matchCandidates: match.candidates,
      showEvidence: false,
      showAddForm: false,
      suggested_cable: suggestedCable,
      cable_mismatch: cableMismatch
    });
  });
}

function renderReview() {
  var extraction = APP.currentExtraction;
  if (!extraction) return;

  buildReviewRows();
  APP.reviewFilters = { type: '', tag: '' };
  APP.expandedGroups = {};
  APP.previewZoom = 1;
  var tagInput = document.getElementById('filter-tag');
  if (tagInput) tagInput.value = '';
  renderReviewHeader();
  renderReviewPreview();
  populateTypeFilterOptions();
  renderReviewTable();
  wireReviewEvents();
  wireReviewFilters();
  wireZoomControls();
}

function renderReviewHeader() {
  var el = document.getElementById('review-title');
  if (!el) return;
  var d = APP.currentExtraction.drawing || {};
  el.textContent = [d.number, d.title, d.project].filter(Boolean).join(' — ') || 'Drawing analyzed';
}

function renderReviewPreview() {
  var wrap = document.getElementById('review-preview');
  if (!wrap) return;
  var files = APP.currentFiles || [];
  if (!files.length) { wrap.innerHTML = ''; return; }

  if (APP.activePreviewIndex >= files.length) APP.activePreviewIndex = 0;
  var f = files[APP.activePreviewIndex];

  var tabs = '';
  if (files.length > 1) {
    tabs = '<div class="preview-tabs" style="width:100%;display:flex;flex-wrap:wrap;gap:4px;padding:8px 8px 0">' +
      files.map(function (file, i) {
        var active = i === APP.activePreviewIndex ? ' style="background:var(--accent);color:var(--accent-contrast)"' : ' class="secondary"';
        return '<button data-preview-index="' + i + '"' + active + ' style="padding:4px 10px;min-height:32px;font-size:0.75rem">' + escapeHtml(file.name) + '</button>';
      }).join('') +
      '</div>';
  }

  var content;
  if (f.isPdf) {
    content =
      '<div style="width:100%">' +
      '<embed id="preview-zoom-target" src="' + f.previewUrl + '" type="application/pdf">' +
      '<p class="hint" style="padding:8px"><a href="' + f.previewUrl + '" target="_blank" rel="noopener">Open PDF in a new tab</a> if the preview doesn\'t appear here.</p>' +
      '</div>';
  } else {
    content = '<img id="preview-zoom-target" src="' + f.previewUrl + '" alt="Drawing">';
  }

  wrap.innerHTML = tabs + content;

  wrap.querySelectorAll('[data-preview-index]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      APP.activePreviewIndex = parseInt(btn.dataset.previewIndex, 10);
      APP.previewZoom = 1;
      renderReviewPreview();
    });
  });

  applyPreviewZoom();
}

var ZOOM_STEP = 0.25;
var ZOOM_MIN = 0.5;
var ZOOM_MAX = 3;

function applyPreviewZoom() {
  var target = document.getElementById('preview-zoom-target');
  if (target) target.style.transform = 'scale(' + APP.previewZoom + ')';
  var label = document.getElementById('zoom-level');
  if (label) label.textContent = Math.round(APP.previewZoom * 100) + '%';
}

function wireZoomControls() {
  var zoomIn = document.getElementById('zoom-in');
  var zoomOut = document.getElementById('zoom-out');
  var zoomReset = document.getElementById('zoom-reset');
  if (!zoomIn || zoomIn.dataset.wired) return;
  zoomIn.dataset.wired = '1';

  zoomIn.addEventListener('click', function () {
    APP.previewZoom = Math.min(ZOOM_MAX, Math.round((APP.previewZoom + ZOOM_STEP) * 100) / 100);
    applyPreviewZoom();
  });
  zoomOut.addEventListener('click', function () {
    APP.previewZoom = Math.max(ZOOM_MIN, Math.round((APP.previewZoom - ZOOM_STEP) * 100) / 100);
    applyPreviewZoom();
  });
  zoomReset.addEventListener('click', function () {
    APP.previewZoom = 1;
    applyPreviewZoom();
  });
}

function confBadgeClass(conf) {
  if (conf === 'low') return 'conf-low';
  if (conf === 'medium') return 'conf-medium';
  return 'conf-high';
}

function cableCellHtml(row) {
  if (!row.rated_current_a) return '<span class="hint">—</span>';
  var cell = row.rated_current_a + 'A';
  if (row.suggested_cable) {
    cell += ' → <strong>' + escapeHtml(row.suggested_cable.code) + '</strong>';
    if (row.cable_mismatch) {
      cell += '<br><span class="badge badge-bad">drawing says ' + escapeHtml(row.drawing_cable_size_mm2) + 'mm² — undersized</span>';
    }
  } else {
    cell += '<br><span class="badge badge-muted">no cable rated this high</span>';
  }
  return cell;
}

function matchBadgeHtml(row) {
  if (row.matchStatus === 'confirmed') {
    return '<span class="badge badge-ok">✓ catalog</span>';
  }
  if (row.matchStatus === 'suggested') {
    return '<button class="evidencia-toggle" data-action="toggle-suggest">? suggestion (' + row.matchCandidates.length + ')</button>';
  }
  return '<span class="badge badge-muted">— no match</span>';
}

function rowMatchesFilter(row) {
  var f = APP.reviewFilters;
  if (f.type && row.component_type !== f.type) return false;
  if (f.tag && row.tag.toUpperCase().indexOf(f.tag.toUpperCase()) === -1) return false;
  return true;
}

function genericDescription(desc) {
  return String(desc || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function tagRangeLabel(tags) {
  if (tags.length === 1) return tags[0];
  var prefix = tagPrefix(tags[0]);
  var nums = tags.map(function (t) {
    var m = t.match(/(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  });
  if (nums.indexOf(null) === -1) {
    var min = Math.min.apply(null, nums);
    var max = Math.max.apply(null, nums);
    return prefix + min + '–' + prefix + max;
  }
  return tags.slice(0, 3).join(', ') + (tags.length > 3 ? '...' : '');
}

function worstConfidence(list) {
  if (list.indexOf('low') !== -1) return 'low';
  if (list.indexOf('medium') !== -1) return 'medium';
  return 'high';
}

function aggregateValue(entries, getter) {
  var vals = entries.map(getter);
  var allSame = vals.every(function (v) { return v === vals[0]; });
  return allSame ? vals[0] : null;
}

// Groups filtered {row, index} entries by tag prefix + type + generic description
// (e.g. DCR1..DCR16 -> one group), so repeated tags collapse into an expandable
// row showing quantity instead of flooding the table with near-identical rows.
function buildGroups(entries) {
  var groups = {};
  var order = [];
  entries.forEach(function (entry) {
    var row = entry.row;
    var prefix = tagPrefix(row.tag) || row.tag;
    var desc = genericDescription(row.description);
    var key = prefix + '|' + row.component_type + '|' + desc;
    if (!groups[key]) {
      groups[key] = { key: key, type: row.component_type, description: desc, entries: [] };
      order.push(key);
    }
    groups[key].entries.push(entry);
  });
  return order.map(function (key) { return groups[key]; });
}

function groupHeaderRowHtml(g, gi, expanded) {
  var tags = g.entries.map(function (e) { return e.row.tag; });
  var poles = aggregateValue(g.entries, function (e) { return e.row.poles; });
  var source = aggregateValue(g.entries, function (e) { return e.row.pole_source; });
  var brand = aggregateValue(g.entries, function (e) { return e.row.brand; });
  var matchStatus = aggregateValue(g.entries, function (e) { return e.row.matchStatus; });
  var resolved = aggregateValue(g.entries, function (e) { return e.row.resolved_via; });
  var confidence = worstConfidence(g.entries.map(function (e) { return e.row.confidence; }));

  var sourceLabel = source !== null
    ? ({ legend: 'Legend', symbol: 'Symbol', not_available: 'Not available' }[source] || source)
    : 'various';
  var catalogLabel = matchStatus === null ? '<span class="hint">various</span>' :
    matchStatus === 'confirmed' ? '<span class="badge badge-ok">✓ catalog</span>' :
    matchStatus === 'suggested' ? '<span class="badge badge-warn">? suggestion</span>' :
    '<span class="badge badge-muted">— no match</span>';
  var statusLabel = resolved === null ? 'various' : (resolved === 'manual' ? 'edited' : resolved === 'catalog' ? 'via catalog' : 'via AI');

  var ratedCurrent = aggregateValue(g.entries, function (e) { return e.row.rated_current_a; });
  var suggestedCode = aggregateValue(g.entries, function (e) { return e.row.suggested_cable ? e.row.suggested_cable.code : null; });
  var anyMismatch = g.entries.some(function (e) { return e.row.cable_mismatch; });
  var cableLabel = !ratedCurrent ? '<span class="hint">—</span>' :
    (ratedCurrent + 'A → ' + (suggestedCode !== null ? '<strong>' + escapeHtml(suggestedCode) + '</strong>' : '<span class="hint">varies</span>')) +
    (anyMismatch ? '<br><span class="badge badge-bad">check cable size</span>' : '');

  return '<tr class="group-row ' + confBadgeClass(confidence) + '">' +
    '<td><button class="group-toggle" data-action="toggle-group" data-group="' + gi + '">' +
      (expanded ? '▾' : '▸') + ' ' + escapeHtml(tagRangeLabel(tags)) +
      '</button><span class="group-qty">' + g.entries.length + 'x</span></td>' +
    '<td>' + escapeHtml(g.description) + '</td>' +
    '<td>' + escapeHtml(g.type) + '</td>' +
    '<td>' + (brand !== null ? escapeHtml(brand) : '<span class="hint">various</span>') + '</td>' +
    '<td>' + (poles !== null ? escapeHtml(poles) : '<span class="hint">varies</span>') + '</td>' +
    '<td>' + escapeHtml(sourceLabel) + '</td>' +
    '<td>' + escapeHtml(confidence) + '</td>' +
    '<td>' + cableLabel + '</td>' +
    '<td>' + catalogLabel + '</td>' +
    '<td class="hint">' + escapeHtml(statusLabel) + '</td>' +
    '</tr>';
}

function itemRowHtml(row, i, extraClass) {
  var sourceLabel = { legend: 'Legend', symbol: 'Symbol', not_available: 'Not available' }[row.pole_source] || row.pole_source;
  var mainRow =
    '<tr class="' + confBadgeClass(row.confidence) + (extraClass ? ' ' + extraClass : '') + '" data-row="' + i + '">' +
    '<td>' + escapeHtml(row.tag) + '</td>' +
    '<td>' + escapeHtml(row.description) + '</td>' +
    '<td>' + escapeHtml(row.component_type) + '</td>' +
    '<td>' + escapeHtml(row.brand) + (row.manufacturer_reference ? '<br><span class="hint">' + escapeHtml(row.manufacturer_reference) + '</span>' : '') + '</td>' +
    '<td><input type="number" min="0" class="polos-input" data-row="' + i + '" value="' + row.poles + '"></td>' +
    '<td>' + escapeHtml(sourceLabel) + '<br>' +
      '<button class="evidencia-toggle" data-action="toggle-evidencia" data-row="' + i + '">detail</button></td>' +
    '<td>' + escapeHtml(row.confidence) + '</td>' +
    '<td>' + cableCellHtml(row) + '</td>' +
    '<td>' + matchBadgeHtml(row) +
      (row.matchStatus === 'no_match' ? '<br><button class="evidencia-toggle" data-action="toggle-add" data-row="' + i + '">+ add to catalog</button>' : '') +
      '</td>' +
    '<td class="row-actions hint">' + (row.resolved_via === 'manual' ? 'edited' : row.resolved_via === 'catalog' ? 'via catalog' : 'via AI') + '</td>' +
    '</tr>';

  var evidenceRow =
    '<tr class="evidencia-row" data-row-detail="' + i + '" style="display:none">' +
    '<td colspan="10"><div class="evidencia-detail show">' +
    '<strong>Evidence:</strong> ' + escapeHtml(row.evidence) + '<br>' +
    '<strong>Sheet:</strong> ' + escapeHtml(row.sheet) +
    (row.notes ? '<br><strong>Notes:</strong> ' + escapeHtml(row.notes) : '') +
    '</div></td></tr>';

  var suggestRow = '';
  if (row.matchStatus === 'suggested') {
    suggestRow =
      '<tr class="suggest-row" data-row-suggest="' + i + '" style="display:none"><td colspan="10"><div class="evidencia-detail show">' +
      row.matchCandidates.map(function (c, ci) {
        return '<div style="margin-bottom:6px">' + escapeHtml(c.brand) + ' ' + escapeHtml(c.reference || c.tag_pattern) +
          ' — ' + escapeHtml(c.application) + ' — <strong>' + escapeHtml(c.poles) + ' poles</strong> ' +
          '<button data-action="accept-suggest" data-row="' + i + '" data-cand="' + ci + '">accept</button></div>';
      }).join('') +
      '</div></td></tr>';
  }

  var addFormRow =
    '<tr class="add-form-row" data-row-addform="' + i + '" style="display:none"><td colspan="10">' +
    '<div class="catalog-form">' +
    '<label>Type<select class="inline-tipo"><option value="relay">relay</option><option value="breaker">breaker</option><option value="contactor">contactor</option><option value="switch">switch</option><option value="other">other</option></select></label>' +
    '<label>Brand<input type="text" class="inline-marca" value="' + escapeHtml(row.brand) + '"></label>' +
    '<label>Reference<input type="text" class="inline-referencia" value="' + escapeHtml(row.manufacturer_reference) + '"></label>' +
    '<label>Tag pattern<input type="text" class="inline-tag" value="' + escapeHtml(tagPrefix(row.tag)) + '"></label>' +
    '<label>Application<input type="text" class="inline-aplicacao" value="' + escapeHtml(row.description) + '"></label>' +
    '<label>Poles<input type="number" min="0" class="inline-polos"></label>' +
    '</div><button data-action="save-add-form" data-row="' + i + '" style="margin-top:8px">Save to catalog</button>' +
    '</td></tr>';

  return mainRow + evidenceRow + suggestRow + addFormRow;
}

function populateTypeFilterOptions() {
  var select = document.getElementById('filter-tipo');
  if (!select) return;
  var current = select.value;
  var types = [];
  APP.reviewRows.forEach(function (row) {
    if (row.component_type && types.indexOf(row.component_type) === -1) types.push(row.component_type);
  });
  types.sort();
  select.innerHTML = '<option value="">All types</option>' +
    types.map(function (t) { return '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>'; }).join('');
  select.value = types.indexOf(current) !== -1 ? current : '';
}

function wireReviewFilters() {
  var typeSelect = document.getElementById('filter-tipo');
  var tagInput = document.getElementById('filter-tag');
  if (!typeSelect || typeSelect.dataset.wired) return;
  typeSelect.dataset.wired = '1';

  typeSelect.addEventListener('change', function () {
    APP.reviewFilters.type = typeSelect.value;
    renderReviewTable();
  });
  tagInput.addEventListener('input', function () {
    APP.reviewFilters.tag = tagInput.value;
    renderReviewTable();
  });
}

var reviewGroupsCache = [];

function renderReviewTable() {
  var body = document.getElementById('review-table-body');
  if (!body) return;

  if (!APP.reviewRows.length) {
    body.innerHTML = '<tr><td colspan="10" class="empty-state">No component identified.</td></tr>';
    updateFilterCount(0, 0);
    return;
  }

  var entries = [];
  APP.reviewRows.forEach(function (row, i) {
    if (rowMatchesFilter(row)) entries.push({ row: row, index: i });
  });

  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="10" class="empty-state">No item matches the current filter.</td></tr>';
    updateFilterCount(0, APP.reviewRows.length);
    return;
  }

  var groups = buildGroups(entries);
  reviewGroupsCache = groups;

  body.innerHTML = groups.map(function (g, gi) {
    if (g.entries.length === 1) {
      var only = g.entries[0];
      return itemRowHtml(only.row, only.index, '');
    }
    var expanded = !!APP.expandedGroups[g.key];
    var html = groupHeaderRowHtml(g, gi, expanded);
    if (expanded) {
      html += g.entries.map(function (e) { return itemRowHtml(e.row, e.index, 'group-child'); }).join('');
    }
    return html;
  }).join('');

  // set select values that can't be set via value attribute above
  entries.forEach(function (entry) {
    var formRow = body.querySelector('[data-row-addform="' + entry.index + '"]');
    if (formRow) formRow.querySelector('.inline-tipo').value = entry.row.component_type;
  });

  updateFilterCount(entries.length, APP.reviewRows.length);
}

function updateFilterCount(visible, total) {
  var el = document.getElementById('filter-count');
  if (!el) return;
  el.textContent = (visible === total) ? (total + ' items') : (visible + ' of ' + total + ' items');
}

function wireReviewEvents() {
  var body = document.getElementById('review-table-body');
  if (!body || body.dataset.wired) return;
  body.dataset.wired = '1';

  body.addEventListener('input', function (evt) {
    if (evt.target.classList.contains('polos-input')) {
      var i = parseInt(evt.target.dataset.row, 10);
      APP.reviewRows[i].poles = parseInt(evt.target.value, 10) || 0;
      APP.reviewRows[i].resolved_via = 'manual';
      var tr = body.querySelector('tr[data-row="' + i + '"] td:last-child');
      if (tr) tr.textContent = 'edited';
    }
  });

  body.addEventListener('click', function (evt) {
    var btn = evt.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var i = btn.dataset.row !== undefined ? parseInt(btn.dataset.row, 10) : null;

    if (action === 'toggle-group') {
      var gi = parseInt(btn.dataset.group, 10);
      var g = reviewGroupsCache[gi];
      if (g) {
        APP.expandedGroups[g.key] = !APP.expandedGroups[g.key];
        renderReviewTable();
      }
      return;
    }

    if (action === 'toggle-evidencia') {
      var r = body.querySelector('[data-row-detail="' + i + '"]');
      if (r) r.style.display = r.style.display === 'none' ? 'table-row' : 'none';
    }

    if (action === 'toggle-suggest') {
      var trMain = btn.closest('tr');
      var idx = parseInt(trMain.dataset.row, 10);
      var r2 = body.querySelector('[data-row-suggest="' + idx + '"]');
      if (r2) r2.style.display = r2.style.display === 'none' ? 'table-row' : 'none';
    }

    if (action === 'accept-suggest') {
      var cand = APP.reviewRows[i].matchCandidates[parseInt(btn.dataset.cand, 10)];
      APP.reviewRows[i].poles = cand.poles;
      APP.reviewRows[i].resolved_via = 'catalog';
      renderReviewTable();
    }

    if (action === 'toggle-add') {
      var r3 = body.querySelector('[data-row-addform="' + i + '"]');
      if (r3) r3.style.display = r3.style.display === 'none' ? 'table-row' : 'none';
    }

    if (action === 'save-add-form') {
      var formRow = body.querySelector('[data-row-addform="' + i + '"]');
      var fields = {
        component_type: formRow.querySelector('.inline-tipo').value,
        brand: formRow.querySelector('.inline-marca').value.trim(),
        reference: formRow.querySelector('.inline-referencia').value.trim(),
        tag_pattern: formRow.querySelector('.inline-tag').value.trim(),
        application: formRow.querySelector('.inline-aplicacao').value.trim(),
        poles: parseInt(formRow.querySelector('.inline-polos').value, 10) || 0,
        notes: 'Added while reviewing drawing ' + ((APP.currentExtraction.drawing || {}).number || '')
      };
      createCatalogEntry(fields).then(function () {
        toast('Item added to catalog');
        buildReviewRows();
        renderReviewTable();
      });
    }
  });
}

function confirmReviewList() {
  if (!APP.reviewRows.length) { toast('Nothing to confirm'); return; }
  var record = {
    id: uuid(),
    drawing: APP.currentExtraction.drawing || {},
    components: APP.reviewRows.map(function (r) {
      return {
        tag: r.tag, description: r.description, component_type: r.component_type,
        brand: r.brand, manufacturer_reference: r.manufacturer_reference,
        poles: r.poles, pole_source: r.pole_source, evidence: r.evidence,
        confidence: r.confidence, sheet: r.sheet, resolved_via: r.resolved_via,
        rated_current_a: r.rated_current_a || 0,
        rated_current_source: r.rated_current_source || 'not_available',
        drawing_cable_size_mm2: r.drawing_cable_size_mm2 || '',
        suggested_cable_code: r.suggested_cable ? r.suggested_cable.code : '',
        cable_mismatch: !!r.cable_mismatch
      };
    }),
    confirmed_at: new Date().toISOString()
  };
  APP.drawings.push(record);
  saveStore('drawings', APP.drawings).then(function () {
    toast('List confirmed and saved to history');
  }).catch(function (err) {
    toast('Error saving: ' + err.message);
  });
}
