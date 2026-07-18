var APP = {
  catalog: [],
  drawings: [],
  cables: [],
  currentExtraction: null,
  currentFiles: [], // [{ base64, mimeType, previewUrl, isPdf, name }, ...]
  activePreviewIndex: 0,
  previewZoom: 1,
  reviewRows: [],
  reviewFilters: { type: '', tag: '' },
  expandedGroups: {}
};

function switchTab(name) {
  document.querySelectorAll('.screen').forEach(function (el) {
    el.classList.toggle('active', el.id === 'screen-' + name);
  });
  document.querySelectorAll('nav.tabs button').forEach(function (el) {
    el.classList.toggle('active', el.dataset.tab === name);
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

function fetchStore(store) {
  return fetch('/.netlify/functions/data?store=' + store)
    .then(function (res) { return res.json(); })
    .catch(function () { return []; });
}

function saveStore(store, arrayData) {
  return fetch('/.netlify/functions/data?store=' + store, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arrayData)
  }).then(function (res) {
    if (!res.ok) throw new Error('Failed to save to ' + store);
    return res.json();
  });
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('nav.tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
  });

  fetchStore('catalog').then(function (data) {
    APP.catalog = data;
    if (typeof renderCatalog === 'function') renderCatalog();
  });

  fetchStore('drawings').then(function (data) {
    APP.drawings = data;
  });

  fetchStore('cables').then(function (data) {
    APP.cables = data;
    if (typeof renderCables === 'function') renderCables();
  });

  if (typeof initUpload === 'function') initUpload();
  if (typeof initCatalog === 'function') initCatalog();
  if (typeof initCables === 'function') initCables();

  var confirmBtn = document.getElementById('confirm-list-btn');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmReviewList);
});
