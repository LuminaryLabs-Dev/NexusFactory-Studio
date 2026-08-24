function finite(value, fallback) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function texture(cache, id) { return id ? cache.get(id) : null; }
function sideFor(THREE, source) { return source.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide; }

export function createMeshMaterial(THREE, source = {}, textureCache) {
  const physical = ['clearcoat', 'clearcoatRoughness', 'iridescence', 'transmission'].some((field) => finite(source[field], 0) > 0);
  const Material = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const color = source.baseColorFactor ?? source.baseColor ?? [0.65, 0.68, 0.72, 1];
  const alphaMode = source.alphaMode ?? 'OPAQUE';
  const options = {
    color: new THREE.Color(color[0], color[1], color[2]),
    opacity: finite(color[3], 1),
    metalness: finite(source.metallicFactor ?? source.metallic, 0),
    roughness: finite(source.roughnessFactor ?? source.roughness, 0.7),
    side: sideFor(THREE, source),
    transparent: alphaMode === 'BLEND' || finite(color[3], 1) < 1,
    alphaTest: alphaMode === 'MASK' ? finite(source.alphaCutoff, 0.5) : 0,
    depthWrite: alphaMode !== 'BLEND',
    vertexColors: source.vertexColors === true,
    map: texture(textureCache, source.baseColorTexture),
    normalMap: texture(textureCache, source.normalTexture),
    metalnessMap: texture(textureCache, source.metallicRoughnessTexture),
    roughnessMap: texture(textureCache, source.metallicRoughnessTexture),
    aoMap: texture(textureCache, source.occlusionTexture),
    aoMapIntensity: finite(source.occlusionStrength, 1),
    emissiveMap: texture(textureCache, source.emissiveTexture),
    emissive: new THREE.Color(...(source.emissiveFactor ?? source.emissive ?? [0, 0, 0])),
    flatShading: false,
  };
  if (options.normalMap && THREE.Vector2) options.normalScale = new THREE.Vector2(finite(source.normalScale, 1), finite(source.normalScale, 1));
  if (physical) {
    options.clearcoat = finite(source.clearcoat, 0);
    options.clearcoatRoughness = finite(source.clearcoatRoughness, 0);
    options.iridescence = finite(source.iridescence, 0);
    options.transmission = finite(source.transmission, 0);
    options.thickness = finite(source.thickness, options.transmission > 0 ? 0.08 : 0);
    options.ior = finite(source.ior, 1.33);
  }
  const material = new Material(options);
  material.name = source.name ?? 'ArtifactMaterial';
  return material;
}
