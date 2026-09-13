// ===== Snappa — client-side image editor =====
// Everything runs in-browser. No uploads, no server, no API costs.

(function () {
  const landing = document.getElementById('landing');
  const editor = document.getElementById('editor');
  const fileInput = document.getElementById('fileInput');
  const uploadDrop = document.getElementById('uploadDrop');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const contextPanel = document.getElementById('contextPanel');
  const toolRail = document.getElementById('toolRail');
  const textOverlay = document.getElementById('textOverlay');
  const btnBack = document.getElementById('btnBack');
  const btnDownload = document.getElementById('btnDownload');

  let img = null;          // loaded HTMLImageElement
  let activeTool = null;
  let state = {
    rotation: 0,           // 0, 90, 180, 270
    flipH: false,
    flipV: false,
    cropRatio: null,       // null = original, else {w,h,label}
    filter: 'none',        // preset key
    brightness: 100,       // %
    contrast: 100,
    saturation: 100,
  };
  let textPlaced = false;
  let textPos = { xPct: 0.5, yPct: 0.5 };

  const PRESET_SIZES = [
    { label: 'Original', w: null, h: null },
    { label: 'Post', w: 1080, h: 1080 },
    { label: 'Story', w: 1080, h: 1920 },
    { label: 'WhatsApp', w: 1080, h: 1080 },
    { label: 'Portrait', w: 1080, h: 1350 },
  ];

  const FILTERS = [
    { key: 'none', label: 'Original', css: 'none' },
    { key: 'vibrant', label: 'Vibrant', css: 'saturate(1.5) contrast(1.08)' },
    { key: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.05)' },
    { key: 'warm', label: 'Warm', css: 'sepia(0.35) saturate(1.3) brightness(1.03)' },
    { key: 'fade', label: 'Fade', css: 'contrast(0.85) brightness(1.08) saturate(0.85)' },
    { key: 'cool', label: 'Cool', css: 'saturate(1.1) hue-rotate(-8deg) brightness(1.02)' },
  ];

  // ---------- Upload ----------
  uploadDrop.addEventListener('click', () => {}); // label already triggers input
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const image = new Image();
      image.onload = () => {
        img = image;
        resetState();
        landing.hidden = true;
        editor.hidden = false;
        render();
      };
      image.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  function resetState() {
    state = { rotation: 0, flipH: false, flipV: false, cropRatio: null, filter: 'none', brightness: 100, contrast: 100, saturation: 100 };
    textPlaced = false;
    textOverlay.hidden = true;
    textOverlay.textContent = '';
    activeTool = null;
    contextPanel.hidden = true;
    setActiveToolButton(null);
  }

  btnBack.addEventListener('click', () => {
    editor.hidden = true;
    landing.hidden = false;
    fileInput.value = '';
  });

  // ---------- Rendering ----------
  function getCanvasSize() {
    const swapped = state.rotation === 90 || state.rotation === 270;
    let baseW = img.naturalWidth;
    let baseH = img.naturalHeight;

    if (state.cropRatio && state.cropRatio.w) {
      // Target aspect ratio, fit within source by cropping
      const targetAspect = state.cropRatio.w / state.cropRatio.h;
      const srcAspect = baseW / baseH;
      if (srcAspect > targetAspect) {
        baseH = baseH;
        baseW = baseH * targetAspect;
      } else {
        baseW = baseW;
        baseH = baseW / targetAspect;
      }
    }
    return swapped ? { w: baseH, h: baseW, cropW: baseW, cropH: baseH } : { w: baseW, h: baseH, cropW: baseW, cropH: baseH };
  }

  function render() {
    if (!img) return;
    const { w, h, cropW, cropH } = getCanvasSize();
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Move to center, apply rotation/flip
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);

    // Apply filter + adjustments
    const presetCss = FILTERS.find(f => f.key === state.filter).css;
    const adjustCss = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
    ctx.filter = presetCss === 'none' ? adjustCss : `${presetCss} ${adjustCss}`;

    // Draw image centered, cropped to cropW/cropH region from source center
    const sx = (img.naturalWidth - cropW) / 2;
    const sy = (img.naturalHeight - cropH) / 2;
    ctx.drawImage(img, sx, sy, cropW, cropH, -cropW / 2, -cropH / 2, cropW, cropH);

    ctx.restore();

    positionTextOverlay();
  }

  function positionTextOverlay() {
    if (!textPlaced) return;
    const rect = canvas.getBoundingClientRect();
    textOverlay.style.left = (rect.left + rect.width * textPos.xPct) + 'px';
    textOverlay.style.top = (rect.top + rect.height * textPos.yPct) + 'px';
    textOverlay.style.transform = 'translate(-50%, -50%)';
  }
  window.addEventListener('resize', positionTextOverlay);

  // ---------- Tool rail ----------
  toolRail.addEventListener('click', (e) => {
    const btn = e.target.closest('.tool-btn');
    if (!btn) return;
    const tool = btn.dataset.tool;
    if (activeTool === tool) {
      activeTool = null;
      contextPanel.hidden = true;
      setActiveToolButton(null);
      return;
    }
    activeTool = tool;
    setActiveToolButton(tool);
    openPanel(tool);
  });

  function setActiveToolButton(tool) {
    document.querySelectorAll('.tool-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.tool === tool);
    });
  }

  function openPanel(tool) {
    contextPanel.innerHTML = '';
    contextPanel.hidden = false;
    contextPanel.className = 'context-panel';

    if (tool === 'crop') {
      PRESET_SIZES.forEach(preset => {
        const chip = document.createElement('button');
        chip.className = 'chip' + (isRatioActive(preset) ? ' is-active' : '');
        chip.textContent = preset.label;
        chip.addEventListener('click', () => {
          state.cropRatio = preset.w ? preset : null;
          render();
          openPanel('crop');
        });
        contextPanel.appendChild(chip);
      });
    }

    if (tool === 'filter') {
      FILTERS.forEach(f => {
        const wrap = document.createElement('button');
        wrap.className = 'filter-chip' + (state.filter === f.key ? ' is-active' : '');
        const thumb = document.createElement('canvas');
        thumb.className = 'filter-chip__thumb';
        thumb.width = 52; thumb.height = 52;
        drawThumb(thumb, f.css);
        const label = document.createElement('span');
        label.className = 'filter-chip__label';
        label.textContent = f.label;
        wrap.appendChild(thumb);
        wrap.appendChild(label);
        wrap.addEventListener('click', () => {
          state.filter = f.key;
          render();
          openPanel('filter');
        });
        contextPanel.appendChild(wrap);
      });
    }

    if (tool === 'adjust') {
      contextPanel.classList.add('adjust-panel');
      addSlider('Brightness', state.brightness, 50, 150, (v) => { state.brightness = v; render(); });
      addSlider('Contrast', state.contrast, 50, 150, (v) => { state.contrast = v; render(); });
      addSlider('Saturation', state.saturation, 0, 200, (v) => { state.saturation = v; render(); });
    }

    if (tool === 'text') {
      if (!textPlaced) {
        textPlaced = true;
        textOverlay.hidden = false;
        textOverlay.textContent = 'Your text';
        textPos = { xPct: 0.5, yPct: 0.5 };
        positionTextOverlay();
        selectAllText();
      }
      const hint = document.createElement('span');
      hint.className = 'chip';
      hint.style.pointerEvents = 'none';
      hint.textContent = 'Drag text on photo · tap to edit';
      contextPanel.appendChild(hint);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'chip';
      removeBtn.textContent = 'Remove text';
      removeBtn.addEventListener('click', () => {
        textPlaced = false;
        textOverlay.hidden = true;
        textOverlay.textContent = '';
      });
      contextPanel.appendChild(removeBtn);
    }

    if (tool === 'rotate') {
      const rotateBtn = document.createElement('button');
      rotateBtn.className = 'chip';
      rotateBtn.textContent = 'Rotate 90°';
      rotateBtn.addEventListener('click', () => {
        state.rotation = (state.rotation + 90) % 360;
        render();
      });
      const flipHBtn = document.createElement('button');
      flipHBtn.className = 'chip' + (state.flipH ? ' is-active' : '');
      flipHBtn.textContent = 'Flip horizontal';
      flipHBtn.addEventListener('click', () => {
        state.flipH = !state.flipH;
        render();
        openPanel('rotate');
      });
      const flipVBtn = document.createElement('button');
      flipVBtn.className = 'chip' + (state.flipV ? ' is-active' : '');
      flipVBtn.textContent = 'Flip vertical';
      flipVBtn.addEventListener('click', () => {
        state.flipV = !state.flipV;
        render();
        openPanel('rotate');
      });
      contextPanel.appendChild(rotateBtn);
      contextPanel.appendChild(flipHBtn);
      contextPanel.appendChild(flipVBtn);
    }
  }

  function isRatioActive(preset) {
    if (!preset.w) return !state.cropRatio;
    return state.cropRatio && state.cropRatio.label === preset.label;
  }

  function addSlider(label, value, min, max, onChange) {
    const row = document.createElement('div');
    row.className = 'slider-row';
    const labelRow = document.createElement('div');
    labelRow.className = 'slider-row__label';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = label;
    const valSpan = document.createElement('span');
    valSpan.textContent = value + '%';
    labelRow.appendChild(nameSpan);
    labelRow.appendChild(valSpan);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.value = value;
    input.addEventListener('input', () => {
      valSpan.textContent = input.value + '%';
      onChange(Number(input.value));
    });
    row.appendChild(labelRow);
    row.appendChild(input);
    contextPanel.appendChild(row);
  }

  function drawThumb(thumbCanvas, css) {
    if (!img) return;
    const tctx = thumbCanvas.getContext('2d');
    tctx.filter = css;
    const size = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - size) / 2;
    const sy = (img.naturalHeight - size) / 2;
    tctx.drawImage(img, sx, sy, size, size, 0, 0, 52, 52);
  }

  // ---------- Text dragging ----------
  let dragging = false;
  textOverlay.addEventListener('pointerdown', (e) => {
    dragging = true;
    textOverlay.setPointerCapture(e.pointerId);
  });
  textOverlay.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    let xPct = (e.clientX - rect.left) / rect.width;
    let yPct = (e.clientY - rect.top) / rect.height;
    xPct = Math.min(1, Math.max(0, xPct));
    yPct = Math.min(1, Math.max(0, yPct));
    textPos = { xPct, yPct };
    positionTextOverlay();
  });
  textOverlay.addEventListener('pointerup', (e) => {
    dragging = false;
    textOverlay.releasePointerCapture(e.pointerId);
  });
  function selectAllText() {
    setTimeout(() => {
      const range = document.createRange();
      range.selectNodeContents(textOverlay);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      textOverlay.focus();
    }, 50);
  }

  // ---------- Export ----------
  btnDownload.addEventListener('click', () => {
    // Draw current canvas state + text onto an offscreen canvas for export
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ectx = exportCanvas.getContext('2d');
    ectx.drawImage(canvas, 0, 0);

    if (textPlaced && textOverlay.textContent.trim()) {
      const fontSize = Math.max(20, Math.round(canvas.width * 0.06));
      ectx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
      ectx.fillStyle = '#ffffff';
      ectx.textAlign = 'center';
      ectx.textBaseline = 'middle';
      ectx.shadowColor = 'rgba(0,0,0,0.5)';
      ectx.shadowBlur = 12;
      ectx.shadowOffsetY = 3;
      const x = textPos.xPct * exportCanvas.width;
      const y = textPos.yPct * exportCanvas.height;
      ectx.fillText(textOverlay.textContent, x, y);
    }

    exportCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'snappa-edit.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png', 0.95);
  });
})();
