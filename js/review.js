function buildReviewRows() {
  var extraction = APP.currentExtraction;
  APP.reviewRows = (extraction.componentes || []).map(function (item) {
    var match = matchComponent(item, APP.catalog);
    var polos = item.polos;
    var resolvidoVia = 'extracao';

    if (item.fonte_polos === 'nao_disponivel_no_desenho' && match.status === 'confirmado') {
      polos = match.candidates[0].polos;
      resolvidoVia = 'catalogo';
    }

    return Object.assign({}, item, {
      polos: polos,
      resolvido_via: resolvidoVia,
      matchStatus: match.status,
      matchCandidates: match.candidates,
      showEvidencia: false,
      showAddForm: false
    });
  });
}

function renderReview() {
  var extraction = APP.currentExtraction;
  if (!extraction) return;

  buildReviewRows();
  renderReviewHeader();
  renderReviewPreview();
  renderReviewTable();
  wireReviewEvents();
}

function renderReviewHeader() {
  var el = document.getElementById('review-title');
  if (!el) return;
  var d = APP.currentExtraction.desenho || {};
  el.textContent = [d.numero, d.titulo, d.projeto].filter(Boolean).join(' — ') || 'Desenho analisado';
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
      '<embed src="' + f.previewUrl + '" type="application/pdf">' +
      '<p class="hint" style="padding:8px"><a href="' + f.previewUrl + '" target="_blank" rel="noopener">Abrir PDF em nova aba</a> se o preview não aparecer aqui.</p>' +
      '</div>';
  } else {
    content = '<img src="' + f.previewUrl + '" alt="Desenho">';
  }

  wrap.innerHTML = tabs + content;

  wrap.querySelectorAll('[data-preview-index]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      APP.activePreviewIndex = parseInt(btn.dataset.previewIndex, 10);
      renderReviewPreview();
    });
  });
}

function confBadgeClass(conf) {
  if (conf === 'baixa') return 'conf-baixa';
  if (conf === 'media') return 'conf-media';
  return 'conf-alta';
}

function matchBadgeHtml(row) {
  if (row.matchStatus === 'confirmado') {
    return '<span class="badge badge-ok">✓ catálogo</span>';
  }
  if (row.matchStatus === 'sugestao') {
    return '<button class="evidencia-toggle" data-action="toggle-suggest">? sugestão (' + row.matchCandidates.length + ')</button>';
  }
  return '<span class="badge badge-muted">— sem match</span>';
}

function renderReviewTable() {
  var body = document.getElementById('review-table-body');
  if (!body) return;

  if (!APP.reviewRows.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhum componente identificado.</td></tr>';
    return;
  }

  body.innerHTML = APP.reviewRows.map(function (row, i) {
    var sourceLabel = { bom: 'BOM', simbolo: 'Símbolo', nao_disponivel_no_desenho: 'Não disponível' }[row.fonte_polos] || row.fonte_polos;
    var mainRow =
      '<tr class="' + confBadgeClass(row.confianca) + '" data-row="' + i + '">' +
      '<td>' + escapeHtml(row.tag) + '</td>' +
      '<td>' + escapeHtml(row.descricao) + '</td>' +
      '<td>' + escapeHtml(row.tipo_componente) + '</td>' +
      '<td>' + escapeHtml(row.fabricante_marca) + (row.referencia_fabricante ? '<br><span class="hint">' + escapeHtml(row.referencia_fabricante) + '</span>' : '') + '</td>' +
      '<td><input type="number" min="0" class="polos-input" data-row="' + i + '" value="' + row.polos + '"></td>' +
      '<td>' + escapeHtml(sourceLabel) + '<br>' +
        '<button class="evidencia-toggle" data-action="toggle-evidencia" data-row="' + i + '">detalhe</button></td>' +
      '<td>' + escapeHtml(row.confianca) + '</td>' +
      '<td>' + matchBadgeHtml(row) +
        (row.matchStatus === 'sem_correspondencia' ? '<br><button class="evidencia-toggle" data-action="toggle-add" data-row="' + i + '">+ adicionar ao catálogo</button>' : '') +
        '</td>' +
      '<td class="row-actions hint">' + (row.resolvido_via === 'manual' ? 'editado' : row.resolvido_via === 'catalogo' ? 'via catálogo' : 'via IA') + '</td>' +
      '</tr>';

    var evidenciaRow =
      '<tr class="evidencia-row" data-row-detail="' + i + '" style="display:none">' +
      '<td colspan="9"><div class="evidencia-detail show">' +
      '<strong>Evidência:</strong> ' + escapeHtml(row.evidencia) + '<br>' +
      '<strong>Folha:</strong> ' + escapeHtml(row.folha_origem) +
      (row.observacoes ? '<br><strong>Obs.:</strong> ' + escapeHtml(row.observacoes) : '') +
      '</div></td></tr>';

    var suggestRow = '';
    if (row.matchStatus === 'sugestao') {
      suggestRow =
        '<tr class="suggest-row" data-row-suggest="' + i + '" style="display:none"><td colspan="9"><div class="evidencia-detail show">' +
        row.matchCandidates.map(function (c, ci) {
          return '<div style="margin-bottom:6px">' + escapeHtml(c.fabricante_marca) + ' ' + escapeHtml(c.referencia || c.padrao_tag) +
            ' — ' + escapeHtml(c.aplicacao) + ' — <strong>' + escapeHtml(c.polos) + ' polos</strong> ' +
            '<button data-action="accept-suggest" data-row="' + i + '" data-cand="' + ci + '">aceitar</button></div>';
        }).join('') +
        '</div></td></tr>';
    }

    var addFormRow =
      '<tr class="add-form-row" data-row-addform="' + i + '" style="display:none"><td colspan="9">' +
      '<div class="catalog-form">' +
      '<label>Tipo<select class="inline-tipo"><option value="rele">rele</option><option value="disjuntor">disjuntor</option><option value="contator">contator</option><option value="chave">chave</option><option value="outro">outro</option></select></label>' +
      '<label>Marca<input type="text" class="inline-marca" value="' + escapeHtml(row.fabricante_marca) + '"></label>' +
      '<label>Referência<input type="text" class="inline-referencia" value="' + escapeHtml(row.referencia_fabricante) + '"></label>' +
      '<label>Padrão de tag<input type="text" class="inline-tag" value="' + escapeHtml(tagPrefix(row.tag)) + '"></label>' +
      '<label>Aplicação<input type="text" class="inline-aplicacao" value="' + escapeHtml(row.descricao) + '"></label>' +
      '<label>Polos<input type="number" min="0" class="inline-polos"></label>' +
      '</div><button data-action="save-add-form" data-row="' + i + '" style="margin-top:8px">Salvar no catálogo</button>' +
      '</td></tr>';

    return mainRow + evidenciaRow + suggestRow + addFormRow;
  }).join('');

  // set select values that can't be set via value attribute above
  APP.reviewRows.forEach(function (row, i) {
    var formRow = body.querySelector('[data-row-addform="' + i + '"]');
    if (formRow) formRow.querySelector('.inline-tipo').value = row.tipo_componente;
  });
}

function wireReviewEvents() {
  var body = document.getElementById('review-table-body');
  if (!body || body.dataset.wired) return;
  body.dataset.wired = '1';

  body.addEventListener('input', function (evt) {
    if (evt.target.classList.contains('polos-input')) {
      var i = parseInt(evt.target.dataset.row, 10);
      APP.reviewRows[i].polos = parseInt(evt.target.value, 10) || 0;
      APP.reviewRows[i].resolvido_via = 'manual';
      var tr = body.querySelector('tr[data-row="' + i + '"] td:last-child');
      if (tr) tr.textContent = 'editado';
    }
  });

  body.addEventListener('click', function (evt) {
    var btn = evt.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var i = btn.dataset.row !== undefined ? parseInt(btn.dataset.row, 10) : null;

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
      APP.reviewRows[i].polos = cand.polos;
      APP.reviewRows[i].resolvido_via = 'catalogo';
      renderReviewTable();
    }

    if (action === 'toggle-add') {
      var r3 = body.querySelector('[data-row-addform="' + i + '"]');
      if (r3) r3.style.display = r3.style.display === 'none' ? 'table-row' : 'none';
    }

    if (action === 'save-add-form') {
      var formRow = body.querySelector('[data-row-addform="' + i + '"]');
      var fields = {
        tipo_componente: formRow.querySelector('.inline-tipo').value,
        fabricante_marca: formRow.querySelector('.inline-marca').value.trim(),
        referencia: formRow.querySelector('.inline-referencia').value.trim(),
        padrao_tag: formRow.querySelector('.inline-tag').value.trim(),
        aplicacao: formRow.querySelector('.inline-aplicacao').value.trim(),
        polos: parseInt(formRow.querySelector('.inline-polos').value, 10) || 0,
        notas: 'Adicionado durante revisão do desenho ' + ((APP.currentExtraction.desenho || {}).numero || '')
      };
      createCatalogEntry(fields).then(function () {
        toast('Item cadastrado no catálogo');
        buildReviewRows();
        renderReviewTable();
      });
    }
  });
}

function confirmReviewList() {
  if (!APP.reviewRows.length) { toast('Nada para confirmar'); return; }
  var record = {
    id: uuid(),
    desenho: APP.currentExtraction.desenho || {},
    componentes: APP.reviewRows.map(function (r) {
      return {
        tag: r.tag, descricao: r.descricao, tipo_componente: r.tipo_componente,
        fabricante_marca: r.fabricante_marca, referencia_fabricante: r.referencia_fabricante,
        polos: r.polos, fonte_polos: r.fonte_polos, evidencia: r.evidencia,
        confianca: r.confianca, folha_origem: r.folha_origem, resolvido_via: r.resolvido_via
      };
    }),
    confirmado_em: new Date().toISOString()
  };
  APP.drawings.push(record);
  saveStore('drawings', APP.drawings).then(function () {
    toast('Lista confirmada e salva no histórico');
  }).catch(function (err) {
    toast('Erro ao salvar: ' + err.message);
  });
}
