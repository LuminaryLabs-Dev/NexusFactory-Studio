function decodeBase64(text) {
  const binary = globalThis.atob(String(text));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function wrapping(THREE, value) { return value === 'clamp' ? THREE.ClampToEdgeWrapping : value === 'mirror' ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping; }
function filtering(THREE, value) { return value === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter; }

export function createArtifactTextureCache(THREE, artifact) {
  if (!THREE?.DataTexture) throw new TypeError('Texture cache requires Three.js.');
  const sources = artifact?.textures ?? {};
  const cache = new Map();
  function get(id) {
    if (!id) return null;
    if (cache.has(id)) return cache.get(id);
    const source = sources[id];
    if (!source) throw new RangeError(`Artifact texture not found: ${id}`);
    const bytes = decodeBase64(source.rgbaBase64);
    const expected = source.width * source.height * 4;
    if (bytes.length !== expected) throw new RangeError(`Texture ${id} expected ${expected} RGBA bytes, received ${bytes.length}.`);
    const texture = new THREE.DataTexture(bytes, source.width, source.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.name = id;
    texture.colorSpace = source.colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.magFilter = filtering(THREE, source.sampling);
    texture.minFilter = filtering(THREE, source.sampling);
    texture.wrapS = wrapping(THREE, source.wrapS);
    texture.wrapT = wrapping(THREE, source.wrapT);
    texture.flipY = false;
    texture.generateMipmaps = source.sampling !== 'nearest';
    texture.needsUpdate = true;
    cache.set(id, texture);
    return texture;
  }
  function dispose() { for (const texture of cache.values()) texture.dispose?.(); cache.clear(); }
  return Object.freeze({ get, dispose, size: () => cache.size });
}

export { decodeBase64 };
