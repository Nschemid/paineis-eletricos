function normalizeRef(str) {
  return String(str || '').toUpperCase().replace(/[\s\-_.]/g, '');
}

function tagPrefix(tag) {
  return String(tag || '').replace(/\d+$/, '').toUpperCase();
}

function wordOverlapScore(a, b) {
  var wa = String(a || '').toLowerCase().split(/\W+/).filter(function (w) { return w.length > 2; });
  var wb = String(b || '').toLowerCase().split(/\W+/).filter(function (w) { return w.length > 2; });
  if (!wa.length || !wb.length) return 0;
  var setB = new Set(wb);
  var shared = wa.filter(function (w) { return setB.has(w); }).length;
  return shared;
}

function matchByReference(item, catalog) {
  var ref = normalizeRef(item.referencia_fabricante);
  if (!ref) return [];
  return catalog.filter(function (c) {
    var cref = normalizeRef(c.referencia);
    if (!cref) return false;
    if (item.fabricante_marca && c.fabricante_marca &&
        normalizeRef(item.fabricante_marca) !== normalizeRef(c.fabricante_marca)) return false;
    return cref === ref || cref.indexOf(ref) === 0 || ref.indexOf(cref) === 0;
  });
}

function matchByTagPattern(item, catalog) {
  var prefix = tagPrefix(item.tag);
  if (!prefix) return [];
  return catalog.filter(function (c) {
    if (!c.padrao_tag) return false;
    return normalizeRef(c.padrao_tag) === normalizeRef(prefix) &&
      c.tipo_componente === item.tipo_componente;
  });
}

function matchByTypeAndApplication(item, catalog) {
  var text = (item.descricao || '') + ' ' + (item.evidencia || '');
  return catalog.filter(function (c) {
    if (c.tipo_componente !== item.tipo_componente) return false;
    if (item.fabricante_marca && c.fabricante_marca &&
        normalizeRef(item.fabricante_marca) !== normalizeRef(c.fabricante_marca)) return false;
    return wordOverlapScore(text, c.aplicacao) >= 2;
  });
}

// Returns { status: 'confirmado'|'sugestao'|'sem_correspondencia', candidates: [catalogEntry,...] }
function matchComponent(item, catalog) {
  var byRef = matchByReference(item, catalog);
  if (byRef.length === 1) return { status: 'confirmado', candidates: byRef };
  if (byRef.length > 1) return { status: 'sugestao', candidates: byRef };

  var byTag = matchByTagPattern(item, catalog);
  if (byTag.length === 1) return { status: 'confirmado', candidates: byTag };
  if (byTag.length > 1) return { status: 'sugestao', candidates: byTag };

  var byType = matchByTypeAndApplication(item, catalog);
  if (byType.length >= 1) return { status: 'sugestao', candidates: byType };

  return { status: 'sem_correspondencia', candidates: [] };
}
