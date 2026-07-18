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
    var file = evt.target.files[0];
    if (!file) return;
    handleDrawingFile(file);
    evt.target.value = '';
  });
}

function handleDrawingFile(file) {
  var isPdf = file.type === 'application/pdf';
  var previewUrl = URL.createObjectURL(file);

  showUploadLoading(true);

  function proceed(base64, mimeType) {
    APP.currentFile = { base64: base64, mimeType: mimeType, previewUrl: previewUrl, isPdf: isPdf, name: file.name };
    analyzeDrawing(base64, mimeType);
  }

  if (isPdf) {
    readFileAsBase64(file, proceed);
  } else {
    resizeImage(file, 1600, 0.85, proceed);
  }
}

function analyzeDrawing(base64, mimeType) {
  fetch('/.netlify/functions/analyze-drawing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: base64, mimeType: mimeType })
  })
    .then(function (res) {
      if (!res.ok) return res.json().then(function (err) { throw new Error(err.detail || err.error || 'Falha na análise'); });
      return res.json();
    })
    .then(function (data) {
      showUploadLoading(false);
      APP.currentExtraction = data;
      renderReview();
      switchTab('review');
    })
    .catch(function (err) {
      showUploadLoading(false);
      toast('Erro ao analisar desenho: ' + err.message);
    });
}

function showUploadLoading(isLoading) {
  var el = document.getElementById('upload-loading');
  if (el) el.style.display = isLoading ? 'block' : 'none';
}
