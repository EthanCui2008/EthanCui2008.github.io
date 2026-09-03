/*
 * /keys/ — mobile-only contact card.
 *
 * The values below are obfuscated (XOR + base64), NOT encrypted: the key ships
 * with the payload, so anyone who opens devtools can read them. This only keeps
 * the strings out of plain page source, away from scrapers and search indexes.
 *
 * Do not hand-edit PAYLOAD. Put the real values in keys/.env (gitignored) and
 * run `node keys/encode.mjs` to regenerate the block between the markers.
 */

/* payload:start */
const PAYLOAD = {
  v: 1,
  k: "ukucwo4QdrXA8EPH23lTPQfEhzaMi4O7",
  d: {
    name: "MB8dAhlPdyQN",
    phone: "XlpVS0JaAXhEQmlxFXVhcQo=",
    room: "MwQaFx8GWD1EJzYoTGVoDB4TKjg/PhRlWg==",
  },
};
/* payload:end */

const MOBILE_QUERY = "(pointer: coarse) and (max-width: 900px)";

const PALETTE = [
  "#282828",
  "#AA001E",
  "#E65F00",
  "#FFDD00",
  "#E2E5E8",
  "#62B3C9",
  "#40588C",
];

const decode = (encoded, key) => {
  if (!encoded) return "";
  const binary = atob(encoded);
  const keyBytes = new TextEncoder().encode(key);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i) ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(bytes);
};

const renderPalette = () => {
  const bar = document.querySelector("#keys-palette");
  if (!bar) return;
  PALETTE.forEach((color) => {
    const cell = document.createElement("div");
    cell.className = "palette-cell";
    cell.style.backgroundColor = color;
    bar.appendChild(cell);
  });
};

const applyDevice = () => {
  const device = window.matchMedia(MOBILE_QUERY).matches ? "mobile" : "desktop";
  document.body.dataset.device = device;
  document.querySelectorAll("[data-device-only]").forEach((el) => {
    el.hidden = el.dataset.deviceOnly !== device;
  });
};

const setField = (field, value) => {
  const el = document.querySelector(`[data-field="${field}"]`);
  if (!el || !value) return;
  if (field === "phone") {
    const link = document.createElement("a");
    link.href = `tel:${value.replace(/[^\d+]/g, "")}`;
    link.textContent = value;
    el.replaceChildren(link);
    return;
  }
  el.textContent = value;
};

const fillFields = () => {
  Object.entries(PAYLOAD.d).forEach(([field, encoded]) => {
    setField(field, decode(encoded, PAYLOAD.k));
  });
};

const setupMobileWatch = () => {
  const mql = window.matchMedia(MOBILE_QUERY);
  const handler = () => applyDevice();
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", handler);
  } else {
    mql.addListener(handler);
  }
};

renderPalette();
applyDevice();
setupMobileWatch();
fillFields();
