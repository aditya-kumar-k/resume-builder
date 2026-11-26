import { AlignmentType, BorderStyle, Document, ExternalHyperlink, Packer, Paragraph, ShadingType, TabStopType, TextRun } from "docx";
import type { ParagraphChild } from "docx";
import type { Resume, Section } from "./types";
import { FONTS, fontFor, variantOf } from "./fonts";
import type { FontRole } from "./types";
import { parseRich } from "./richtext";
import { TEMPLATES, bulletLines, headerItems, headingGapOf, showHeadingRule, titleSeparator } from "./templates";

const hex = (c: string) => c.replace("#", "").toUpperCase();
const TWIPS_PER_MM = 1440 / 25.4;

/** Word keeps one simple column for every template so applicant systems read it cleanly. */
export async function createDocxBlob(r: Resume): Promise<Blob> {
  const { style: st } = r;
  const t = TEMPLATES[st.template];
  const size = Math.round(st.base * 2);
  const accent = hex(st.accent);
  const fill = st.band ? hex(st.bandColor) : undefined;
  const shading = fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined;
  /** A run in the font chosen for its kind of text; bold and italics follow the role unless overridden. */
  const run = (text: string, role: FontRole, o: { bold?: boolean; italics?: boolean; underline?: boolean; size?: number; color?: string } = {}) => {
    const variant = variantOf(role);
    return new TextRun({
      text,
      font: FONTS[fontFor(st, role)].docx,
      size: o.size ?? size,
      bold: o.bold ?? variant === "bold",
      italics: o.italics ?? variant === "italic",
      underline: o.underline ? {} : undefined,
      color: o.color,
    });
  };

  /** Without its line a heading is plain text; the "bar" style has no bar left, so it reads as bold text. */
  const heading = (text: string, rule: boolean, below: number) =>
    new Paragraph({
      spacing: { before: Math.round(st.gap * 20), after: Math.round(below * 20) },
      keepNext: true,
      border: rule && t.heading !== "bar" ? { bottom: { style: BorderStyle.SINGLE, size: t.heading === "caps" ? 12 : 6, color: accent, space: 1 } } : undefined,
      shading: rule && t.heading === "bar" ? { type: ShadingType.CLEAR, fill: accent, color: "auto" } : undefined,
      children: [
        run(t.heading === "caps" || t.heading === "bar" ? text.toUpperCase() : text, "heading", {
          size: size + 2,
          color: t.heading === "rule" ? accent : t.heading === "bar" && rule ? "FFFFFF" : undefined,
        }),
      ],
    });

  const body: Paragraph[] = [];
  const alignment = r.header.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;

  const nameRun = run(r.name, "name", { size: Math.round(size * 2.2) });
  const occRun = (text: string) => run(text, "occupation", { size: Math.round(size * 1.3), color: "444444" });
  if (r.header.occupationNewLine) {
    body.push(new Paragraph({ shading, alignment, spacing: { before: 0, after: 0 }, children: [nameRun] }));
    if (r.title) body.push(new Paragraph({ shading, alignment, spacing: { before: 0, after: 0 }, children: [occRun(r.title)] }));
  } else {
    body.push(new Paragraph({ shading, alignment, spacing: { before: 0, after: 0 }, children: r.title ? [nameRun, occRun(`  ${r.title}`)] : [nameRun] }));
  }

  const contact: ParagraphChild[] = [];
  headerItems(r).forEach((it, i) => {
    if (i > 0) contact.push(run("   |   ", "contact", { color: "999999" }));
    contact.push(it.url ? new ExternalHyperlink({ link: it.url, children: [run(it.label, "contact", { color: "333333" })] }) : run(it.label, "contact"));
  });
  body.push(new Paragraph({ shading, alignment, spacing: { before: 60, after: 120 }, children: contact }));

  const section = (sec: Section) => {
    if (!sec.visible) return;
    if (sec.type === "text") {
      const blocks = parseRich(sec.body);
      if (!blocks.length) return;
      body.push(heading(sec.title, showHeadingRule(st, sec), headingGapOf(st, sec)));
      for (const blk of blocks) {
        const children: ParagraphChild[] = blk.runs.map((r) => {
          if (r.text === "\n") return new TextRun({ break: 1 });
          const t = run(r.text, "body", { bold: r.bold || undefined, italics: r.italic || undefined, underline: r.underline });
          return r.href ? new ExternalHyperlink({ link: r.href, children: [t] }) : t;
        });
        body.push(new Paragraph({ bullet: blk.bullet ? { level: 0 } : undefined, children }));
      }
      return;
    }
    if (sec.type === "skills") {
      const groups = sec.groups.filter((g) => g.items.trim());
      if (!groups.length) return;
      body.push(heading(sec.title, showHeadingRule(st, sec), headingGapOf(st, sec)));
      for (const g of groups) body.push(new Paragraph({ spacing: { after: 60 }, children: [run(`${g.label.toUpperCase()}: `, "itemTitle"), run(g.items, "body")] }));
      return;
    }
    if (!sec.items.length) return;
    body.push(heading(sec.title, showHeadingRule(st, sec), headingGapOf(st, sec)));
    for (const it of sec.items) {
      const inline = sec.subtitleInline && !!it.subtitle;
      const titleRun = run(`${it.title}${inline ? titleSeparator(sec.separator) : ""}`, "itemTitle");
      const left: ParagraphChild[] = [it.link ? new ExternalHyperlink({ link: it.link, children: [titleRun] }) : titleRun];
      if (inline) left.push(run(` ${it.subtitle}`, "subtitle"));
      if (it.date) left.push(run(`\t${it.date}`, "date", { color: "555555" }));
      body.push(
        new Paragraph({
          spacing: { before: 100 },
          keepNext: true,
          tabStops: [{ type: TabStopType.RIGHT, position: 10300 }],
          children: left,
        }),
      );
      if (!sec.subtitleInline && it.subtitle) body.push(new Paragraph({ children: [run(it.subtitle, "subtitle")] }));
      for (const b of bulletLines(it.bullets)) body.push(new Paragraph({ bullet: { level: 0 }, children: [run(b, "body")] }));
    }
  };
  r.sections.forEach(section);

  const doc = new Document({
    creator: r.name,
    title: `${r.name} Resume`,
    sections: [{ properties: { page: { margin: { top: Math.round(st.margins.top * TWIPS_PER_MM), bottom: Math.round(st.margins.bottom * TWIPS_PER_MM), left: Math.round(st.margins.left * TWIPS_PER_MM), right: Math.round(st.margins.right * TWIPS_PER_MM) } } }, children: body }],
  });
  return Packer.toBlob(doc);
}
