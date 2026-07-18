function initCatalog() {
  var form = document.getElementById('catalog-form');
  if (!form) return;
  form.addEventListener('submit', function (evt) {
    evt.preventDefault();
    var entry = readCatalogFormFields('catalog-');
    if (!entry.tipo_componente) { toast('Escolha o tipo de componente'); return; }
    createCatalogEntry(entry).then(function () {
      form.reset();
      toast('Item adicionado ao catálogo');
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
    tipo_componente: val('tipo'),
    fabricante_marca: val('marca'),
    referencia: val('referencia'),
    padrao_tag: val('tag'),
    aplicacao: val('aplicacao'),
    polos: parseInt(val('polos'), 10) || 0,
    notas: val('notas')
  };
}

function createCatalogEntry(fields) {
  var now = new Date().toISOString();
  var entry = Object.assign({
    id: uuid(),
    criado_em: now,
    atualizado_em: now
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
    toast('Item removido do catálogo');
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
      '<td>' + escapeHtml(c.tipo_componente) + '</td>' +
      '<td>' + escapeHtml(c.fabricante_marca) + '</td>' +
      '<td>' + escapeHtml(c.referencia) + '</td>' +
      '<td>' + escapeHtml(c.padrao_tag) + '</td>' +
      '<td>' + escapeHtml(c.aplicacao) + '</td>' +
      '<td>' + escapeHtml(c.polos) + '</td>' +
      '<td class="row-actions"><button class="ghost" data-delete-id="' + c.id + '">Remover</button></td>' +
      '</tr>';
  }).join('');
}
