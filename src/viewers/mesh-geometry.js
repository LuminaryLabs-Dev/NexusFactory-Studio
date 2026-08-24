export function createMeshGeometry(THREE, source, materialSource = {}) {
  if (!Array.isArray(source?.positions) || !Array.isArray(source?.indices)) throw new TypeError(`Mesh ${source?.id ?? 'unknown'} requires positions and indices.`);
  if (!Array.isArray(source.normals) || source.normals.length !== source.positions.length) throw new TypeError(`Mesh ${source.id ?? 'unknown'} requires Kit-provided normals.`);
  const vertexCount = source.positions.length / 3;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(source.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(source.normals, 3));
  geometry.setIndex(source.indices);
  if (Array.isArray(source.uvs) && source.uvs.length === vertexCount * 2) {
    const uv = new THREE.Float32BufferAttribute(source.uvs, 2);
    geometry.setAttribute('uv', uv);
    if (materialSource.occlusionTexture) geometry.setAttribute('uv2', uv.clone?.() ?? new THREE.Float32BufferAttribute(source.uvs, 2));
  }
  if (Array.isArray(source.tangents) && source.tangents.length === vertexCount * 4) geometry.setAttribute('tangent', new THREE.Float32BufferAttribute(source.tangents, 4));
  if (Array.isArray(source.colors) && source.colors.length) {
    const itemSize = source.colors.length === vertexCount * 4 ? 4 : source.colors.length === vertexCount * 3 ? 3 : 0;
    if (itemSize) geometry.setAttribute('color', new THREE.Float32BufferAttribute(source.colors, itemSize));
  }
  geometry.computeBoundingBox?.();
  geometry.computeBoundingSphere?.();
  return geometry;
}
