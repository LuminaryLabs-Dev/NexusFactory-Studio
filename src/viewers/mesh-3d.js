import * as THREE from "https://esm.sh/three@0.165.0";

export class Mesh3DViewer {
  constructor(container) {
    this.container = container;
    this.disposed = false;
    this.frame = null;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1018);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x17202b, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const grid = new THREE.GridHelper(12, 24, 0x29384c, 0x182230);
    this.scene.add(grid);
    this.azimuth = Math.PI * 0.28;
    this.elevation = Math.PI * 0.19;
    this.distance = 8;
    this.target = new THREE.Vector3(0, 1, 0);
    this.drag = null;
    this.handlers = {};
    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate();
  }

  bindInput() {
    const canvas = this.renderer.domElement;
    this.handlers.pointerdown = (event) => { this.drag = { x: event.clientX, y: event.clientY, azimuth: this.azimuth, elevation: this.elevation }; canvas.setPointerCapture(event.pointerId); };
    this.handlers.pointermove = (event) => {
      if (!this.drag) return;
      this.azimuth = this.drag.azimuth - (event.clientX - this.drag.x) * 0.008;
      this.elevation = Math.max(-1.25, Math.min(1.25, this.drag.elevation + (event.clientY - this.drag.y) * 0.008));
    };
    this.handlers.pointerup = () => { this.drag = null; };
    this.handlers.wheel = (event) => { event.preventDefault(); this.distance = Math.max(1.5, Math.min(40, this.distance * Math.exp(event.deltaY * 0.001))); };
    canvas.addEventListener("pointerdown", this.handlers.pointerdown);
    canvas.addEventListener("pointermove", this.handlers.pointermove);
    canvas.addEventListener("pointerup", this.handlers.pointerup);
    canvas.addEventListener("pointercancel", this.handlers.pointerup);
    canvas.addEventListener("wheel", this.handlers.wheel, { passive: false });
  }

  resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    for (const child of [...this.group.children]) {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
      this.group.remove(child);
    }
  }

  show(artifact) {
    if (this.disposed) throw new Error("Cannot show an artifact on a disposed Mesh3DViewer.");
    this.clear();
    const palette = artifact.materials ?? {};
    for (const source of artifact.meshes ?? []) {
      if (!Array.isArray(source.positions) || !Array.isArray(source.indices)) throw new TypeError(`Mesh ${source.id ?? "unknown"} requires positions and indices.`);
      if (!Array.isArray(source.normals) || source.normals.length !== source.positions.length) throw new TypeError(`Mesh ${source.id ?? "unknown"} requires Kit-provided normals.`);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(source.positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(source.normals, 3));
      geometry.setIndex(source.indices);
      const materialSource = palette[source.material] ?? {};
      const color = materialSource.baseColor ?? [0.65, 0.68, 0.72, 1];
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color[0], color[1], color[2]),
        metalness: materialSource.metallic ?? 0,
        roughness: materialSource.roughness ?? 0.7,
        flatShading: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = source.id;
      this.group.add(mesh);
    }
    const box = new THREE.Box3().setFromObject(this.group);
    if (!box.isEmpty()) {
      box.getCenter(this.target);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      this.distance = Math.max(2.5, sphere.radius * 2.7);
    }
  }

  snapshot(type = "image/png") {
    if (this.disposed) return Promise.reject(new Error("Cannot snapshot a disposed Mesh3DViewer."));
    this.renderer.render(this.scene, this.camera);
    return new Promise((resolve, reject) => this.renderer.domElement.toBlob((blob) => blob ? resolve(blob) : reject(new Error("3D snapshot failed.")), type));
  }

  animate() {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(() => this.animate());
    const cos = Math.cos(this.elevation);
    this.camera.position.set(
      this.target.x + Math.sin(this.azimuth) * cos * this.distance,
      this.target.y + Math.sin(this.elevation) * this.distance,
      this.target.z + Math.cos(this.azimuth) * cos * this.distance
    );
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.handlers.pointerdown);
    canvas.removeEventListener("pointermove", this.handlers.pointermove);
    canvas.removeEventListener("pointerup", this.handlers.pointerup);
    canvas.removeEventListener("pointercancel", this.handlers.pointerup);
    canvas.removeEventListener("wheel", this.handlers.wheel);
    this.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    canvas.remove();
  }
}
