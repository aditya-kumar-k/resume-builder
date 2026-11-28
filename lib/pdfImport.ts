import type { Resume, Section, Item, SkillGroup, Link } from "./types";
import { defaultResume } from "./default";
import { uid } from "./templates";

export type TextItem = {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Line = {
  y: number;
  text: string;
  items: TextItem[];
};

export type HeaderDraft = {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  links: Link[];
};

export type MappedSectionDraft = {
  id: string;
  title: string;
  type: "entries" | "skills" | "text" | "skip";
  lines: string[];
};

export type ParseDraft = {
  header: HeaderDraft;
  sections: MappedSectionDraft[];
};

const KNOWN_HEADING_KEYWORDS: { type: "text" | "skills" | "entries"; defaultTitle: string; keywords: string[] }[] = [
  { type: "text", defaultTitle: "Summary", keywords: ["summary", "profile", "about me", "objective", "about"] },
  { type: "skills", defaultTitle: "Skills", keywords: ["skills", "technical skills", "competencies", "technologies", "expertise", "tools"] },
  { type: "entries", defaultTitle: "Experience", keywords: ["experience", "employment", "work history", "career", "professional experience"] },
  { type: "entries", defaultTitle: "Education", keywords: ["education", "academic", "qualifications", "academics"] },
  { type: "entries", defaultTitle: "Projects", keywords: ["projects", "project work", "portfolio", "key projects"] },
  { type: "entries", defaultTitle: "Certifications", keywords: ["certifications", "licenses", "certificates"] },
  { type: "entries", defaultTitle: "Industrial Training", keywords: ["training", "internship", "internships"] },
  { type: "text", defaultTitle: "Awards & Recognition", keywords: ["awards", "honors", "achievements", "recognition"] },
  { type: "text", defaultTitle: "Leadership & Volunteering", keywords: ["leadership", "volunteering", "extracurricular"] },
];

/** Checks if a short string looks like a section header */
function detectSectionHeader(rawText: string): { type: "text" | "skills" | "entries"; title: string } | null {
  const clean = rawText.replace(/[:|_\-–—]+$/, "").trim();
  if (!clean || clean.length > 50) return null;

  const lower = clean.toLowerCase();

  for (const group of KNOWN_HEADING_KEYWORDS) {
    for (const kw of group.keywords) {
      const regex = new RegExp(`(^|\\b)${kw}(\\b|$)`, "i");
      if (regex.test(lower)) {
        return {
          type: group.type,
          title: clean.toUpperCase() === clean ? clean : group.defaultTitle,
        };
      }
    }
  }

  // Fallback: If it's 2-4 words in all uppercase and doesn't contain contact/code punctuation
  if (/^[A-Z0-9\s&/–-]{3,40}$/.test(clean) && !/[@.,:()$]/.test(clean) && !clean.includes("HTTP")) {
    return {
      type: "entries",
      title: clean,
    };
  }

  return null;
}

const DATE_REGEX = /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(?:\d{4}|\d{2}\/\d{4})\s*(?:[-–—to]+\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(?:\d{4}|\d{2}\/\d{4})|present|current|now))?\b/i;

/** Extracts structured text lines from PDF using PDF.js */
export async function extractPdfLines(arrayBuffer: ArrayBuffer): Promise<Line[]> {
  // @ts-ignore
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const rawLines: Line[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items: TextItem[] = [];

    for (const item of content.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      const tx = item.transform[4];
      const ty = item.transform[5];
      items.push({
        str: item.str,
        x: tx,
        y: ty,
        w: item.width || 0,
        h: item.height || 0,
      });
    }

    // Sort items top-to-bottom (ty descending), then left-to-right (tx ascending)
    items.sort((a, b) => (Math.abs(b.y - a.y) > 3.2 ? b.y - a.y : a.x - b.x));

    // Group items into lines
    let currentLine: TextItem[] = [];
    let currentY: number | null = null;

    for (const it of items) {
      if (currentY === null || Math.abs(currentY - it.y) <= 3.2) {
        currentLine.push(it);
        if (currentY === null) currentY = it.y;
      } else {
        if (currentLine.length) {
          currentLine.sort((a, b) => a.x - b.x);
          const text = currentLine.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
          if (text) rawLines.push({ y: currentY, text, items: currentLine });
        }
        currentLine = [it];
        currentY = it.y;
      }
    }

    if (currentLine.length) {
      currentLine.sort((a, b) => a.x - b.x);
      const text = currentLine.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
      if (text) rawLines.push({ y: currentY || 0, text, items: currentLine });
    }
  }

  // Pre-process lines: split any embedded uppercase section headings
  // e.g. "Claude Code BLOCKCHAIN & AI PROJECTS Axionova Cryptocurrency"
  const processedLines: Line[] = [];
  const inlineHeadingRegex = /\s+([A-Z0-9\s&/–-]{3,35}\s+(?:PROJECTS|EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|TRAINING|AWARDS))\s+/;

  for (const l of rawLines) {
    const match = l.text.match(inlineHeadingRegex);
    if (match && match.index !== undefined && match.index > 0) {
      const before = l.text.slice(0, match.index).trim();
      const heading = match[1].trim();
      const after = l.text.slice(match.index + match[0].length).trim();

      if (before) processedLines.push({ y: l.y, text: before, items: l.items });
      processedLines.push({ y: l.y - 1, text: heading, items: [] });
      if (after) processedLines.push({ y: l.y - 2, text: after, items: [] });
    } else {
      processedLines.push(l);
    }
  }

  return processedLines;
}

/** Parses raw PDF lines into an editable Draft with detected sections */
export function parseDraftFromLines(lines: Line[]): ParseDraft {
  const header: HeaderDraft = {
    name: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    links: [],
  };

  if (!lines.length) return { header, sections: [] };

  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/;
  const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub)\/([a-zA-Z0-9_-]+)/i;
  const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i;

  // 1. Identify section boundary indices
  type SectionMarker = {
    lineIndex: number;
    title: string;
    type: "text" | "skills" | "entries";
  };

  const markers: SectionMarker[] = [];

  for (let i = 0; i < lines.length; i++) {
    const detected = detectSectionHeader(lines[i].text);
    if (detected) {
      markers.push({
        lineIndex: i,
        title: detected.title,
        type: detected.type,
      });
    }
  }

  // 2. Parse Header
  const firstSectionIdx = markers.length ? markers[0].lineIndex : Math.min(lines.length, 6);
  const headerLines = lines.slice(0, firstSectionIdx);

  if (headerLines.length > 0) {
    header.name = headerLines[0].text.trim();
  }

  for (let i = 1; i < headerLines.length; i++) {
    const text = headerLines[i].text;

    // Email
    const em = text.match(emailRegex);
    if (em && !header.email) header.email = em[0];

    // Phone
    const ph = text.match(phoneRegex);
    if (ph && !header.phone && ph[0].replace(/\D/g, "").length >= 7) header.phone = ph[0].trim();

    // LinkedIn
    const li = text.match(linkedinRegex);
    if (li) {
      const url = li[0].startsWith("http") ? li[0] : `https://${li[0]}`;
      if (!header.links.some((l) => l.label.toLowerCase() === "linkedin")) {
        header.links.push({ id: uid(), label: "LinkedIn", url });
      }
    }

    // GitHub
    const gh = text.match(githubRegex);
    if (gh) {
      const url = gh[0].startsWith("http") ? gh[0] : `https://${gh[0]}`;
      if (!header.links.some((l) => l.label.toLowerCase() === "github")) {
        header.links.push({ id: uid(), label: "GitHub", url });
      }
    }

    // Title / Occupation
    if (i === 1 && !em && !ph && !li && !gh && text.length < 60) {
      header.title = text.trim();
    }

    // Location
    if (!header.location) {
      const locMatch = text.match(/\b([A-Za-z\s]+,\s*[A-Za-z\s]+)\b/);
      if (locMatch && !locMatch[0].includes("@") && !locMatch[0].includes(".com")) {
        header.location = locMatch[0].trim();
      }
    }
  }

  // 3. Collect Section Drafts
  const sections: MappedSectionDraft[] = [];

  for (let s = 0; s < markers.length; s++) {
    const cur = markers[s];
    const nextStart = s + 1 < markers.length ? markers[s + 1].lineIndex : lines.length;
    const bodyLines = lines.slice(cur.lineIndex + 1, nextStart).map((l) => l.text);

    if (bodyLines.length > 0) {
      sections.push({
        id: uid(),
        title: cur.title,
        type: cur.type,
        lines: bodyLines,
      });
    }
  }

  // If no sections were detected, put remaining lines into a single text section
  if (!sections.length && lines.length > firstSectionIdx) {
    sections.push({
      id: uid(),
      title: "Content",
      type: "text",
      lines: lines.slice(firstSectionIdx).map((l) => l.text),
    });
  }

  return { header, sections };
}

/** Compiles a user-reviewed ParseDraft into a valid Resume object */
export function compileResumeFromDraft(draft: ParseDraft, baseResume: Resume = defaultResume): Resume {
  const result: Resume = JSON.parse(JSON.stringify(baseResume));
  result.name = draft.header.name || result.name;
  result.title = draft.header.title || result.title;
  result.email = draft.header.email || result.email;
  result.phone = draft.header.phone || result.phone;
  result.location = draft.header.location || result.location;
  if (draft.header.links && draft.header.links.length) {
    result.links = draft.header.links;
  }
  result.sections = [];

  for (const sec of draft.sections) {
    if (sec.type === "skip" || !sec.lines.length) continue;

    if (sec.type === "text") {
      result.sections.push({
        id: uid(),
        type: "text",
        title: sec.title,
        visible: true,
        body: sec.lines.join("\n"),
      });
    } else if (sec.type === "skills") {
      const groups: SkillGroup[] = [];
      let currentLabel = "Skills";
      let currentItems: string[] = [];

      for (const line of sec.lines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0 && colonIdx < 35) {
          if (currentItems.length) {
            groups.push({
              id: uid(),
              label: currentLabel,
              items: currentItems.join(" "),
            });
            currentItems = [];
          }
          currentLabel = line.slice(0, colonIdx).trim();
          const rest = line.slice(colonIdx + 1).trim();
          if (rest) currentItems.push(rest);
        } else {
          currentItems.push(line.trim());
        }
      }

      if (currentItems.length || groups.length === 0) {
        groups.push({
          id: uid(),
          label: currentLabel,
          items: currentItems.join(" "),
        });
      }

      result.sections.push({
        id: uid(),
        type: "skills",
        title: sec.title,
        visible: true,
        groups,
      });
    } else if (sec.type === "entries") {
      const items: Item[] = [];
      let currentItem: Item | null = null;

      for (let i = 0; i < sec.lines.length; i++) {
        const trimmed = sec.lines[i].trim();
        const isBullet = /^[•\-*•‣▪]\s*/.test(trimmed);
        const dateMatch = trimmed.match(DATE_REGEX);

        if (!isBullet && (dateMatch || (currentItem === null && trimmed.length > 0))) {
          if (currentItem) {
            items.push(currentItem);
          }

          let date = "";
          let title = trimmed;

          if (dateMatch) {
            date = dateMatch[0].trim();
            title = trimmed.replace(dateMatch[0], "").replace(/[\s|,\-–—]+$/, "").trim();
          }

          let subtitle = "";
          if (title.includes(" - ") || title.includes(" | ") || title.includes(", ")) {
            const parts = title.split(/\s*[-–—|,]\s*/);
            if (parts.length >= 2) {
              title = parts[0];
              subtitle = parts.slice(1).join(" - ");
            }
          }

          currentItem = {
            id: uid(),
            title: title || trimmed,
            subtitle,
            subtitle2: "",
            date,
            link: "",
            bullets: "",
          };
        } else if (currentItem) {
          if (isBullet) {
            const bulletText = trimmed.replace(/^[•\-*•‣▪]\s*/, "");
            currentItem.bullets = currentItem.bullets ? `${currentItem.bullets}\n${bulletText}` : bulletText;
          } else if (!currentItem.subtitle && !currentItem.bullets) {
            currentItem.subtitle = trimmed;
          } else if (!currentItem.subtitle2 && !currentItem.bullets) {
            currentItem.subtitle2 = trimmed;
          } else {
            currentItem.bullets = currentItem.bullets ? `${currentItem.bullets}\n${trimmed}` : trimmed;
          }
        }
      }

      if (currentItem) {
        items.push(currentItem);
      }

      result.sections.push({
        id: uid(),
        type: "entries",
        title: sec.title,
        visible: true,
        subtitleInline: true,
        separator: "",
        items,
      });
    }
  }

  return result;
}

/** Direct parse from lines without manual review (fallback) */
export function parseResumeFromLines(lines: Line[]): Resume {
  const draft = parseDraftFromLines(lines);
  return compileResumeFromDraft(draft);
}
