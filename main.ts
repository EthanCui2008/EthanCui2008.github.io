import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

type BlogItem = {
  title: string;
  date: string;
  slug?: string;
  substack?: string;
  medium?: string;
};

type ProjectItem = {
  title: string;
  status: string;
  year: string;
  summary: string;
  link?: string;
};

type TimelineItem = {
  kind: "blog" | "project";
  title: string;
  meta: string;
  link?: string;
  sortKey: number;
};

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

void main() {
  vec2 st = vUv;
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 uv = (st - 0.5) * aspect;
  float t = uTime * 0.12;

  float n = noise(uv * 2.8 + t);
  float waves = sin((uv.x + uv.y) * 5.0 + uTime * 0.6) * 0.2;
  float glow = smoothstep(0.7, 0.0, length(uv));

  vec3 base = mix(vec3(0.07, 0.1, 0.16), vec3(0.92, 0.58, 0.28), n);
  base += vec3(0.08, 0.2, 0.22) * waves;
  base += vec3(0.12, 0.16, 0.2) * glow;

  gl_FragColor = vec4(base, 1.0);
}
`;

const parseDate = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};

const parseYear = (value: string): number => {
  const match = value.match(/\d{4}/);
  if (!match) {
    return Number.NEGATIVE_INFINITY;
  }
  const year = Number(match[0]);
  if (Number.isNaN(year)) {
    return Number.NEGATIVE_INFINITY;
  }
  return new Date(year, 0, 1).getTime();
};

const fetchJson = async <T>(url: string): Promise<T[]> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as T[];
  } catch (error) {
    console.warn("Failed to load", url, error);
    return [];
  }
};

const buildTimeline = (blogs: BlogItem[], projects: ProjectItem[]): TimelineItem[] => {
  const blogItems: TimelineItem[] = blogs.map((item) => ({
    kind: "blog",
    title: item.title,
    meta: item.date || "Draft",
    link: item.slug ? `blog/${item.slug}.html` : item.substack || item.medium,
    sortKey: parseDate(item.date),
  }));

  const projectItems: TimelineItem[] = projects.map((item) => ({
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

const renderTimeline = (items: TimelineItem[]): void => {
  const root = document.querySelector<HTMLUListElement>("#timeline");
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
    if (item.link) {
      (wrapper as HTMLAnchorElement).href = item.link;
    }
    wrapper.innerHTML = `
      <span class="kind">${item.kind}</span>
      <span class="title">${item.title}</span>
      <span class="meta">${item.meta}</span>
    `;
    li.appendChild(wrapper);
    root.appendChild(li);
  });
};

const initTimeline = async (): Promise<void> => {
  const [blogs, projects] = await Promise.all([
    fetchJson<BlogItem>("blogs.json"),
    fetchJson<ProjectItem>("projects.json"),
  ]);

  const timeline = buildTimeline(blogs, projects);
  renderTimeline(timeline);
};

const initShader = (): void => {
  const canvas = document.querySelector<HTMLCanvasElement>("#shader-canvas");
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
