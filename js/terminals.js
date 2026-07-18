function initTerminals() {
  var form = document.getElementById('terminal-form');
  if (!form || form.dataset.wired) return;
  form.dataset.wired = '1';

  form.addEventListener('submit', function (evt) {
    evt.preventDefault();
    var entry = readTerminalFormFields();
    if (!entry.brand || !entry.wire_range_mm2) { toast('Fill in at least brand and wire range'); return; }
    createTerminalEntry(entry).then(function () {
      form.reset();
      toast('Torque spec added');
    });
  });

  var body = document.getElementById('terminals-table-body');
  if (body) {
    body.addEventListener('click', function (evt) {
      var btn = evt.target.closest('[data-delete-id]');
      if (!btn) return;
      deleteTerminalEntry(btn.dataset.deleteId);
    });
  }
}

function readTerminalFormFields() {
  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }
  return {
    brand: val('terminal-brand'),
    series: val('terminal-series'),
    wire_range_mm2: val('terminal-wire-range'),
    torque_nm_min: parseFloat(val('terminal-torque-min')) || null,
    torque_nm_max: parseFloat(val('terminal-torque-max')) || null,
    source: val('terminal-source')
  };
}

function createTerminalEntry(fields) {
  var now = new Date().toISOString();
  var entry = Object.assign({ id: uuid(), created_at: now }, fields);
  APP.terminals.push(entry);
  return saveStore('terminals', APP.terminals).then(function () {
    renderTerminals();
    return entry;
  });
}

function deleteTerminalEntry(id) {
  APP.terminals = APP.terminals.filter(function (t) { return t.id !== id; });
  saveStore('terminals', APP.terminals).then(function () {
    renderTerminals();
    toast('Entry removed');
  });
}

function renderTerminals() {
  var body = document.getElementById('terminals-table-body');
  var empty = document.getElementById('terminals-empty');
  if (!body) return;

  if (!APP.terminals.length) {
    body.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  body.innerHTML = APP.terminals.map(function (t) {
    var torque = (t.torque_nm_min != null || t.torque_nm_max != null)
      ? (escapeHtml(t.torque_nm_min != null ? t.torque_nm_min : '?') + '–' + escapeHtml(t.torque_nm_max != null ? t.torque_nm_max : '?') + ' Nm')
      : '<span class="hint">—</span>';
    return '<tr>' +
      '<td>' + escapeHtml(t.brand) + '</td>' +
      '<td>' + escapeHtml(t.series) + '</td>' +
      '<td>' + escapeHtml(t.wire_range_mm2) + '</td>' +
      '<td>' + torque + '</td>' +
      '<td>' + escapeHtml(t.source) + '</td>' +
      '<td class="row-actions"><button class="ghost" data-delete-id="' + t.id + '">Remove</button></td>' +
      '</tr>';
  }).join('');
}
