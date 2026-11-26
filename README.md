# Resume Builder

Live editor, 3 original templates (Plain, Sidebar, Compact), PDF + Word export. Everything runs in the browser; resumes are saved in localStorage.

## Run locally
    npm install
    npm run dev      # http://localhost:3100

## Deploy to a Linux VPS (Docker)
1. Copy the project: `rsync -az --exclude node_modules --exclude .next ./ user@SERVER:/opt/resume-builder/`
2. On the server: `cd /opt/resume-builder && docker compose up -d --build`
3. The app listens on 127.0.0.1:3100. Put Caddy in front for HTTPS (see Caddyfile.example), or open the port in your firewall for a quick test.
