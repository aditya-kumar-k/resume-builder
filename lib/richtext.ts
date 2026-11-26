/**
 * A small, safe reader for the Text section. Plain lines still work; a few HTML tags add formatting:
 * <b>/<strong>, <i>/<em>, <u>, <a href>, <br>, <p>, <div>, <ul>/<ol>/<li>, and <h1>-<h6> (bold block).
 * Everything else is dropped, so nothing typed here can run as code. Links must be http(s) or mailto.
 */
export type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; href?: string };
/** `runs` hold text; a run whose text is "\n" is a line break inside the block. */
export type Block = { bullet: boolean; runs: Run[] };

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });

const BLOCK_TAGS = new Set(["p", "div", "ul", "ol", "section", "article"]);
const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

export function parseRich(src: string): Block[] {
  const clean = src.replace(/\r/g, "").replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  const blocks: Block[] = [];
  let runs: Run[] = [];
  let bullet = false;
  let b = 0, i = 0, u = 0;
  const hrefs: string[] = [];

  const flush = () => {
    while (runs.length && runs[0]!.text === "\n") runs.shift();
    while (runs.length && runs[runs.length - 1]!.text === "\n") runs.pop();
    if (runs.some((r) => r.text.trim())) blocks.push({ bullet, runs });
    runs = [];
    bullet = false;
  };
  const add = (text: string) => {
    const href = hrefs[hrefs.length - 1];
    const r: Run = { text };
    if (b > 0) r.bold = true;
    if (i > 0) r.italic = true;
    if (u > 0) r.underline = true;
    if (href) r.href = href;
    runs.push(r);
  };

  const re = /<(\/?)([a-z][a-z0-9]*)\b([^>]*)>|([^<]+|<)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    if (m[4] !== undefined) {
      const text = decode(m[4]);
      // Whitespace between block tags is layout, not content.
      if (!runs.length && !text.trim()) continue;
      text.split("\n").forEach((part, k) => {
        if (k > 0) runs.push({ text: "\n" });
        if (part) add(part);
      });
      continue;
    }
    const close = m[1] === "/";
    const tag = (m[2] ?? "").toLowerCase();
    if (tag === "b" || tag === "strong") b = Math.max(0, b + (close ? -1 : 1));
    else if (tag === "i" || tag === "em") i = Math.max(0, i + (close ? -1 : 1));
    else if (tag === "u") u = Math.max(0, u + (close ? -1 : 1));
    else if (tag === "a") {
      if (close) hrefs.pop();
      else {
        const v = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[3] ?? "");
        const url = decode((v?.[1] ?? v?.[2] ?? v?.[3] ?? "").trim());
        hrefs.push(/^(https?:\/\/|mailto:)/i.test(url) ? url : "");
      }
    } else if (tag === "br") runs.push({ text: "\n" });
    else if (tag === "li") {
      flush();
      if (!close) bullet = true;
    } else if (HEADINGS.has(tag)) {
      flush();
      b = Math.max(0, b + (close ? -1 : 1));
    } else if (BLOCK_TAGS.has(tag)) flush();
  }
  flush();
  return blocks;
};

/** Long paragraphs may split across pages; short blocks stay whole. */
export const isShortBlock = (blk: Block) => blk.runs.reduce((n, r) => n + r.text.length, 0) <= 400;
