import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const TIMELINE_LIMIT = 7;

const VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

vec2 rotate(vec2 p, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float line(vec2 p, float width) {
  return smoothstep(width, 0.0, abs(p.y));
}

void main() {
  vec2 st = vUv;
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 uv = (st - 0.5) * aspect;

  vec2 r = rotate(uv, -0.6);
  float t = uTime * 0.15;
  float n = noise(uv * 2.6 + t * 0.3);

  vec3 deepBlue = vec3(0.04, 0.17, 0.62);
  vec3 midBlue = vec3(0.08, 0.28, 0.86);
  vec3 ice = vec3(0.86, 0.86, 0.9);
  vec3 red = vec3(0.78, 0.08, 0.16);

  float band = smoothstep(-0.15, 0.15, r.y + 0.15);
  vec3 sky = mix(deepBlue, midBlue, smoothstep(0.0, 1.0, st.y));
  vec3 horizon = mix(ice, red, smoothstep(0.2, 0.9, -r.y));
  vec3 base = mix(horizon, sky, band);

  float trail = line(rotate(uv + vec2(0.12, -0.02), -0.6), 0.004);
  trail += line(rotate(uv + vec2(0.125, -0.03), -0.6), 0.0025);
  vec3 trailColor = mix(ice, vec3(0.98, 0.4, 0.7), 0.5 + 0.5 * sin(t * 2.0));
  base = mix(base, trailColor, trail);

  float jet = smoothstep(0.02, 0.0, length(rotate(uv + vec2(0.18, -0.02), -0.6)) - 0.02);
  base = mix(base, vec3(0.05, 0.08, 0.12), jet);

  base += (n - 0.5) * 0.08;

  gl_FragColor = vec4(base, 1.0);
}
`;

const parseDate = (value) => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};

const parseYear = (value) => {
  const match = value.match(/\\d{4}/);
  if (!match) {
    return Number.NEGATIVE_INFINITY;
  }
  const year = Number(match[0]);
  if (Number.isNaN(year)) {
    return Number.NEGATIVE_INFINITY;
  }
  return new Date(year, 0, 1).getTime();
};

const fetchJson = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }
    return await response.json();
  } catch (error) {
    console.warn("Failed to load", url, error);
    return [];
  }
};

const buildTimeline = (blogs, projects) => {
  const blogItems = blogs.map((item) => ({
    kind: "blog",
    title: item.title,
    meta: item.date || "Draft",
    link: item.slug ? `blog/${item.slug}.html` : item.substack || item.medium,
    sortKey: parseDate(item.date),
  }));

  const projectItems = projects.map((item) => ({
    kind: "project",
    title: item.title,
    meta: `${item.status} - ${item.year}`,
    link: item.link,
    sortKey: parseYear(item.year),
  }));

  return [...blogItems, ...projectItems]
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, TIMELINE_LIMIT);
};

const renderTimeline = (items) => {
  const root = document.querySelector("#timeline");
  if (!root) {
    return;
  }

  root.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "timeline-item";
    empty.textContent = "No updates yet.";
    root.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "timeline-item";
    const wrapper = item.link ? document.createElement("a") : document.createElement("div");
    if (item.link && wrapper instanceof HTMLAnchorElement) {
      wrapper.href = item.link;
    }
    wrapper.innerHTML = `
      <span class="title">${item.title}</span>
      <span class="meta">${item.meta} · ${item.kind}</span>
    `;
    li.appendChild(wrapper);
    root.appendChild(li);
  });
};

const initTimeline = async () => {
  const [blogs, projects] = await Promise.all([fetchJson("blogs.json"), fetchJson("projects.json")]);
  const timeline = buildTimeline(blogs, projects);
  renderTimeline(timeline);
};

const initShader = () => {
  const canvas = document.querySelector("#shader-canvas");
  if (!canvas) {
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const resize = () => {
    const parent = canvas.parentElement;
    const width = parent ? parent.clientWidth : canvas.clientWidth;
    const height = parent ? parent.clientHeight : canvas.clientHeight;
    renderer.setSize(width, height, false);
    uniforms.uResolution.value.set(width, height);
  };

  resize();
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  const animate = () => {
    uniforms.uTime.value = clock.getElapsedTime();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();
};

initTimeline();
initShader();
