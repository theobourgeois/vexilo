import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * A flag hoisted on a pole, simulated as Verlet cloth: particles joined by distance
 * constraints, pinned along the hoist, pushed by gusting wind. Wind pressure acts along
 * each vertex normal, plus a travelling ripple so the fly end keeps fluttering.
 */

const FLAG_WIDTH = 3;
const SEGMENTS_X = 36;
const ITERATIONS = 14;
const DAMPING = 0.012;
const STEP = 1 / 120;
const GRAVITY = new THREE.Vector3(0, -2.6, 0);

type Constraint = [a: number, b: number, rest: number, stiffness: number];

export type WavingFlagOptions = {
  /** 0 = still air, 1 = default breeze, 2 = gale. */
  wind?: number;
  reducedMotion?: boolean;
  onReady?: () => void;
  onError?: () => void;
};

export type WavingFlag = {
  setWind: (wind: number) => void;
  dispose: () => void;
};

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  });
}

export function createWavingFlag(
  container: HTMLElement,
  imageUrl: string,
  { wind: initialWind = 1, reducedMotion = false, onReady, onError }: WavingFlagOptions = {},
): WavingFlag {
  let disposed = false;
  let wind = initialWind;
  let frame = 0;
  let visible = true;
  const cleanups: Array<() => void> = [];

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b4ab, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(1.5, 2.5, 4);
  scene.add(sun);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = Math.PI * 0.32;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.minAzimuthAngle = -Math.PI * 0.42;
  controls.maxAzimuthAngle = Math.PI * 0.42;

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  cleanups.push(() => resizeObserver.disconnect());

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  intersection.observe(container);
  cleanups.push(() => intersection.disconnect());

  loadTexture(imageUrl)
    .then((texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const image = texture.image as { width: number; height: number };
      const ratio = Math.min(Math.max(image.width / image.height || 1.5, 0.6), 3);
      build(texture, ratio);
      onReady?.();
    })
    .catch(() => {
      if (!disposed) onError?.();
    });

  function build(texture: THREE.Texture, ratio: number) {
    const width = FLAG_WIDTH;
    const height = width / ratio;
    const sx = SEGMENTS_X;
    const sy = Math.max(8, Math.round(sx / ratio));
    const top = height / 2 + 0.25;
    const count = (sx + 1) * (sy + 1);
    const idx = (x: number, y: number) => y * (sx + 1) + x;

    const pos = new Float32Array(count * 3);
    const prev = new Float32Array(count * 3);
    const pinned = new Uint8Array(count);
    const u = new Float32Array(count);
    const v = new Float32Array(count);
    for (let y = 0; y <= sy; y++) {
      for (let x = 0; x <= sx; x++) {
        const i = idx(x, y);
        u[i] = x / sx;
        v[i] = y / sy;
        // Start slightly curled so the wind has a surface to catch.
        pos[i * 3] = u[i] * width;
        pos[i * 3 + 1] = top - v[i] * height;
        pos[i * 3 + 2] = Math.sin(u[i] * Math.PI * 2) * 0.04 * u[i];
        pinned[i] = x === 0 ? 1 : 0;
      }
    }
    prev.set(pos);

    const constraints: Constraint[] = [];
    const link = (a: number, b: number, stiffness: number) => {
      const dx = pos[a * 3] - pos[b * 3];
      const dy = pos[a * 3 + 1] - pos[b * 3 + 1];
      const dz = pos[a * 3 + 2] - pos[b * 3 + 2];
      constraints.push([a, b, Math.hypot(dx, dy, dz), stiffness]);
    };
    for (let y = 0; y <= sy; y++) {
      for (let x = 0; x <= sx; x++) {
        if (x < sx) link(idx(x, y), idx(x + 1, y), 1);
        if (y < sy) link(idx(x, y), idx(x, y + 1), 1);
        if (x < sx && y < sy) {
          link(idx(x, y), idx(x + 1, y + 1), 0.9);
          link(idx(x + 1, y), idx(x, y + 1), 0.9);
        }
        // Weak bend springs keep folds soft instead of crumpling.
        if (x < sx - 1) link(idx(x, y), idx(x + 2, y), 0.25);
        if (y < sy - 1) link(idx(x, y), idx(x, y + 2), 0.25);
      }
    }

    const geometry = new THREE.PlaneGeometry(width, height, sx, sy);
    const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const normalAttr = () => geometry.getAttribute('normal') as THREE.BufferAttribute;
    const syncGeometry = () => {
      positionAttr.array.set(pos);
      positionAttr.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    };
    syncGeometry();

    const cloth = new THREE.Mesh(
      geometry,
      // alphaTest cuts out transparent areas of shaped flags (Nepal, pennants).
      new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, alphaTest: 0.5 }),
    );
    scene.add(cloth);

    const poleHeight = height + 3.2;
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: 0.55, roughness: 0.35 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, poleHeight, 24), poleMaterial);
    pole.position.set(-0.045, top + 0.1 - poleHeight / 2, 0);
    scene.add(pole);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), poleMaterial);
    finial.position.set(-0.045, top + 0.16, 0);
    scene.add(finial);

    const center = new THREE.Vector3(width * 0.47, top - height * 0.55, 0);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fitDistance = () => {
      const byHeight = (height * 0.5 + 0.8) / Math.tan(fov / 2);
      const byWidth = (width * 0.5 + 0.55) / (Math.tan(fov / 2) * camera.aspect);
      return Math.max(byHeight, byWidth);
    };
    const placeCamera = () => {
      const distance = fitDistance();
      camera.position.set(center.x + distance * 0.18, center.y + distance * 0.04, distance);
      controls.target.copy(center);
      controls.update();
    };
    resize();
    placeCamera();
    const refit = new ResizeObserver(placeCamera);
    refit.observe(container);
    cleanups.push(() => refit.disconnect());

    const force = new THREE.Vector3();
    const windVec = new THREE.Vector3();
    let time = 0;

    const step = (dt: number) => {
      time += dt;
      const gust = 1 + Math.sin(time * 0.7) * 0.25 + Math.sin(time * 1.9 + 1.3) * 0.12;
      const strength = wind * gust;
      windVec.set(1, 0, Math.sin(time * 0.45) * 0.35).normalize().multiplyScalar(9 * strength);
      const normals = normalAttr().array as Float32Array;
      const dt2 = dt * dt;

      for (let i = 0; i < count; i++) {
        if (pinned[i]) continue;
        const nx = normals[i * 3];
        const ny = normals[i * 3 + 1];
        const nz = normals[i * 3 + 2];
        const pressure = nx * windVec.x + ny * windVec.y + nz * windVec.z;
        // Pressure along the normal, a little drag along the wind, and a ripple that
        // travels from hoist to fly and grows towards the free end.
        const ripple = Math.sin((u[i] * 1.7 - time * 1.35) * Math.PI * 2 + v[i] * 1.1) * 3.2 * strength * u[i];
        force
          .set(nx * pressure, ny * pressure, nz * pressure)
          .addScaledVector(windVec, 0.35)
          .add(GRAVITY);
        force.z += ripple;

        const k = i * 3;
        for (let a = 0; a < 3; a++) {
          const current = pos[k + a];
          const velocity = (current - prev[k + a]) * (1 - DAMPING);
          prev[k + a] = current;
          pos[k + a] = current + velocity + force.getComponent(a) * dt2;
        }
      }

      for (let n = 0; n < ITERATIONS; n++) {
        for (const [a, b, rest, stiffness] of constraints) {
          const ka = a * 3;
          const kb = b * 3;
          const dx = pos[kb] - pos[ka];
          const dy = pos[kb + 1] - pos[ka + 1];
          const dz = pos[kb + 2] - pos[ka + 2];
          const distance = Math.hypot(dx, dy, dz) || 1e-6;
          const diff = ((distance - rest) / distance) * 0.5 * stiffness;
          const wa = pinned[a] ? 0 : pinned[b] ? 2 : 1;
          const wb = pinned[b] ? 0 : pinned[a] ? 2 : 1;
          pos[ka] += dx * diff * wa;
          pos[ka + 1] += dy * diff * wa;
          pos[ka + 2] += dz * diff * wa;
          pos[kb] -= dx * diff * wb;
          pos[kb + 1] -= dy * diff * wb;
          pos[kb + 2] -= dz * diff * wb;
        }
      }
    };

    // Let the cloth settle into a natural shape before the first frame.
    for (let i = 0; i < 240; i++) {
      step(STEP);
      if (i % 4 === 0) syncGeometry();
    }
    syncGeometry();

    let last = performance.now();
    let accumulator = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const elapsed = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!visible) return;
      if (!reducedMotion) {
        accumulator += elapsed;
        while (accumulator >= STEP) {
          step(STEP);
          accumulator -= STEP;
        }
        syncGeometry();
      }
      controls.update();
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(loop);

    cleanups.push(() => {
      geometry.dispose();
      (cloth.material as THREE.Material).dispose();
      texture.dispose();
      pole.geometry.dispose();
      finial.geometry.dispose();
      poleMaterial.dispose();
    });
  }

  return {
    setWind(next) {
      wind = next;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanups.forEach((cleanup) => cleanup());
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
