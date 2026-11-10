import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  cometPosition,
  orbitPoint,
  planets,
  planetElements,
  planetPosition,
} from "./science.mjs";

const vector = (a) => new THREE.Vector3(...a);
const green = "#9acbdf";

function surfaceNoise(x, y, z) {
  const cell = [Math.floor(x), Math.floor(y), Math.floor(z)];
  const f = [x - cell[0], y - cell[1], z - cell[2]].map(
    (v) => v * v * (3 - 2 * v),
  );
  const hash = (a, b, c) => {
    const value = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
    return value - Math.floor(value);
  };
  let value = 0;
  for (let dx = 0; dx < 2; dx++)
    for (let dy = 0; dy < 2; dy++)
      for (let dz = 0; dz < 2; dz++) {
        value +=
          hash(cell[0] + dx, cell[1] + dy, cell[2] + dz) *
          (dx ? f[0] : 1 - f[0]) *
          (dy ? f[1] : 1 - f[1]) *
          (dz ? f[2] : 1 - f[2]);
      }
  return value - 0.5;
}

export class Observatory {
  constructor(host, onFailure) {
    this.host = host;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 2000);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D space view. Drag to orbit and scroll to zoom. Camera buttons and object details provide keyboard alternatives.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    host.appendChild(this.renderer.domElement);
    this.lost = (event) => {
      event.preventDefault();
      onFailure();
    };
    this.renderer.domElement.addEventListener("webglcontextlost", this.lost);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 160;
    this.controls.addEventListener("change", this.requestRender);
    this.labels = [];
    this.objects = new THREE.Group();
    this.scene.add(this.objects);
    this.scene.add(new THREE.AmbientLight(0x99abc5, 2));
    const light = new THREE.DirectionalLight(0xffe2b4, 4);
    light.position.set(-4, 5, 4);
    this.scene.add(light);
    const rim = new THREE.DirectionalLight(0x88bbc9, 3);
    rim.position.set(4, -2, -3);
    this.scene.add(rim);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
  }

  requestRender = () => {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderer.render(this.scene, this.camera);
      for (const label of this.labels) {
        const pos = label.object
          .getWorldPosition(new THREE.Vector3())
          .project(this.camera);
        label.element.style.transform = `translate(${((pos.x + 1) * this.width) / 2}px,${((1 - pos.y) * this.height) / 2}px)`;
        label.element.hidden =
          !this.showLabels ||
          pos.z > 1 ||
          Math.abs(pos.x) > 0.94 ||
          Math.abs(pos.y) > 0.88;
      }
    });
  };

  resize() {
    this.width = this.host.clientWidth;
    this.height = this.host.clientHeight;
    this.camera.aspect = this.width / Math.max(1, this.height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.requestRender();
  }

  clear() {
    this.objects.traverse((obj) => {
      obj.geometry?.dispose();
      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];
      materials.forEach((mat) => {
        mat?.map?.dispose();
        mat?.dispose();
      });
    });
    this.objects.clear();
    this.labels.forEach((l) => l.element.remove());
    this.labels = [];
  }

  label(text, object, accent = false) {
    const element = document.createElement("span");
    element.className = `space-label ${accent ? "accent" : ""}`;
    element.textContent = text;
    element.setAttribute("aria-hidden", "true");
    this.host.appendChild(element);
    this.labels.push({ object, element });
  }

  line(elements, color, opacity = 0.25) {
    const pts = Array.from({ length: 361 }, (_, i) =>
      vector(orbitPoint(elements, (i / 360) * Math.PI * 2)),
    );
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
    this.objects.add(line);
    return line;
  }

  glow(color, size) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.07, color);
    gradient.addColorStop(0.2, `${color}aa`);
    gradient.addColorStop(0.5, `${color}20`);
    gradient.addColorStop(1, `${color}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sprite.scale.set(size, size, 1);
    this.objects.add(sprite);
    return sprite;
  }

  setComet(comet, ms, mode = "orbit") {
    this.clear();
    this.comet = comet;
    this.mode = mode;
    this.ms = ms;
    if (mode === "portrait") {
      this.buildPortrait();
      this.reset();
      return;
    }
    if (mode === "nucleus") {
      this.buildNucleus();
      this.reset();
      return;
    }
    this.extent = Math.max(6.5, comet.elements.a * (1 + comet.elements.e));
    this.sun = this.glow("#f7ba6b", this.extent * 0.13);
    this.label("Sun", this.sun);
    this.planetMeshes = [];
    const visiblePlanets = planets.filter(
      (p) => p.values[0] < this.extent * 1.15,
    );
    visiblePlanets.forEach((p) => {
      this.line(
        planetElements(p, ms),
        p.name === "Earth" ? "#88b9dd" : "#b0c4ba",
        p.name === "Earth" ? 0.33 : 0.15,
      );
      const radius =
        this.extent *
        (p.name === "Jupiter" ? 0.009 : p.name === "Earth" ? 0.006 : 0.0045);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 24, 16),
        new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.9 }),
      );
      this.objects.add(mesh);
      this.planetMeshes.push({ planet: p, mesh });
      if (p.name === "Earth" || p.name === "Jupiter" || p.values[0] > 5)
        this.label(p.name, mesh);
    });
    this.line(comet.elements, green, 0.8);
    const faintOrbit = this.line(comet.elements, green, 0.055);
    faintOrbit.scale.setScalar(1.004);
    this.marker = this.glow("#9acbff", this.extent * 0.075);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(this.extent * 0.005, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xe1f1ff }),
    );
    this.marker.add(core);
    this.label(comet.id, this.marker, true);
    const perihelion = new THREE.Mesh(
      new THREE.RingGeometry(this.extent * 0.009, this.extent * 0.012, 32),
      new THREE.MeshBasicMaterial({
        color: green,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      }),
    );
    perihelion.position.copy(vector(orbitPoint(comet.elements, 0)));
    perihelion.rotation.x = -Math.PI / 2;
    this.objects.add(perihelion);
    this.updateTime(ms);
    this.reset();
  }

  buildNucleus() {
    this.extent = 3.5;
    const body = new THREE.Group();
    this.objects.add(body);
    const material = new THREE.MeshStandardMaterial({
      color: "#726c65",
      roughness: 1,
      flatShading: true,
    });
    const lobe = (radius, position, scale, seed) => {
      const geo = new THREE.IcosahedronGeometry(radius, 24),
        positions = geo.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
          y = positions.getY(i),
          z = positions.getZ(i);
        const roughness =
          1 +
          0.32 * surfaceNoise(x * 3 + seed, y * 3, z * 3) +
          0.11 * surfaceNoise(x * 9, y * 9 + seed, z * 9) +
          0.045 * surfaceNoise(x * 24, y * 24, z * 24 + seed);
        positions.setXYZ(i, x * roughness, y * roughness, z * roughness);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, material.clone());
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      body.add(mesh);
    };
    if (this.comet.id === "67P") {
      lobe(1.15, [-0.65, -0.2, 0], [1.3, 1, 0.8], 1);
      lobe(0.8, [0.9, 0.65, 0], [1.05, 0.95, 0.85], 2);
      lobe(0.6, [0.35, 0.22, 0], [1, 1, 0.75], 3);
    } else if (this.comet.id === "1P") lobe(1.2, [0, 0, 0], [1.8, 0.9, 0.8], 4);
    else lobe(1.2, [0, 0, 0], [1.2, 1, 0.9], 5);
    material.dispose();
    body.rotation.set(0.3, -0.45, -0.18);
    this.nucleus = body;
    if (this.mode === "portrait") return;
    const guide = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from(
          { length: 128 },
          (_, i) =>
            new THREE.Vector3(
              Math.cos((i / 128) * Math.PI * 2) * 3.1,
              -1.8,
              Math.sin((i / 128) * Math.PI * 2) * 3.1,
            ),
        ),
      ),
      new THREE.LineBasicMaterial({
        color: green,
        transparent: true,
        opacity: 0.15,
      }),
    );
    this.objects.add(guide);
  }

  buildPortrait() {
    this.buildNucleus();
    this.nucleus.scale.setScalar(0.72);
    this.nucleus.rotation.z = -0.6;
    const tail = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 9),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `
          varying vec2 vUv;
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
          void main(){
            float x=vUv.x,y=vUv.y-.5;
            float fade=pow(1.-x,1.7)*smoothstep(0.,.025,x);
            float texture=.65+.22*noise(vec2(x*32.,y*70.))+.13*noise(vec2(x*70.,y*200.));
            float ionWidth=.025+x*.12;
            float ion=exp(-pow((y-.045*x)/ionWidth,2.)*1.5)*fade;
            float dustWidth=.045+x*.22;
            float dust=exp(-pow((y+.2*x*x)/dustWidth,2.)*2.)*fade;
            float rays=.65+.35*noise(vec2(y*150./(.3+x),x*5.));
            vec3 color=vec3(.29,.61,1.)*ion*.75+vec3(1.,.77,.46)*dust*.57;
            float alpha=max(ion,dust)*texture*rays;
            gl_FragColor=vec4(color,alpha*.85);
          }`,
      }),
    );
    tail.geometry.translate(10, 0, 0);
    tail.position.set(0.1, 0, -0.7);
    tail.rotation.z = 0.38;
    this.objects.add(tail);
    const coma = this.glow("#99d7ff", 6);
    coma.position.set(0, 0, -0.5);
    coma.material.opacity = 0.36;
    const halo = this.glow("#f8d8a0", 2.1);
    halo.position.set(-0.12, -0.1, -0.35);
    halo.material.opacity = 0.4;
    const positions = [];
    for (let n = 0; n < 1200; n++) {
      const rand = (k) => {
        const value = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453;
        return value - Math.floor(value);
      };
      positions.push(
        (rand(1) - 0.5) * 95,
        (rand(2) - 0.5) * 57,
        -12 - rand(3) * 35,
      );
    }
    console.assert(
      positions.every(Number.isFinite),
      "Star positions must remain finite.",
    );
    const stars = new THREE.BufferGeometry();
    stars.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    this.objects.add(
      new THREE.Points(
        stars,
        new THREE.PointsMaterial({
          color: 0xb4cce2,
          size: 0.035,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        }),
      ),
    );
    this.extent = 14;
  }

  updateTime(ms) {
    this.ms = ms;
    if (this.mode === "orbit") {
      this.marker.position.copy(vector(cometPosition(this.comet, ms)));
      this.planetMeshes.forEach(({ planet, mesh }) =>
        mesh.position.copy(vector(planetPosition(planet, ms))),
      );
    }
    this.requestRender();
  }

  reset(top = false) {
    const extent = this.extent || 6;
    if (this.mode === "portrait") {
      this.camera.position.set(0.5, 0.3, 18);
      this.controls.target.set(0.5, 0.3, 0);
      this.controls.enableZoom = false;
      this.renderer.domElement.style.touchAction = "pan-y";
      this.controls.minDistance = 10;
      this.controls.maxDistance = 40;
    } else if (this.mode === "nucleus") {
      this.camera.position.set(0, top ? 8.5 : 1.6, top ? 0.01 : 8.5);
      this.controls.target.set(0, 0, 0);
    } else {
      const center = vector(orbitPoint(this.comet.elements, 0))
        .add(vector(orbitPoint(this.comet.elements, Math.PI)))
        .multiplyScalar(0.32);
      this.controls.target.copy(center);
      this.camera.position
        .copy(center)
        .add(
          top
            ? new THREE.Vector3(0.001, extent * 2.2, 0.001)
            : new THREE.Vector3(extent * 0.85, extent * 1.45, extent * 1.65),
        );
    }
    this.controls.update();
    this.requestRender();
  }

  setLabels(show) {
    this.showLabels = show;
    this.requestRender();
  }
  zoom(factor) {
    this.camera.position
      .sub(this.controls.target)
      .multiplyScalar(factor)
      .clampLength(this.controls.minDistance, this.controls.maxDistance)
      .add(this.controls.target);
    this.controls.update();
    this.requestRender();
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.clear();
    this.renderer.domElement.removeEventListener("webglcontextlost", this.lost);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
