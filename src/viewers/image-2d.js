export function decodeRgbaBase64(base64) {
  if (typeof base64 !== "string" || base64.length === 0) throw new TypeError("Image2DViewer requires non-empty base64 RGBA data.");
  const binary = globalThis.atob(base64);
  const pixels = new Uint8ClampedArray(binary.length);
  for (let index = 0; index < binary.length; index += 1) pixels[index] = binary.charCodeAt(index);
  return pixels;
}

export function computeDisplayRect(sourceWidth, sourceHeight, viewportWidth, viewportHeight) {
  if (![sourceWidth, sourceHeight, viewportWidth, viewportHeight].every((value) => Number.isFinite(value) && value > 0)) throw new TypeError("Display dimensions must be positive finite numbers.");
  const fit = Math.min(viewportWidth / sourceWidth, viewportHeight / sourceHeight);
  const scale = fit >= 1 ? Math.max(1, Math.floor(fit)) : fit;
  const width = Math.max(1, sourceWidth * scale);
  const height = Math.max(1, sourceHeight * scale);
  return Object.freeze({ x: (viewportWidth - width) / 2, y: (viewportHeight - height) / 2, width, height, scale });
}

export class Image2DViewer {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "image-2d-canvas";
    this.context = this.canvas.getContext("2d", { alpha: true });
    if (!this.context) throw new Error("Image2DViewer requires a 2D canvas context.");
    this.sourceCanvas = document.createElement("canvas");
    this.sourceContext = this.sourceCanvas.getContext("2d", { alpha: true });
    if (!this.sourceContext) throw new Error("Image2DViewer requires an offscreen 2D canvas context.");
    this.image = null;
    this.container.appendChild(this.canvas);
    this.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.resize()) : null;
    this.resizeObserver?.observe(container);
    this.resize();
  }

  show(artifact) {
    const image = artifact?.image;
    if (artifact?.artifactKind !== "image" || !image) throw new TypeError("Image2DViewer requires an image artifact.");
    if (!Number.isInteger(image.width) || image.width <= 0 || !Number.isInteger(image.height) || image.height <= 0) throw new TypeError("Image2DViewer requires positive integer image dimensions.");
    if (image.pixelFormat !== "rgba8" || image.channels !== 4) throw new TypeError("Image2DViewer only supports rgba8 image artifacts.");

    const pixels = decodeRgbaBase64(image.rgbaBase64);
    if (pixels.length !== image.width * image.height * 4) throw new TypeError(`RGBA payload length ${pixels.length} does not match ${image.width}x${image.height}.`);

    this.image = image;
    this.sourceCanvas.width = image.width;
    this.sourceCanvas.height = image.height;
    this.sourceContext.clearRect(0, 0, image.width, image.height);
    this.sourceContext.putImageData(new ImageData(pixels, image.width, image.height), 0, 0);
    this.canvas.classList.toggle("transparent", image.transparent === true);
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth || 1);
    const height = Math.max(1, this.container.clientHeight || 1);
    const pixelRatio = Math.min(globalThis.devicePixelRatio ?? 1, 2);
    const bufferWidth = Math.max(1, Math.round(width * pixelRatio));
    const bufferHeight = Math.max(1, Math.round(height * pixelRatio));
    if (this.canvas.width !== bufferWidth) this.canvas.width = bufferWidth;
    if (this.canvas.height !== bufferHeight) this.canvas.height = bufferHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.context.clearRect(0, 0, width, height);
    if (!this.image) return;
    const rect = computeDisplayRect(this.image.width, this.image.height, width, height);
    this.context.imageSmoothingEnabled = this.image.sampling !== "nearest";
    this.context.drawImage(this.sourceCanvas, rect.x, rect.y, rect.width, rect.height);
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.image = null;
    this.sourceCanvas.width = 0;
    this.sourceCanvas.height = 0;
    this.canvas.remove();
  }
}
