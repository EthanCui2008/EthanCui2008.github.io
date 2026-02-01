const TIMELINE_LIMIT = 7;
const MASTER_PALETTE = [
  "#F7DB96",
  "#DB4F79",
  "#529DCC",
  "#000000",
  "#282828",
  "#AA001E",
  "#E65F00",
  "#FFDD00",
  "#E2E5E8",
  "#62B3C9",
  "#40588C",
  "#3C140A",
  "#78140F",
  "#A00000",
  "#D23C28",
  "#F59632",
  "#F6D4A1",
  "#B4C0CA",
  "#8C9196",
  "#32373C",
];

const normalizeLabel = (value, fallback = "TBD") => {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
};

const formatKind = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const blogState = (dateLabel) => (dateLabel.toLowerCase() === "draft" ? "Draft" : "Published");

const projectState = (statusLabel) => normalizeLabel(statusLabel, "Active");

const normalizeBlogDate = (value) => {
  const label = normalizeLabel(value, "TBD");
  return label.toLowerCase() === "draft" ? "TBD" : label;
};

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

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  if (normalized.length === 3) {
    const r = (bigint >> 8) & 0xf;
    const g = (bigint >> 4) & 0xf;
    const b = bigint & 0xf;
    return [r * 17, g * 17, b * 17];
  }
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
};

const rgbToHex = (r, g, b) =>
  `#${[r, g, b]
    .map((v) => {
      const clamped = Math.max(0, Math.min(255, Math.round(v)));
      return clamped.toString(16).padStart(2, "0");
    })
    .join("")}`;

const lerpColor = (a, b, t) => {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
};

const sampleGradient = (colors, t) => {
  if (!colors.length) return "#000000";
  if (colors.length === 1) return colors[0];
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (colors.length - 1);
  const idx = Math.floor(scaled);
  const localT = scaled - idx;
  const nextIdx = Math.min(idx + 1, colors.length - 1);
  return lerpColor(colors[idx], colors[nextIdx], localT);
};

const hashToUnit = (input) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
};

const windowedSegments = (palette, start, span, segments = 12) => {
  const source = palette && palette.length ? palette : MASTER_PALETTE;
  const clampedSpan = Math.max(0.1, Math.min(1, span));
  const maxStart = 1 - clampedSpan;
  const normalizedStart = Math.max(0, Math.min(maxStart, start));
  const colors = [];
  for (let i = 0; i < segments; i += 1) {
    const t = segments === 1 ? normalizedStart : normalizedStart + (clampedSpan * i) / (segments - 1);
    colors.push(sampleGradient(source, t));
  }
  return colors;
};

const updatePaletteBar = (pathname, blogs, projects) => {
  const bar = document.querySelector("#sidebar-palette");
  if (!bar) return;

  const slugMatch = pathname.match(/\/blog\/(.+)\.html/);
  const slug = slugMatch ? slugMatch[1] : undefined;

  let palette = MASTER_PALETTE;
  let start = 0;
  let span = 1;

  if (slug) {
    const blog = blogs.find((item) => item.slug === slug);
    palette = blog?.palette?.length ? blog.palette : MASTER_PALETTE;
    start = hashToUnit(slug) * 0.5;
    span = 0.32;
  } else if (pathname.startsWith("/blog")) {
    palette = MASTER_PALETTE;
    start = 0.08;
    span = 0.8;
  } else if (pathname.startsWith("/projects")) {
    const key = (projects && projects[0]?.title) || "projects";
    palette = projects && projects[0]?.palette?.length ? projects[0].palette : MASTER_PALETTE;
    start = hashToUnit(key) * 0.5;
    span = 0.42;
  } else {
    palette = MASTER_PALETTE;
    start = 0;
    span = 1;
  }

  const colors = windowedSegments(palette, start, span, 12);
  for (let i = bar.children.length; i < colors.length; i += 1) {
    const cell = document.createElement("div");
    cell.className = "palette-cell";
    bar.appendChild(cell);
  }
  colors.forEach((color, index) => {
    const cell = bar.children[index];
    if (cell) {
      cell.style.backgroundColor = color;
    }
  });
};

const buildTimeline = (blogs, projects) => {
  const blogItems = blogs.map((item) => ({
    kind: "blog",
    title: item.title,
    date: normalizeBlogDate(item.date),
    state: blogState(normalizeLabel(item.date, "TBD")),
    link: item.slug ? `/blog/${item.slug}.html` : item.substack || item.medium,
    sortKey: parseDate(item.date),
  }));

  const projectItems = projects.map((item) => ({
    kind: "project",
    title: item.title,
    date: normalizeLabel(item.year, "TBD"),
    state: projectState(item.status),
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
    const kindLabel = formatKind(item.kind);
    wrapper.innerHTML = `
      <span class="title">${item.title}</span>
      <span class="meta">${item.date} · ${item.state} · ${kindLabel}</span>
    `;
    li.appendChild(wrapper);
    root.appendChild(li);
  });
};

const renderBlogList = (blogs) => {
  const root = document.querySelector("#blog-list");
  if (!root) {
    return;
  }

  root.innerHTML = "";
  if (!blogs.length) {
    const empty = document.createElement("div");
    empty.className = "page-card";
    empty.textContent = "No blog posts yet.";
    root.appendChild(empty);
    return;
  }

  blogs.forEach((item) => {
    const rawDate = normalizeLabel(item.date, "TBD");
    const dateLabel = normalizeBlogDate(rawDate);
    const stateLabel = blogState(rawDate);
    const kindLabel = "Blog";
    const card = document.createElement("article");
    card.className = "page-card";
    const link = item.slug ? `/blog/${item.slug}.html` : item.substack || item.medium;
    const titleMarkup = link
      ? `<a class="page-title-link" href="${link}">${item.title}</a>`
      : `<span class="page-title-link is-muted">${item.title}</span>`;
    const externalLinks = [
      item.substack ? `<a class="page-link" href="${item.substack}" target="_blank" rel="noopener noreferrer">Substack</a>` : "",
      item.medium ? `<a class="page-link" href="${item.medium}" target="_blank" rel="noopener noreferrer">Medium</a>` : "",
    ].filter(Boolean).join("");
    const linksMarkup = externalLinks ? `<div class="blog-links">${externalLinks}</div>` : "";
    card.innerHTML = `
      <div class="page-card-header">
        <h3>${titleMarkup}</h3>
        <span class="page-meta">${dateLabel} · ${stateLabel} · ${kindLabel}</span>
      </div>
      ${linksMarkup}
    `;
    root.appendChild(card);
  });
};

const renderProjectList = (projects) => {
  const root = document.querySelector("#project-list");
  if (!root) {
    return;
  }

  root.innerHTML = "";
  if (!projects.length) {
    const empty = document.createElement("div");
    empty.className = "page-card";
    empty.textContent = "No projects yet.";
    root.appendChild(empty);
    return;
  }

  projects.forEach((item) => {
    const dateLabel = normalizeLabel(item.year, "TBD");
    const stateLabel = projectState(item.status);
    const kindLabel = "Project";
    const card = document.createElement("article");
    card.className = "page-card";
    const link = item.link || "#";
    if (item.link) {
      card.classList.add("is-clickable");
      card.tabIndex = 0;
      const navigate = () => {
        window.location.href = link;
      };
      card.addEventListener("click", navigate);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate();
        }
      });
    }
    const linkMarkup =
      item.link
        ? `<a class="page-link" href="${link}">View project</a>`
        : `<span class="page-link is-muted">Link coming soon</span>`;
    card.innerHTML = `
      <div class="page-card-header">
        <h3>${item.title}</h3>
        <span class="page-meta">${dateLabel} · ${stateLabel} · ${kindLabel}</span>
      </div>
      <p class="page-summary">${item.summary || ""}</p>
      ${linkMarkup}
    `;
    root.appendChild(card);
  });
};

const initData = async () => {
  const [blogs, projects] = await Promise.all([fetchJson("/blogs.json"), fetchJson("/projects.json")]);
  const timeline = buildTimeline(blogs, projects);
  renderTimeline(timeline);
  renderBlogList(blogs);
  renderProjectList(projects);
  return { blogs, projects };
};

const setActiveNav = (section) => {
  document.querySelectorAll(".page-nav-btn").forEach((btn) => {
    const btnSection = btn.dataset.section;
    if (!btnSection) return;
    btn.classList.toggle("is-active", btnSection === section);
  });
};

const sectionFromPath = (pathname) => {
  if (pathname.startsWith("/blog")) return "blog";
  if (pathname.startsWith("/projects")) return "projects";
  return "home";
};

const swapMain = async (url, push = true) => {
  try {
    const res = await fetch(url, { headers: { "X-Requested-With": "spa" } });
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "text/html");
    const newMain = doc.querySelector("main");
    const currentMain = document.querySelector("main");
    if (!newMain || !currentMain) throw new Error("Main container missing");
    currentMain.replaceWith(newMain);
    const pathname = new URL(url, window.location.origin).pathname;
    setActiveNav(sectionFromPath(pathname));
    document.title = doc.title || document.title;
    window.scrollTo(0, 0);
    const { blogs, projects } = await initData();
    updatePaletteBar(pathname, blogs, projects);
    if (push) {
      history.pushState({ url }, "", url);
    }
  } catch (error) {
    console.warn(error);
    window.location.href = url;
  }
};

const setupSpaNav = () => {
  const navLinks = document.querySelectorAll(".page-nav-btn");
  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }
      event.preventDefault();
      const href = link.getAttribute("href");
      if (!href) return;
      swapMain(href, true);
    });
  });

  window.addEventListener("popstate", (event) => {
    const targetUrl = event.state?.url || window.location.href;
    swapMain(targetUrl, false);
  });

  setActiveNav(sectionFromPath(window.location.pathname));
};

setupSpaNav();
initData().then(({ blogs, projects }) => updatePaletteBar(window.location.pathname, blogs, projects));
