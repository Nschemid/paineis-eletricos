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
  var ref = normalizeRef(item.manufacturer_reference);
  if (!ref) return [];
  return catalog.filter(function (c) {
    var cref = normalizeRef(c.reference);
    if (!cref) return false;
    if (item.brand && c.brand &&
        normalizeRef(item.brand) !== normalizeRef(c.brand)) return false;
    return cref === ref || cref.indexOf(ref) === 0 || ref.indexOf(cref) === 0;
  });
}

function matchByTagPattern(item, catalog) {
  var prefix = tagPrefix(item.tag);
  if (!prefix) return [];
  return catalog.filter(function (c) {
    if (!c.tag_pattern) return false;
    return normalizeRef(c.tag_pattern) === normalizeRef(prefix) &&
      c.component_type === item.component_type;
  });
}

function matchByTypeAndApplication(item, catalog) {
  var text = (item.description || '') + ' ' + (item.evidence || '');
  return catalog.filter(function (c) {
    if (c.component_type !== item.component_type) return false;
    if (item.brand && c.brand &&
        normalizeRef(item.brand) !== normalizeRef(c.brand)) return false;
    return wordOverlapScore(text, c.application) >= 2;
  });
}

// Returns { status: 'confirmed'|'suggested'|'no_match', candidates: [catalogEntry,...] }
function matchComponent(item, catalog) {
  var byRef = matchByReference(item, catalog);
  if (byRef.length === 1) return { status: 'confirmed', candidates: byRef };
  if (byRef.length > 1) return { status: 'suggested', candidates: byRef };

  var byTag = matchByTagPattern(item, catalog);
  if (byTag.length === 1) return { status: 'confirmed', candidates: byTag };
  if (byTag.length > 1) return { status: 'suggested', candidates: byTag };

  var byType = matchByTypeAndApplication(item, catalog);
  if (byType.length >= 1) return { status: 'suggested', candidates: byType };

  return { status: 'no_match', candidates: [] };
}
