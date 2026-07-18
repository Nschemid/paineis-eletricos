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

function analyzeDrawing(files) {
  var payload = {
    files: files.map(function (f) {
      return { file: f.base64, mimeType: f.mimeType, name: f.name };
    })
  };

  fetch('/.netlify/functions/analyze-drawing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
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
