function initCatalog() {
  var form = document.getElementById('catalog-form');
  if (!form) return;
  form.addEventListener('submit', function (evt) {
    evt.preventDefault();
    var entry = readCatalogFormFields('catalog-');
    if (!entry.component_type) { toast('Choose a component type'); return; }
    createCatalogEntry(entry).then(function () {
      form.reset();
      toast('Item added to catalog');
    });
  });

  var deleteBtnHandler = document.getElementById('catalog-table-body');
  if (deleteBtnHandler) {
    deleteBtnHandler.addEventListener('click', function (evt) {
      var btn = evt.target.closest('[data-delete-id]');
      if (!btn) return;
      deleteCatalogEntry(btn.dataset.deleteId);
    });
  }
}

function readCatalogFormFields(prefix) {
  function val(id) {
    var el = document.getElementById(prefix + id);
    return el ? el.value.trim() : '';
  }
  return {
    component_type: val('type'),
    brand: val('brand'),
    reference: val('reference'),
    tag_pattern: val('tag-pattern'),
    application: val('application'),
    poles: parseInt(val('poles'), 10) || 0,
    notes: val('notes')
  };
}

function createCatalogEntry(fields) {
  var now = new Date().toISOString();
  var entry = Object.assign({
    id: uuid(),
    created_at: now,
    updated_at: now
  }, fields);

  APP.catalog.push(entry);
  return saveStore('catalog', APP.catalog).then(function () {
    renderCatalog();
    return entry;
  });
}

function deleteCatalogEntry(id) {
  APP.catalog = APP.catalog.filter(function (c) { return c.id !== id; });
  saveStore('catalog', APP.catalog).then(function () {
    renderCatalog();
    toast('Item removed from catalog');
  });
}

function renderCatalog() {
  var body = document.getElementById('catalog-table-body');
  var empty = document.getElementById('catalog-empty');
  if (!body) return;

  if (!APP.catalog.length) {
    body.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  body.innerHTML = APP.catalog.map(function (c) {
    return '<tr>' +
      '<td>' + escapeHtml(c.component_type) + '</td>' +
      '<td>' + escapeHtml(c.brand) + '</td>' +
      '<td>' + escapeHtml(c.reference) + '</td>' +
      '<td>' + escapeHtml(c.tag_pattern) + '</td>' +
      '<td>' + escapeHtml(c.application) + '</td>' +
      '<td>' + escapeHtml(c.poles) + '</td>' +
      '<td class="row-actions"><button class="ghost" data-delete-id="' + c.id + '">Remove</button></td>' +
      '</tr>';
  }).join('');
}
