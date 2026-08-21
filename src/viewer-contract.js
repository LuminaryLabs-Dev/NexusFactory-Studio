export const SUPPORTED_PREVIEW_TYPES = Object.freeze(["mesh-3d", "image-2d"]);

export function resolvePreviewType(preview) {
  const type = String(preview ?? "none");
  return SUPPORTED_PREVIEW_TYPES.includes(type) ? type : null;
}

export function mimeTypeForFormat(format) {
  switch (String(format ?? "").toLowerCase()) {
    case "glb": return "model/gltf-binary";
    case "png": return "image/png";
    case "json": return "application/json";
    default: return "application/octet-stream";
  }
}
