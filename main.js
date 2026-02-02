const TIMELINE_LIMIT = 7;
let cachedBlogs = [];
let cachedProjects = [];

const MASTER_PALETTE = [
  "#282828",
  "#AA001E",
  "#E65F00",
  "#FFDD00",
  "#E2E5E8",
  "#62B3C9",
  "#40588C",
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

const windowedSegments = (palette, start, span, segments = 7) => {
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

  const colors = windowedSegments(palette, start, span, 7);
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
    slug: item.slug,
    sortKey: parseDate(item.date),
  }));

  const projectItems = projects.map((item) => ({
    kind: "project",
    title: item.title,
    date: normalizeLabel(item.year, "TBD"),
    state: projectState(item.status),
    slug: item.slug,
    sortKey: parseYear(item.year),
  }));

  return [...blogItems, ...projectItems]
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, TIMELINE_LIMIT);
};

const syncTimelineLine = (root) => {
  root.style.removeProperty("--timeline-line-bottom");

  const lastItem = root.querySelector(".timeline-item:last-child");
  if (!lastItem) {
    return;
  }

  const marker = document.createElement("span");
  marker.setAttribute("aria-hidden", "true");
  marker.style.position = "absolute";
  marker.style.left = "0";
  marker.style.top = "var(--timeline-connector-y)";
  marker.style.width = "1px";
  marker.style.height = "1px";
  marker.style.pointerEvents = "none";
  marker.style.visibility = "hidden";
  lastItem.appendChild(marker);

  const listRect = root.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  marker.remove();

  const bottom = Math.max(0, listRect.bottom - markerRect.top);
  root.style.setProperty("--timeline-line-bottom", `${bottom}px`);
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
    syncTimelineLine(root);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "timeline-item";
    const wrapper = document.createElement("div");
    wrapper.className = "timeline-link";
    wrapper.tabIndex = 0;
    const kindLabel = formatKind(item.kind);
    wrapper.innerHTML = `
      <span class="title">${item.title}</span>
      <span class="meta">${item.date} · ${item.state} · ${kindLabel}</span>
    `;

    const openDetail = () => {
      if (item.kind === "blog") {
        showBlogDetail(item.slug);
      } else if (item.kind === "project") {
        showProjectDetail(item.slug);
      }
    };

    wrapper.addEventListener("click", openDetail);
    wrapper.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetail();
      }
    });

    li.appendChild(wrapper);
    root.appendChild(li);
  });
  syncTimelineLine(root);
};

const formatStatus = (status) => {
  if (!status) return "Active";
  const map = {
    "published": "Published",
    "draft": "Draft",
    "in-progress": "In Progress",
    "completed": "Completed",
    "archived": "Archived",
  };
  return map[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
};

const renderTags = (tags) => {
  if (!tags || !tags.length) return "";
  const tagMarkup = tags.map((tag) => `<span class="tag">${tag}</span>`).join("");
  return `<div class="tags">${tagMarkup}</div>`;
};

const simpleMarkdown = (text) => {
  if (!text) return "";
  return text
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- \[ \] (.+)$/gm, '<li class="task-item"><input type="checkbox" disabled> $1</li>')
    .replace(/^- \[x\] (.+)$/gm, '<li class="task-item"><input type="checkbox" checked disabled> $1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hup]|<li|<ul)(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
};

const showBlogDetail = (slug) => {
  const blog = cachedBlogs.find((b) => b.slug === slug);
  if (!blog) return;

  const main = document.querySelector("main");
  if (!main) return;

  const dateLabel = normalizeBlogDate(blog.date);
  const stateLabel = blog.status ? formatStatus(blog.status) : blogState(blog.date);
  const tagsMarkup = renderTags(blog.tags);
  const contentHtml = simpleMarkdown(blog.content);

  const externalButtons = [
    blog.substack ? `<a class="external-btn" href="${blog.substack}" target="_blank" rel="noopener noreferrer">Substack</a>` : "",
    blog.medium ? `<a class="external-btn" href="${blog.medium}" target="_blank" rel="noopener noreferrer">Medium</a>` : "",
  ].filter(Boolean).join("");

  main.innerHTML = `
    <div class="page page-blog-post">
      <button class="back-btn" data-back="blog">&larr; Back to Blog</button>
      <h1 class="blog-post-title">${blog.title}</h1>
      <span class="blog-post-meta">${dateLabel} · ${stateLabel}</span>
      ${tagsMarkup}
      ${externalButtons ? `<div class="external-buttons">${externalButtons}</div>` : ""}
      <div class="page-body">${contentHtml}</div>
    </div>
  `;

  main.querySelector(".back-btn").addEventListener("click", () => {
    swapMain("/blogs.html", true);
  });

  history.pushState({ type: "blog", slug }, "", `/blog/${slug}`);
  window.scrollTo(0, 0);
  updatePaletteBar(`/blog/${slug}`, cachedBlogs, cachedProjects);
};

const showProjectDetail = (slug) => {
  const project = cachedProjects.find((p) => p.slug === slug);
  if (!project) return;

  const main = document.querySelector("main");
  if (!main) return;

  const dateLabel = normalizeLabel(project.year, "TBD");
  const stateLabel = formatStatus(project.status);
  const tagsMarkup = renderTags(project.tags);
  const contentHtml = simpleMarkdown(project.content);

  const githubButton = project.link
    ? `<a class="external-btn" href="${project.link}" target="_blank" rel="noopener noreferrer">GitHub</a>`
    : "";

  main.innerHTML = `
    <div class="page page-project-detail">
      <div class="detail-header-row">
        <button class="back-btn" data-back="projects">&larr; Back to Projects</button>
        ${githubButton ? `<div class="external-buttons">${githubButton}</div>` : ""}
      </div>
      <h1 class="project-detail-title">${project.title}</h1>
      <span class="project-detail-meta">${dateLabel} · ${stateLabel}</span>
      ${tagsMarkup}
      <div class="page-body">${contentHtml}</div>
    </div>
  `;

  main.querySelector(".back-btn").addEventListener("click", () => {
    swapMain("/projects.html", true);
  });

  history.pushState({ type: "project", slug }, "", `/project/${slug}`);
  window.scrollTo(0, 0);
  updatePaletteBar(`/projects/${slug}`, cachedBlogs, cachedProjects);
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
    const stateLabel = item.status ? formatStatus(item.status) : blogState(rawDate);
    const kindLabel = "Blog";
    const card = document.createElement("article");
    card.className = "page-card is-clickable";
    card.tabIndex = 0;

    const externalButtons = [
      item.substack ? `<a class="external-btn external-btn-small" href="${item.substack}" target="_blank" rel="noopener noreferrer">Substack</a>` : "",
      item.medium ? `<a class="external-btn external-btn-small" href="${item.medium}" target="_blank" rel="noopener noreferrer">Medium</a>` : "",
    ].filter(Boolean).join("");
    const buttonsMarkup = externalButtons ? `<div class="external-buttons">${externalButtons}</div>` : "";
    const tagsMarkup = renderTags(item.tags);
    const summaryMarkup = item.summary ? `<p class="page-summary">${item.summary}</p>` : "";

    card.innerHTML = `
      <div class="page-card-header">
        <h3>${item.title}</h3>
        <span class="page-meta">${dateLabel} · ${stateLabel} · ${kindLabel}</span>
      </div>
      ${summaryMarkup}
      ${tagsMarkup}
      ${buttonsMarkup}
    `;

    const openDetail = (e) => {
      if (e.target.closest(".external-btn")) return;
      showBlogDetail(item.slug);
    };

    card.addEventListener("click", openDetail);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetail(e);
      }
    });

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
    const stateLabel = formatStatus(item.status);
    const kindLabel = "Project";
    const card = document.createElement("article");
    card.className = "page-card is-clickable";
    card.tabIndex = 0;

    const githubButton = item.link
      ? `<a class="external-btn external-btn-small" href="${item.link}" target="_blank" rel="noopener noreferrer">GitHub</a>`
      : "";
    const buttonsMarkup = githubButton ? `<div class="external-buttons">${githubButton}</div>` : "";
    const tagsMarkup = renderTags(item.tags);

    card.innerHTML = `
      <div class="page-card-header">
        <h3>${item.title}</h3>
        <span class="page-meta">${dateLabel} · ${stateLabel} · ${kindLabel}</span>
      </div>
      <p class="page-summary">${item.summary || ""}</p>
      ${tagsMarkup}
      ${buttonsMarkup}
    `;

    const openDetail = (e) => {
      if (e.target.closest(".external-btn")) return;
      showProjectDetail(item.slug);
    };

    card.addEventListener("click", openDetail);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetail(e);
      }
    });

    root.appendChild(card);
  });
};

const initData = async () => {
  const contents = await fetchJson("/contents.json");
  const blogs = contents.blogs || [];
  const projects = contents.projects || [];
  cachedBlogs = blogs;
  cachedProjects = projects;
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
