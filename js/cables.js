function initCables() {
  var input = document.getElementById('cable-sizer-input');
  var btn = document.getElementById('cable-sizer-btn');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';

  btn.addEventListener('click', function () { runCableSizer(); });
  input.addEventListener('keydown', function (evt) {
    if (evt.key === 'Enter') runCableSizer();
  });
}

function runCableSizer() {
  var input = document.getElementById('cable-sizer-input');
  var resultEl = document.getElementById('cable-sizer-result');
  var required = parseFloat(input.value);

  if (!required || required <= 0) {
    resultEl.innerHTML = '<p class="hint">Enter a required continuous current in amps.</p>';
    return;
  }

  var candidates = APP.cables
    .filter(function (c) { return c.continuous_current_a >= required; })
    .sort(function (a, b) { return a.continuous_current_a - b.continuous_current_a; });

  if (!candidates.length) {
    resultEl.innerHTML = '<p class="hint">No cable in this table rates high enough for ' + escapeHtml(required) + 'A — check a larger series or a different cable table.</p>';
    return;
  }

  var best = candidates[0];
  resultEl.innerHTML =
    '<div class="card" style="margin-top:10px;margin-bottom:0">' +
    '<strong>' + escapeHtml(best.code) + '</strong> — ' + escapeHtml(best.area_mm2) + ' mm², rated ' + escapeHtml(best.continuous_current_a) + 'A continuous' +
    (best.confidence === 'low' ? ' <span class="badge badge-warn">low confidence — verify against datasheet</span>' : '') +
    '<p class="hint" style="margin-top:8px">This only checks continuous current rating (Touching installation, no derating). Before ordering: (1) apply a derating factor per AS/NZS 3008.1.1 if the real installation isn\'t "Touching", or ambient temperature/grouping differs; (2) check this cable\'s short-circuit withstand (' + escapeHtml(best.short_circuit_1s_a) + 'A for 1s) against the let-through energy of the upstream breaker/fuse; (3) check voltage drop over the actual run length.</p>' +
    '</div>';
}

function renderCables() {
  var body = document.getElementById('cables-table-body');
  if (!body) return;

  if (!APP.cables.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty-state">No cable data loaded yet.</td></tr>';
    return;
  }

  var sorted = APP.cables.slice().sort(function (a, b) { return (a.area_mm2 || 0) - (b.area_mm2 || 0); });

  body.innerHTML = sorted.map(function (c) {
    var confBadge = c.confidence === 'low'
      ? '<span class="badge badge-warn">verify</span>'
      : '<span class="badge badge-ok">ok</span>';
    return '<tr>' +
      '<td>' + escapeHtml(c.code) + '</td>' +
      '<td>' + escapeHtml(c.area_mm2) + '</td>' +
      '<td>' + escapeHtml(c.strands) + '/' + escapeHtml(c.wire_diameter_mm) + '</td>' +
      '<td>' + escapeHtml(c.dc_resistance_mohm_per_m) + '</td>' +
      '<td>' + escapeHtml(c.continuous_current_a) + '</td>' +
      '<td>' + escapeHtml(c.short_circuit_1s_a) + '</td>' +
      '<td>' + escapeHtml(c.od_mm) + '</td>' +
      '<td>' + (c.bend_radius_during_mm ? escapeHtml(c.bend_radius_during_mm) + ' / ' + escapeHtml(c.bend_radius_final_mm || '?') : '<span class="hint">—</span>') + '</td>' +
      '<td>' + confBadge + '</td>' +
      '</tr>';
  }).join('');
}
