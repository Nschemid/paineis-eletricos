// Pure matching: given a motor load (kW preferred, FLA as fallback), find the
// smallest Siemens 3RT20 frame in APP.contactors rated to switch it, or null.
function findContactorForLoad(kw, flaA) {
  var candidates = (APP.contactors || []).filter(function (c) {
    if (kw) return c.ac3_kw_400v >= kw;
    if (flaA) return c.ac3_current_a >= flaA;
    return false;
  }).sort(function (a, b) { return a.ac3_kw_400v - b.ac3_kw_400v; });
  return candidates.length ? candidates[0] : null;
}
