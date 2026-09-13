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
