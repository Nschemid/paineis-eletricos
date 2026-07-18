function resizeImage(file, maxSize, quality, callback) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      var dataUrl = canvas.toDataURL('image/jpeg', quality);
      var base64 = dataUrl.split(',')[1];
      callback(base64, 'image/jpeg');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function readFileAsBase64(file, callback) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var base64 = e.target.result.split(',')[1];
    callback(base64, file.type);
  };
  reader.readAsDataURL(file);
}

function initUpload() {
  var input = document.getElementById('drawing-file-input');
  if (!input) return;
  input.addEventListener('change', function (evt) {
    var fileList = Array.prototype.slice.call(evt.target.files);
    if (!fileList.length) return;
    handleDrawingFiles(fileList);
    evt.target.value = '';
  });
}

function prepareFile(file, callback) {
  var isPdf = file.type === 'application/pdf';
  var previewUrl = URL.createObjectURL(file);

  function proceed(base64, mimeType) {
    callback({ base64: base64, mimeType: mimeType, previewUrl: previewUrl, isPdf: isPdf, name: file.name });
  }

  if (isPdf) {
    readFileAsBase64(file, proceed);
  } else {
    resizeImage(file, 1600, 0.85, proceed);
  }
}

function handleDrawingFiles(fileList) {
  showUploadLoading(true);

  var prepared = new Array(fileList.length);
  var remaining = fileList.length;

  fileList.forEach(function (file, i) {
    prepareFile(file, function (result) {
      prepared[i] = result;
      remaining -= 1;
      if (remaining === 0) {
        APP.currentFiles = prepared;
        analyzeDrawing(prepared);
      }
    });
  });
}

// Each file is sent as its own synchronous Gemini call (Netlify Functions have
// a ~10s execution limit; a single call covering several PDFs at once reliably
// exceeded it). Results are merged client-side into one component list, deduping
// the same tag+tipo when it's mentioned on more than one sheet.
function analyzeDrawing(files) {
  var results = [];
  var index = 0;
  var RETRYABLE_STATUS = [502, 503, 504];
  var MAX_RETRIES = 2;
  var RETRY_DELAY_MS = 6000;

  function callOnce(f) {
    return fetch('/.netlify/functions/analyze-drawing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: f.base64, mimeType: f.mimeType, name: f.name })
    }).then(function (res) {
      if (res.ok) return res.json();
      var status = res.status;
      return res.json().catch(function () { return {}; }).then(function (err) {
        var e = new Error((f.name || 'arquivo') + ': ' + (err.detail || err.error || ('HTTP ' + status)));
        e.status = status;
        throw e;
      });
    });
  }

  function callWithRetry(f, attemptsLeft) {
    return callOnce(f).catch(function (err) {
      if (attemptsLeft > 0 && RETRYABLE_STATUS.indexOf(err.status) !== -1) {
        toast('Instabilidade temporária, tentando "' + f.name + '" de novo...');
        return new Promise(function (resolve) { setTimeout(resolve, RETRY_DELAY_MS); })
          .then(function () { return callWithRetry(f, attemptsLeft - 1); });
      }
      throw err;
    });
  }

  function next() {
    if (index >= files.length) {
      showUploadLoading(false);
      APP.currentExtraction = mergeExtractions(results);
      renderReview();
      switchTab('review');
      return;
    }

    var f = files[index];
    showUploadLoading(true, index + 1, files.length);

    callWithRetry(f, MAX_RETRIES)
      .then(function (data) {
        results.push(data);
        index += 1;
        next();
      })
      .catch(function (err) {
        showUploadLoading(false);
        toast('Erro ao analisar: ' + err.message);
      });
  }

  next();
}

function mergeExtractions(results) {
  var componentes = [];
  var seen = {};
  var desenho = null;
  var notas = [];

  results.forEach(function (r) {
    if (!desenho && r.desenho) desenho = r.desenho;
    if (r.notas_gerais) notas.push(r.notas_gerais);

    (r.componentes || []).forEach(function (c) {
      var key = (c.tag || '').toUpperCase() + '|' + c.tipo_componente;
      if (Object.prototype.hasOwnProperty.call(seen, key)) {
        var existingIdx = seen[key];
        var existing = componentes[existingIdx];
        if (existing.fonte_polos === 'nao_disponivel_no_desenho' && c.fonte_polos !== 'nao_disponivel_no_desenho') {
          componentes[existingIdx] = c;
        }
      } else {
        seen[key] = componentes.length;
        componentes.push(c);
      }
    });
  });

  return { desenho: desenho || {}, componentes: componentes, notas_gerais: notas.join(' | ') };
}

function showUploadLoading(isLoading, current, total) {
  var el = document.getElementById('upload-loading');
  if (!el) return;
  el.style.display = isLoading ? 'block' : 'none';
  if (isLoading) {
    el.textContent = (total > 1)
      ? ('Analisando arquivo ' + current + ' de ' + total + '...')
      : 'Analisando desenho...';
  }
}
