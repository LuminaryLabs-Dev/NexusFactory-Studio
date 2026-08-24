import * as THREE from "https://esm.sh/three@0.165.0";
import { createArtifactTextureCache } from "./artifact-texture.js";
import { createMeshGeometry } from "./mesh-geometry.js";
import { createMeshMaterial } from "./mesh-material.js";

export class Mesh3DViewer {
  constructor(container) {
    this.container = container;
    this.disposed = false;
    this.frame = null;
    this.textureCache = null;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1018);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('useLegacyLights' in this.renderer) this.renderer.useLegacyLights = false;
    this.container.appendChild(this.renderer.domElement);
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.scene.add(new THREE.HemisphereLight(0xc9e6ff, 0x10202a, 1.55));
    this.key = new THREE.DirectionalLight(0xffffff, 3.2);
    this.key.position.set(5, 8, 7);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.scene.add(this.key);
    this.fill = new THREE.DirectionalLight(0x76c8d8, 1.05);
    this.fill.position.set(-5, 2, 4);
    this.scene.add(this.fill);
    this.rim = new THREE.DirectionalLight(0x8fa8ff, 1.7);
    this.rim.position.set(-2, 5, -7);
    this.scene.add(this.rim);

    this.grid = new THREE.GridHelper(12, 24, 0x29384c, 0x182230);
    this.scene.add(this.grid);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.22 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

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
    this.textureCache?.dispose?.();
    this.textureCache = null;
  }

  show(artifact) {
    if (this.disposed) throw new Error("Cannot show an artifact on a disposed Mesh3DViewer.");
    this.clear();
    const palette = artifact.materials ?? {};
    this.textureCache = createArtifactTextureCache(THREE, artifact);
    for (const source of artifact.meshes ?? []) {
      const materialSource = palette[source.material] ?? {};
      const geometry = createMeshGeometry(THREE, source, materialSource);
      const material = createMeshMaterial(THREE, { ...materialSource, doubleSided: source.doubleSided ?? materialSource.doubleSided }, this.textureCache);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = source.id;
      mesh.castShadow = material.transparent !== true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    const hints = artifact.metadata?.renderHints ?? {};
    if (hints.background) this.scene.background = new THREE.Color(hints.background);
    this.grid.visible = hints.showGrid !== false;
    this.floor.visible = hints.showGround !== false;
    const box = new THREE.Box3().setFromObject(this.group);
    if (!box.isEmpty()) {
      box.getCenter(this.target);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const framing = Number(hints.camera?.framing ?? 1);
      this.distance = Math.max(2.5, sphere.radius * 2.7 * (Number.isFinite(framing) ? framing : 1));
      this.floor.position.y = box.min.y - Math.max(0.015, sphere.radius * 0.015);
      this.grid.position.y = this.floor.position.y + 0.002;
    }
    if (Number.isFinite(hints.camera?.azimuth)) this.azimuth = hints.camera.azimuth;
    if (Number.isFinite(hints.camera?.elevation)) this.elevation = hints.camera.elevation;
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
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.grid.geometry?.dispose?.();
    this.grid.material?.dispose?.();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    canvas.remove();
  }
}
