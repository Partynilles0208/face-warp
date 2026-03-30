const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const imgCanvas = document.createElement("canvas");
const imgCtx = imgCanvas.getContext("2d", { willReadFrequently: true });
const originalCanvas = document.createElement("canvas");
const originalCtx = originalCanvas.getContext("2d", { willReadFrequently: true });

const fileInput = document.getElementById("fileInput");
const resetBtn = document.getElementById("resetBtn");
const saveBtn = document.getElementById("saveBtn");
const strengthInput = document.getElementById("strength");
const sizeInput = document.getElementById("size");
const strengthValue = document.getElementById("strengthValue");
const sizeValue = document.getElementById("sizeValue");
const placeholder = document.getElementById("placeholder");
const brush = document.getElementById("brush");
const canvasFrame = document.getElementById("canvasFrame");

let strength = parseFloat(strengthInput.value);
let radius = parseInt(sizeInput.value, 10);
let hasImage = false;
let dragging = false;
let lastPos = null;

const MAX_DIMENSION = 1600;

function updateSliderValues() {
  strengthValue.textContent = strength.toFixed(2);
  sizeValue.textContent = `${radius} px`;
  updateBrushSize();
}

function setHasImage(value) {
  hasImage = value;
  placeholder.classList.toggle("is-hidden", value);
  canvasFrame.classList.toggle("has-image", value);
  resetBtn.disabled = !value;
  saveBtn.disabled = !value;
}

function updateBrushSize() {
  if (!hasImage) return;
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width / canvas.width;
  const cssRadius = radius * scale;
  brush.style.width = `${cssRadius * 2}px`;
  brush.style.height = `${cssRadius * 2}px`;
}

function updateBrushPosition(cssX, cssY, visible) {
  if (!hasImage) return;
  if (visible) {
    brush.style.opacity = "1";
  }
  brush.style.left = `${cssX}px`;
  brush.style.top = `${cssY}px`;
}

function hideBrush() {
  brush.style.opacity = "0";
}

function getPointerPos(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  return {
    x,
    y,
    cssX: event.clientX - rect.left,
    cssY: event.clientY - rect.top,
  };
}

function drawToScreen() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imgCanvas, 0, 0);
}

function setCanvasSize(width, height) {
  canvas.width = width;
  canvas.height = height;
  imgCanvas.width = width;
  imgCanvas.height = height;
  originalCanvas.width = width;
  originalCanvas.height = height;
}

function loadImageFromFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const targetWidth = Math.round(img.width * scale);
    const targetHeight = Math.round(img.height * scale);
    setCanvasSize(targetWidth, targetHeight);
    originalCtx.clearRect(0, 0, targetWidth, targetHeight);
    imgCtx.clearRect(0, 0, targetWidth, targetHeight);
    originalCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
    imgCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
    drawToScreen();
    setHasImage(true);
    updateBrushSize();
    URL.revokeObjectURL(url);
    fileInput.value = "";
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function resetImage() {
  if (!hasImage) return;
  imgCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
  imgCtx.drawImage(originalCanvas, 0, 0);
  drawToScreen();
}

function exportImage() {
  if (!hasImage) return;
  const link = document.createElement("a");
  link.download = "face-warp.png";
  link.href = imgCanvas.toDataURL("image/png");
  link.click();
}

function applyStroke(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / (radius * 0.35)));
  const stepX = dx / steps;
  const stepY = dy / steps;

  for (let i = 1; i <= steps; i += 1) {
    const x = from.x + stepX * i;
    const y = from.y + stepY * i;
    warpAt(x, y, stepX, stepY);
  }
}

function warpAt(centerX, centerY, deltaX, deltaY) {
  const width = imgCanvas.width;
  const height = imgCanvas.height;
  if (width === 0 || height === 0) return;

  const left = Math.max(0, Math.floor(centerX - radius));
  const top = Math.max(0, Math.floor(centerY - radius));
  const right = Math.min(width, Math.ceil(centerX + radius));
  const bottom = Math.min(height, Math.ceil(centerY + radius));
  const boxWidth = right - left;
  const boxHeight = bottom - top;
  if (boxWidth <= 0 || boxHeight <= 0) return;

  const src = imgCtx.getImageData(0, 0, width, height);
  const srcData = src.data;
  const out = imgCtx.createImageData(boxWidth, boxHeight);
  const outData = out.data;

  const radiusSquared = radius * radius;

  for (let y = 0; y < boxHeight; y += 1) {
    const gy = top + y;
    for (let x = 0; x < boxWidth; x += 1) {
      const gx = left + x;
      const dx = gx - centerX;
      const dy = gy - centerY;
      const distSquared = dx * dx + dy * dy;
      let sampleX = gx;
      let sampleY = gy;

      if (distSquared < radiusSquared) {
        const dist = Math.sqrt(distSquared);
        const falloff = 1 - dist / radius;
        const influence = falloff * falloff;
        sampleX = gx - deltaX * strength * influence;
        sampleY = gy - deltaY * strength * influence;
        if (sampleX < 0) sampleX = 0;
        if (sampleY < 0) sampleY = 0;
        if (sampleX > width - 1) sampleX = width - 1;
        if (sampleY > height - 1) sampleY = height - 1;
      }

      const x0 = Math.floor(sampleX);
      const y0 = Math.floor(sampleY);
      const x1 = Math.min(x0 + 1, width - 1);
      const y1 = Math.min(y0 + 1, height - 1);
      const tx = sampleX - x0;
      const ty = sampleY - y0;

      const idx00 = (y0 * width + x0) * 4;
      const idx10 = (y0 * width + x1) * 4;
      const idx01 = (y1 * width + x0) * 4;
      const idx11 = (y1 * width + x1) * 4;
      const outIndex = (y * boxWidth + x) * 4;

      for (let c = 0; c < 4; c += 1) {
        const v0 = srcData[idx00 + c] * (1 - tx) + srcData[idx10 + c] * tx;
        const v1 = srcData[idx01 + c] * (1 - tx) + srcData[idx11 + c] * tx;
        outData[outIndex + c] = v0 * (1 - ty) + v1 * ty;
      }
    }
  }

  imgCtx.putImageData(out, left, top);
  drawToScreen();
}

strengthInput.addEventListener("input", () => {
  strength = parseFloat(strengthInput.value);
  updateSliderValues();
});

sizeInput.addEventListener("input", () => {
  radius = parseInt(sizeInput.value, 10);
  updateSliderValues();
});

fileInput.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  loadImageFromFile(file);
});

resetBtn.addEventListener("click", resetImage);
saveBtn.addEventListener("click", exportImage);

canvas.addEventListener("pointerdown", (event) => {
  if (!hasImage) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  dragging = true;
  lastPos = getPointerPos(event);
  updateBrushPosition(lastPos.cssX, lastPos.cssY, true);
});

canvas.addEventListener("pointermove", (event) => {
  if (!hasImage) return;
  const pos = getPointerPos(event);
  updateBrushPosition(pos.cssX, pos.cssY, true);
  if (!dragging) return;
  if (!lastPos) {
    lastPos = pos;
    return;
  }
  applyStroke(lastPos, pos);
  lastPos = pos;
});

canvas.addEventListener("pointerup", (event) => {
  if (!hasImage) return;
  dragging = false;
  lastPos = null;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("pointerleave", () => {
  if (!hasImage) return;
  hideBrush();
});

canvas.addEventListener("pointerenter", (event) => {
  if (!hasImage) return;
  updateBrushSize();
  const pos = getPointerPos(event);
  updateBrushPosition(pos.cssX, pos.cssY, true);
});

canvas.addEventListener("pointercancel", () => {
  dragging = false;
  lastPos = null;
  hideBrush();
});

canvasFrame.addEventListener("dragover", (event) => {
  event.preventDefault();
  canvasFrame.classList.add("drag");
});

canvasFrame.addEventListener("dragleave", () => {
  canvasFrame.classList.remove("drag");
});

canvasFrame.addEventListener("drop", (event) => {
  event.preventDefault();
  canvasFrame.classList.remove("drag");
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  loadImageFromFile(file);
});

window.addEventListener("resize", updateBrushSize);

updateSliderValues();
