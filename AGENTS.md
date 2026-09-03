# AGENTS.md

This file provides guidance for AI coding agents working on this project.

## Project Overview

This is a personal portfolio/website hosted on GitHub Pages at `EthanCui2008.github.io`.

## Tech Stack

- **HTML5** - Static markup (`index.html`)
- **CSS3** - Styling (`styles.css`)
- **JavaScript** - Client-side interactivity (`main.js`)
- **SVG** - Vector graphics and icons (`svg-img/`)

## Project Structure

```
.
├── index.html      # Main entry point
├── styles.css      # Global styles
├── main.js         # JavaScript functionality
├── favicon.ico     # Site favicon
├── keys/           # Mobile-only contact card (see below)
│   ├── index.html
│   ├── keys.js     # Obfuscated payload + device gate
│   ├── encode.mjs  # Regenerates the payload from keys/.env
│   └── .env.example
└── svg-img/        # SVG icons and images
    ├── email-icon.svg
    ├── github-icon.svg
    ├── linkedin-icon.svg
    └── profile_picture.svg
```

## Development Guidelines

### Code Style
- Use semantic HTML elements
- Keep CSS organized with clear section comments
- Write vanilla JavaScript (no frameworks)
- Maintain consistent indentation (2 or 4 spaces)

### Performance
- Optimize images before adding to the repository
- Minimize external dependencies
- Keep the site lightweight for fast loading

### Accessibility
- Include `alt` attributes on images
- Use proper heading hierarchy
- Ensure sufficient color contrast
- Support keyboard navigation

## The /keys/ page

`/keys/` is an unlinked contact card that renders only on coarse-pointer viewports
under 900px (JS gate plus a CSS backstop). Its values live in `keys/.env`, which is
gitignored and therefore never deploys — GitHub Pages is static, so nothing reads it
at runtime. `node keys/encode.mjs` bakes an XOR+base64 copy into `keys/keys.js`
between the `payload:start`/`payload:end` markers.

That encoding is **obfuscation, not encryption**: the key ships with the data, so
anyone using devtools can read it. It keeps values out of plain page source and away
from scrapers. Never hand-edit `PAYLOAD`, and keep real values out of `.env.example`.

## Deployment

This site automatically deploys via GitHub Pages when changes are pushed to the `Main` branch.

## Testing

Open `index.html` in a browser to test locally. For a local server:
```bash
# Python 3
python -m http.server 8000

# Node.js (if npx available)
npx serve
```
