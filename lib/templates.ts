import { linkIcon } from "./icons";
import type { Resume, SectionType, Section, Style, TemplateId } from "./types";

export type TemplateConfig = {
  name: string;
  description: string;
  heading: "caps" | "rule" | "bar";
  defaults: Pick<Style, "font" | "base" | "gap" | "accent">;
};

export const TEMPLATES: Record<TemplateId, TemplateConfig> = {
  band: {
    name: "Band",
    description: "Grey header band, bold caps headings with a heavy rule.",
    heading: "caps",
    defaults: { font: "sans", base: 10, gap: 14, accent: "#9ca3af" },
  },
  plain: {
    name: "Plain",
    description: "Serif, coloured headings with a thin rule.",
    heading: "rule",
    defaults: { font: "serif", base: 10.5, gap: 14, accent: "#1f4e79" },
  },
  compact: {
    name: "Compact",
    description: "Dense, filled heading bars. Fits more on a page.",
    heading: "bar",
    defaults: { font: "sans", base: 9, gap: 9, accent: "#1f4e79" },
  },
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const bulletLines = (text: string) =>
  text.split("\n").map((line) => line.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

/** The header's contact line: email, phone and place in the chosen order, then links. Each may carry a URL. */
export type HeaderItem = { label: string; url?: string; icon: string };
export function headerItems(r: Resume): HeaderItem[] {
  const items: HeaderItem[] = [];
  for (const key of r.header.contactOrder) {
    if (key === "email" && r.email) items.push({ label: r.email, url: `mailto:${r.email}`, icon: "mail" });
    if (key === "phone" && r.phone) items.push({ label: r.phone, url: `tel:${r.phone.replace(/\s+/g, "")}`, icon: "phone" });
    if (key === "location" && r.location) items.push({ label: r.location, icon: "map-pin" });
  }
  for (const l of r.links) if (l.label) items.push({ label: l.label, ...(l.url ? { url: l.url } : {}), icon: linkIcon(l.label, l.url) });
  return items;
}

/** The symbol stuck to the end of an inline title. Punctuation joins directly ("Title,"); other symbols get a space ("Title |"). */
export const titleSeparator = (sep: string | undefined) => {
  const s = (sep ?? ",").trim();
  if (!s) return "";
  return /^[,;:.]$/.test(s) ? s : ` ${s}`;
};

/** Whether a section's heading gets its line: the section's own choice, else the design setting. */
export const showHeadingRule = (st: Pick<Style, "headingRule">, sec: Pick<Section, "rule">) =>
  sec.rule === "show" ? true : sec.rule === "hide" ? false : st.headingRule;

/** Space under a section's heading in pt: the section's own value, else the design setting. */
export const headingGapOf = (st: Pick<Style, "headingGap">, sec: Pick<Section, "headingGap">) => sec.headingGap ?? st.headingGap;

export const newSection = (type: SectionType): Section => {
  const base = { id: uid(), visible: true };
  if (type === "text") return { ...base, type, title: "Summary", body: "" };
  if (type === "skills") return { ...base, type, title: "Skills", groups: [{ id: uid(), label: "Group", items: "" }] };
  return { ...base, type, title: "Experience", subtitleInline: true, separator: ",", items: [] };
};

export const newItem = () => ({ id: uid(), title: "", subtitle: "", date: "", link: "", bullets: "" });
