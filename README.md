# Resume Builder

A privacy-first resume editor. Edit your sections, watch the live preview, and export a PDF or a Word file. Everything runs in your browser: resumes are saved in `localStorage`, and there is no backend or account.

Built with Next.js, React and TypeScript.

## Features

- Live preview next to the editor
- 3 original templates: **Band**, **Plain** and **Compact**
- Accent colours, 9 font choices and per-section visibility, icons, rules and spacing
- Section types: text, skills (grouped) and entries (title, subtitle, date, link, bullets)
- Clickable links and optional contact icons
- PDF export (real, selectable text) and Word (.docx) export
- Autosave in `localStorage`; older saved resumes keep working after updates

## How it works

One typed data model (`lib/types.ts`) feeds three renderers:

| Output | File |
|---|---|
| On-screen preview (HTML/CSS) | `components/Preview.tsx` |
| PDF | `lib/exportPdf.tsx` (`@react-pdf/renderer`) |
| Word | `lib/exportDocx.ts` (`docx`) |

The Word export uses one simple column for every template. The preview and the PDF are separate layout engines, so check the PDF after changing a template.

## Run locally

    npm install
    npm run dev      # http://localhost:3100

## Deploy

### Cloudflare Pages (static site)

The app is fully client-side, so it can be hosted as a static site.

1. Push the repo to GitHub and connect it in Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**.
2. Production branch: `main`.
3. Build settings:
   - Framework preset: None
   - Build command: `STATIC_EXPORT=1 npm run build`
   - Build output directory: `out`
4. Add the environment variable `NODE_VERSION` = `22`.

Every push to `main` then rebuilds and deploys the site.

### Linux VPS (Docker)

1. Copy the project: `rsync -az --exclude node_modules --exclude .next ./ user@SERVER:/opt/resume-builder/`
2. On the server: `cd /opt/resume-builder && docker compose up -d --build`
3. The app listens on `127.0.0.1:3100`. Put Caddy in front for HTTPS (see `Caddyfile.example`), or open the port in your firewall for a quick test.

The Docker build uses Next.js `standalone` output. Setting `STATIC_EXPORT=1` switches the build to a static `out/` folder instead.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3100 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build on port 3100 |
| `npm run typecheck` | TypeScript check |

## Credits

Icons are from [Lucide](https://lucide.dev) (ISC licence). Fonts come from Fontsource (Inter, Lato, Open Sans, Roboto, Merriweather, Lora). Built with Claude Code.
