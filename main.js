/* QRSync & Styler
   La librería del CDN solo calcula qué cuadrados van en negro.
   Aquí los dibujamos en un canvas grande, con marco, y ese mismo
   canvas es el que se descarga o se copia. */

const DEFAULT_TEXT = "https://tu-portafolio.com";
const EXPORT_WIDTH = 1600;

const FRAME_HELP = {
  none: "Solo el código, con margen limpio para escanear.",
  scan: "Banner inferior con la llamada ¡Escaneame!",
  web: "Borde y texto Visita mi Web debajo del código.",
  follow: "Etiqueta superior, pensada para redes."
};

const textInput = document.getElementById("qr-text");
const inkInput = document.getElementById("color-ink");
const paperInput = document.getElementById("color-paper");
const inkHex = document.getElementById("ink-hex");
const paperHex = document.getElementById("paper-hex");
const contrastNote = document.getElementById("contrast-note");
const frameHelp = document.getElementById("frame-help");
const frameGroup = document.querySelector(".frames");
const canvas = document.getElementById("qr-canvas");
const caption = document.getElementById("caption");
const statusText = document.getElementById("status-text");
const statusDot = document.getElementById("status-dot");
const downloadBtn = document.getElementById("btn-download");
const copyBtn = document.getElementById("btn-copy");
const exampleBtn = document.getElementById("use-example");
const form = document.getElementById("qr-form");
const toast = document.getElementById("toast");

const state = {
  frame: "scan",
  ink: inkInput.value,
  paper: paperInput.value
};

let toastTimer = 0;
let canDownload = false;

function init() {
  if (typeof qrcode !== "function") {
    showLibraryError();
    return;
  }

  // La librería, por defecto, no guarda bien tildes ni eñes.
  // El propio archivo del CDN trae un codificador UTF-8: lo activamos.
  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  textInput.addEventListener("input", render);
  inkInput.addEventListener("input", function () {
    state.ink = inkInput.value;
    render();
  });
  paperInput.addEventListener("input", function () {
    state.paper = paperInput.value;
    render();
  });

  frameGroup.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-frame]");
    if (!button) return;

    state.frame = button.getAttribute("data-frame");
    const buttons = frameGroup.querySelectorAll("button");
    for (let i = 0; i < buttons.length; i += 1) {
      const isOn = buttons[i] === button;
      buttons[i].classList.toggle("is-active", isOn);
      buttons[i].setAttribute("aria-pressed", isOn ? "true" : "false");
    }
    render();
  });

  exampleBtn.addEventListener("click", function () {
    textInput.value = DEFAULT_TEXT;
    render();
    textInput.focus();
  });

  downloadBtn.addEventListener("click", downloadQr);
  copyBtn.addEventListener("click", copyQr);

  render();
  syncCardSize();

  // Cuando llegue la fuente, volvemos a pintar el texto del marco.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      render();
      syncCardSize();
    });
  }

  // La vista previa copia la altura de Personaliza para que las dos tarjetas midan igual.
  if (window.ResizeObserver) {
    new ResizeObserver(syncCardSize).observe(document.querySelector(".controls-card"));
  }
  window.addEventListener("resize", syncCardSize);
}

function syncCardSize() {
  const controlsCard = document.querySelector(".controls-card");
  const previewCard = document.querySelector(".preview-card");
  const isDesktop = window.matchMedia("(min-width: 960px)").matches;

  if (!isDesktop) {
    previewCard.style.height = "";
    return;
  }

  previewCard.style.height = controlsCard.offsetHeight + "px";
}

function readContent() {
  const typed = textInput.value.trim();
  if (!typed) {
    return { value: DEFAULT_TEXT, isExample: true };
  }
  return { value: typed, isExample: false };
}

// Prueba primero con mucha corrección de errores (mejor si el QR se imprime).
// Si el texto no cabe, baja de nivel hasta que entre.
function createQr(text) {
  if (text.length > 2500) return null;

  const levels = ["H", "Q", "M", "L"];
  for (let i = 0; i < levels.length; i += 1) {
    try {
      const qr = qrcode(0, levels[i]);
      qr.addData(text);
      qr.make();
      return qr;
    } catch (error) {
      // Este nivel no cabe. Seguimos con el siguiente.
    }
  }
  return null;
}

function getLayout(frame, width) {
  const radius = Math.round(width * 0.045);

  if (frame === "scan") {
    const pad = Math.round(width * 0.075);
    const qrSize = width - pad * 2;
    const gap = Math.round(width * 0.04);
    const bannerH = Math.round(width * 0.17);
    const height = pad + qrSize + gap + bannerH;
    return {
      width: width,
      height: height,
      radius: radius,
      qr: { x: pad, y: pad, size: qrSize },
      banner: { y: pad + qrSize + gap, height: bannerH },
      text: "¡Escaneame!"
    };
  }

  if (frame === "web") {
    const qrSize = Math.round(width * 0.76);
    const qrX = Math.round((width - qrSize) / 2);
    const qrY = Math.round(width * 0.08);
    const textBand = Math.round(width * 0.16);
    const height = qrY + qrSize + textBand;
    return {
      width: width,
      height: height,
      radius: radius,
      qr: { x: qrX, y: qrY, size: qrSize },
      border: Math.max(10, Math.round(width * 0.012)),
      text: "Visita mi Web",
      textY: qrY + qrSize + Math.round(textBand * 0.42)
    };
  }

  if (frame === "follow") {
    const header = Math.round(width * 0.18);
    const pad = Math.round(width * 0.085);
    const bottom = Math.round(width * 0.075);
    const qrSize = width - pad * 2;
    const pillH = Math.round(width * 0.12);
    return {
      width: width,
      height: header + qrSize + bottom,
      radius: radius,
      qr: { x: pad, y: header, size: qrSize },
      text: "Sígueme",
      pill: {
        w: Math.round(width * 0.52),
        h: pillH,
        y: Math.round((header - pillH) / 2)
      }
    };
  }

  const pad = Math.round(width * 0.09);
  return {
    width: width,
    height: width,
    radius: radius,
    qr: { x: pad, y: pad, size: width - pad * 2 }
  };
}

function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCenteredText(ctx, text, centerX, centerY, maxWidth, startSize, color) {
  let size = startSize;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  do {
    ctx.font = "800 " + size + 'px "Plus Jakarta Sans", sans-serif';
    if (ctx.measureText(text).width <= maxWidth || size <= 28) break;
    size -= 2;
  } while (size > 28);

  ctx.fillText(text, centerX, centerY);
}

// quiet = 4 módulos en blanco alrededor. Sin ese margen, algunos móviles no leen el QR.
function drawModules(ctx, qr, area, color) {
  const count = qr.getModuleCount();
  const quiet = 4;
  const cells = count + quiet * 2;
  const cell = Math.floor(area.size / cells);
  const drawn = cell * cells;
  const offsetX = area.x + Math.floor((area.size - drawn) / 2);
  const offsetY = area.y + Math.floor((area.size - drawn) / 2);

  ctx.fillStyle = color;
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(
          offsetX + (col + quiet) * cell,
          offsetY + (row + quiet) * cell,
          cell,
          cell
        );
      }
    }
  }
}

function drawFrame(ctx, layout, ink, paper) {
  if (layout.border) {
    const inset = Math.round(layout.border * 1.6);
    roundRect(
      ctx,
      inset,
      inset,
      layout.width - inset * 2,
      layout.height - inset * 2,
      Math.max(12, layout.radius - inset)
    );
    ctx.strokeStyle = ink;
    ctx.lineWidth = layout.border;
    ctx.stroke();
  }

  if (layout.banner) {
    ctx.fillStyle = ink;
    ctx.fillRect(0, layout.banner.y, layout.width, layout.height - layout.banner.y + 2);
    drawCenteredText(
      ctx,
      layout.text,
      layout.width / 2,
      layout.banner.y + layout.banner.height / 2,
      layout.width * 0.9,
      Math.round(layout.banner.height * 0.55),
      paper
    );
  }

  if (layout.pill) {
    const x = Math.round((layout.width - layout.pill.w) / 2);
    ctx.fillStyle = ink;
    roundRect(ctx, x, layout.pill.y, layout.pill.w, layout.pill.h, layout.pill.h / 2);
    ctx.fill();
    drawCenteredText(
      ctx,
      layout.text,
      layout.width / 2,
      layout.pill.y + layout.pill.h / 2,
      layout.pill.w * 0.88,
      Math.round(layout.pill.h * 0.55),
      paper
    );
  }

  if (layout.text && !layout.banner && !layout.pill) {
    drawCenteredText(
      ctx,
      layout.text,
      layout.width / 2,
      layout.textY,
      layout.width * 0.8,
      Math.round(layout.width * 0.048),
      ink
    );
  }
}

function paint(qr) {
  const layout = getLayout(state.frame, EXPORT_WIDTH);
  canvas.width = layout.width;
  canvas.height = layout.height;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.save();
  roundRect(ctx, 0, 0, layout.width, layout.height, layout.radius);
  ctx.clip();
  ctx.fillStyle = state.paper;
  ctx.fillRect(0, 0, layout.width, layout.height);
  drawModules(ctx, qr, layout.qr, state.ink);
  drawFrame(ctx, layout, state.ink, state.paper);
  ctx.restore();
}

function paintError() {
  const size = EXPORT_WIDTH;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  roundRect(ctx, 0, 0, size, size, Math.round(size * 0.045));
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  drawCenteredText(ctx, "Texto demasiado largo", size / 2, size / 2 - 36, size * 0.75, 54, "#0f172a");
  drawCenteredText(ctx, "Prueba con un enlace más corto", size / 2, size / 2 + 40, size * 0.75, 34, "#64748b");
}

function channelLuma(hex, start) {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  if (value <= 0.03928) return value / 12.92;
  return Math.pow((value + 0.055) / 1.055, 2.4);
}

function contrastRatio(a, b) {
  function luma(hex) {
    return 0.2126 * channelLuma(hex, 1) + 0.7152 * channelLuma(hex, 3) + 0.0722 * channelLuma(hex, 5);
  }
  const lighter = Math.max(luma(a), luma(b));
  const darker = Math.min(luma(a), luma(b));
  return (lighter + 0.05) / (darker + 0.05);
}

function setStatus(kind, message) {
  statusText.textContent = message;
  statusDot.classList.remove("is-warn", "is-bad");
  if (kind) statusDot.classList.add(kind);
}

function render() {
  const content = readContent();
  frameHelp.textContent = FRAME_HELP[state.frame] || FRAME_HELP.none;
  inkHex.textContent = state.ink.toUpperCase();
  paperHex.textContent = state.paper.toUpperCase();

  if (content.isExample) {
    caption.textContent = "Ejemplo · " + content.value;
  } else {
    caption.textContent = content.value;
  }
  canvas.setAttribute("aria-label", "Código QR de " + content.value);

  const ratio = contrastRatio(state.ink, state.paper);
  if (ratio < 3) {
    contrastNote.hidden = false;
    contrastNote.textContent = "Sube el contraste entre los dos colores para que el QR se pueda escanear bien.";
  } else {
    contrastNote.hidden = true;
  }

  const qr = createQr(content.value);
  if (!qr) {
    paintError();
    canvas.classList.add("is-ready");
    canDownload = false;
    downloadBtn.disabled = true;
    copyBtn.disabled = true;
    setStatus("is-bad", "Texto demasiado largo");
    return;
  }

  paint(qr);
  canvas.classList.add("is-ready");
  canDownload = true;
  downloadBtn.disabled = false;
  copyBtn.disabled = false;

  if (ratio < 3) {
    setStatus("is-warn", "Poco contraste para escanear");
  } else {
    setStatus("", "Listo para descargar");
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(function () {
    toast.classList.remove("is-visible");
  }, 2600);
}

function downloadQr() {
  if (!canDownload) return;

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "qrsync-styler.png";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("¡Código QR descargado con éxito!");
}

function copyQr() {
  if (!canDownload) return;

  const content = readContent();

  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    copyText(content.value);
    return;
  }

  // Pasamos la imagen como promesa para no perder el clic del usuario.
  const item = new ClipboardItem({
    "image/png": new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        resolve(blob);
      }, "image/png");
    })
  });

  navigator.clipboard.write([item]).then(function () {
    showToast("¡Código QR copiado al portapapeles!");
  }).catch(function () {
    copyText(content.value);
  });
}

function copyText(value) {
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    showToast("No se pudo copiar. Descarga el PNG.");
    return;
  }

  navigator.clipboard.writeText(value).then(function () {
    showToast("Se copió el texto del QR");
  }).catch(function () {
    showToast("No se pudo copiar. Descarga el PNG.");
  });
}

function showLibraryError() {
  setStatus("is-bad", "No se pudo cargar el generador");
  caption.textContent = "Hace falta conexión para cargar la librería del QR.";
  downloadBtn.disabled = true;
  copyBtn.disabled = true;
}

init();
