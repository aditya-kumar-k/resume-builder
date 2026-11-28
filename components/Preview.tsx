"use client";
import { useLayoutEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Resume, Section } from "@/lib/types";
import { cssFont, variantOf } from "@/lib/fonts";
import { sectionIconId } from "@/lib/icons";
import { TEMPLATES, bulletLines, headerItems, headingGapOf, resolveColors, showHeadingRule, titleSeparator } from "@/lib/templates";
import { isShortBlock, parseLineRuns, parseRich } from "@/lib/richtext";
import type { Block, Run } from "@/lib/richtext";
import { Icon } from "./Icon";

const PAGE_H = 1123;

/** On-screen preview at A4 width (1pt = 1.333px). It mirrors what the PDF prints; page breaks are approximate. */
export function Preview({ r }: { r: Resume }) {
  const { style: st, header } = r;
  const t = TEMPLATES[st.template];
  const px = (pt: number) => `${pt * 1.333}px`;
  /** Page is 210 mm wide = 794 px. */
  const mm = (v: number) => (v * 794) / 210;
  const m = st.margins;
  const F = (role: Parameters<typeof cssFont>[1], variant?: Parameters<typeof cssFont>[2]) => cssFont(st, role, variant);
  const root = useRef<HTMLDivElement>(null);

  /**
   * Mirrors how the PDF paginates: each [data-keep] block stays whole, so one that would cross the bottom margin
   * is pushed to the top of the next page (below the top margin). Runs after every render and once fonts load.
   */
  useLayoutEffect(() => {
    const paginate = () => {
      const el = root.current;
      if (!el) return;
      const keeps = Array.from(el.querySelectorAll<HTMLElement>("[data-keep]"));
      keeps.forEach((k) => (k.style.paddingTop = ""));
      const box = el.getBoundingClientRect();
      const top0 = box.top;
      // The stage scales the page with CSS zoom, which scales measured rectangles too, so convert back to page pixels.
      const z = box.width / el.offsetWidth || 1;
      const usable = PAGE_H - mm(m.top) - mm(m.bottom);
      for (const k of keeps) {
        const rect = k.getBoundingClientRect();
        const T = (rect.top - top0) / z;
        const B = (rect.bottom - top0) / z;
        const limit = (Math.floor(T / PAGE_H) + 1) * PAGE_H - mm(m.bottom);
        if (B > limit + 0.5 && rect.height / z <= usable) k.style.paddingTop = `${Math.ceil(limit + mm(m.bottom) + mm(m.top) - T)}px`;
      }
    };
    paginate();
    let live = true;
    document.fonts?.ready.then(() => live && paginate());
    return () => {
      live = false;
    };
  });

  const colors = resolveColors(st);

  const heading = (text: string, iconId: string | null, rule: boolean, below: number): ReactNode => {
    const s: CSSProperties = {
      ...F("heading"),
      display: "flex",
      alignItems: "center",
      gap: px(5),
      margin: `${px(st.gap)} 0 ${px(below)}`,
      fontSize: px(st.base * 1.05),
      color: colors.sectionTitleColor,
    };
    // Without its line, a heading is plain text; the "bar" style has no bar left, so it reads as bold text.
    if (t.heading === "caps") Object.assign(s, { textTransform: "uppercase" }, rule ? { borderBottom: `${px(2)} solid ${colors.ruleColor}`, paddingBottom: px(2) } : {});
    if (t.heading === "rule") Object.assign(s, { color: colors.sectionTitleColor }, rule ? { borderBottom: `${px(0.8)} solid ${colors.ruleColor}`, paddingBottom: px(2) } : {});
    if (t.heading === "bar" && rule) Object.assign(s, { background: colors.ruleColor, color: colors.sectionTitleColor, padding: `${px(2)} ${px(4)}` });
    return (
      <div style={s}>
        {st.sectionIcons && iconId ? <Icon id={iconId} size={st.base * 1.333 * 1.1} /> : null}
        <span>{text}</span>
      </div>
    );
  };

  const renderRuns = (runs: Run[]): ReactNode =>
    runs.map((r, k) => {
      if (r.text === "\n") return <br key={k} />;
      const v = r.bold ? "bold" : r.italic ? "italic" : undefined;
      const style: CSSProperties = { ...(v ? F("body", v) : {}), ...(r.underline ? { textDecoration: "underline" } : {}) };
      const text = <span key={k} style={style}>{r.text}</span>;
      return r.href ? <a key={k} href={r.href} style={{ color: "inherit", textDecoration: "none" }}>{text}</a> : text;
    });

  const renderInlineRich = (text: string, role: Parameters<typeof cssFont>[1], defaultStyle?: CSSProperties): ReactNode => {
    const runs = parseLineRuns(text);
    return runs.map((r, k) => {
      if (r.text === "\n") return <br key={k} />;
      const isBold = r.bold ?? (variantOf(role) === "bold");
      const isItalic = r.italic ?? (variantOf(role) === "italic");
      const style: CSSProperties = {
        ...F(role),
        fontWeight: isBold ? 700 : 400,
        fontStyle: isItalic ? "italic" : "normal",
        ...(r.underline ? { textDecoration: "underline" } : {}),
        ...defaultStyle,
      };
      const node = <span key={k} style={style}>{r.text}</span>;
      return r.href ? <a key={k} href={r.href} style={{ color: "inherit", textDecoration: "none" }}>{node}</a> : node;
    });
  };

  /** One block of the Text section: runs with bold, italic, underline and links, or a bullet row. */
  const richBlock = (blk: Block, index: number, align: CSSProperties["textAlign"] = "left"): ReactNode => {
    const runs = renderRuns(blk.runs);
    return blk.bullet ? (
      <div style={{ display: "flex", marginTop: px(1), ...F("body") }}>
        <span style={{ width: px(10), flex: "0 0 auto" }}>•</span>
        <span style={{ flex: 1, textAlign: align }}>{runs}</span>
      </div>
    ) : (
      <div style={{ marginTop: index > 0 ? px(2) : 0, textAlign: align, ...F("body") }}>{runs}</div>
    );
  };

  const renderSection = (sec: Section) => {
    if (!sec.visible) return null;
    const h = heading(sec.title, sectionIconId(sec), showHeadingRule(st, sec), headingGapOf(st, sec));
    const align: CSSProperties["textAlign"] = sec.textAlign ?? st.textAlign ?? "left";
    if (sec.type === "text") {
      if (!sec.body.trim()) return null;
      const blocks = parseRich(sec.body);
      if (!blocks.length) return null;
      return (
        <div key={sec.id} style={{ display: "flow-root" }}>
          {blocks.map((blk, bi) => {
            const short = isShortBlock(blk);
            if (bi === 0) return short ? <div key={bi} data-keep>{h}{richBlock(blk, bi, align)}</div> : <div key={bi}><div data-keep>{h}</div>{richBlock(blk, bi, align)}</div>;
            return <div key={bi} {...(short ? { "data-keep": "" } : {})}>{richBlock(blk, bi, align)}</div>;
          })}
        </div>
      );
    }
    if (sec.type === "skills") {
      const groups = sec.groups.filter((g) => g.items.trim());
      if (!groups.length) return null;
      return (
        <div key={sec.id} style={{ display: "flow-root" }}>
          {groups.map((g, gi) => {
            const lbl = g.label.trim();
            const labelText = lbl ? (lbl.endsWith(":") ? `${lbl} ` : `${lbl}: `) : "";
            const cleanItems = g.items.replace(/\s*[\r\n]+\s*/g, " ").trim();
            const line = (
              <div style={{ marginBottom: px(4), textAlign: align, ...F("body") }}>
                {labelText ? <span style={{ ...F("itemTitle"), color: colors.itemTitleColor }}>{labelText}</span> : null}
                {renderRuns(parseLineRuns(cleanItems))}
              </div>
            );
            return (
              <div key={g.id} data-keep>
                {gi === 0 ? h : null}
                {line}
              </div>
            );
          })}
        </div>
      );
    }
    if (!sec.items.length) return null;
    return (
      <div key={sec.id} style={{ display: "flow-root" }}>
        {sec.items.map((it, index) => {
          const itemAlign = it.align ?? align;
          const mb = index === sec.items.length - 1 ? 0 : px(6);
          const titleContent = renderInlineRich(it.title, "itemTitle", { color: colors.itemTitleColor });
          const title = it.link ? <a href={it.link} style={{ color: "inherit", textDecoration: "none" }}>{titleContent}</a> : titleContent;
          const bullets = bulletLines(it.bullets);
          const short = bullets.length <= 4;
          const ul = (list: string[]) =>
            list.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: px(10) }}>
                {list.map((b, i) => (
                  <li key={i} data-keep style={{ marginTop: px(1), textAlign: itemAlign }}>
                    {renderRuns(parseLineRuns(b))}
                  </li>
                ))}
              </ul>
            );
          const isInline = it.subtitleInline !== undefined ? it.subtitleInline : sec.subtitleInline;
          const hasSub1 = !!it.subtitle;
          const hasSub2 = !!it.subtitle2;
          const hasAnySub = hasSub1 || hasSub2;
          const sep = sec.separator;
          const head = (
            <>
              {index === 0 ? h : null}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>
                  <span style={{ ...F("itemTitle"), color: colors.itemTitleColor }}>{title}{isInline && hasAnySub ? titleSeparator(sep) : ""}</span>
                  {isInline && hasSub1 ? <span style={F("subtitle")}> {renderInlineRich(it.subtitle, "subtitle")}</span> : null}
                  {isInline && hasSub1 && hasSub2 ? <span style={F("subtitle")}>{titleSeparator(sep)}</span> : null}
                  {isInline && hasSub2 ? <span style={F("subtitle")}> {renderInlineRich(it.subtitle2 || "", "subtitle")}</span> : null}
                </span>
                <span style={{ color: "#555", whiteSpace: "nowrap", ...F("date") }}>{it.date}</span>
              </div>
              {!isInline && hasSub1 ? <div style={{ textAlign: itemAlign, ...F("subtitle") }}>{renderInlineRich(it.subtitle, "subtitle")}</div> : null}
              {!isInline && hasSub2 ? <div style={{ textAlign: itemAlign, ...F("subtitle") }}>{renderInlineRich(it.subtitle2 || "", "subtitle")}</div> : null}
            </>
          );
          // Short entries stay whole; long ones may split, but the heading, title line and first bullet stay together.
          return short ? (
            <div key={it.id} data-keep style={{ marginBottom: mb, ...F("body") }}>
              {head}
              {ul(bullets)}
            </div>
          ) : (
            <div key={it.id} style={{ marginBottom: mb, ...F("body") }}>
              <div data-keep>
                {head}
                {ul(bullets.slice(0, 1))}
              </div>
              {ul(bullets.slice(1))}
            </div>
          );
        })}
      </div>
    );
  };

  const items = headerItems(r);
  const headerAlign = header.align || "left";
  const headerJustify = headerAlign === "center" ? "center" : headerAlign === "right" ? "flex-end" : "flex-start";
  const headerStyle: CSSProperties = {
    ...(st.band
      ? { background: st.bandColor, padding: `${mm(m.top)}px ${mm(m.right)}px ${px(12)} ${mm(m.left)}px` }
      : { padding: `${mm(m.top)}px ${mm(m.right)}px 0 ${mm(m.left)}px` }),
    textAlign: headerAlign,
  };
  const nameEl = <span style={{ ...F("name"), fontSize: px(st.base * 2.2) }}>{r.name}</span>;
  const occEl = r.title ? (
    <span style={{ ...F("occupation"), fontSize: px(st.base * 1.3), color: "#444", marginLeft: header.occupationNewLine ? 0 : px(8) }}>{r.title}</span>
  ) : null;

  return (
    <div
      id="resume-preview"
      ref={root}
      style={{
        position: "relative", overflow: "hidden", width: 794, minHeight: PAGE_H, background: "#fff", color: "#1a1a1a",
        ...F("body"), fontSize: px(st.base), lineHeight: 1.35, boxShadow: "0 2px 14px rgba(0,0,0,.18)",
      }}
    >
      <div style={headerStyle}>
        {header.occupationNewLine ? (
          <>
            <div>{nameEl}</div>
            {occEl && <div style={{ marginTop: 2 }}>{occEl}</div>}
          </>
        ) : (
          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameEl}{occEl}</div>
        )}
        <div style={{ marginTop: px(6), fontSize: px(st.base * 0.95), color: "#333", display: "flex", flexWrap: "wrap", justifyContent: headerJustify, columnGap: px(header.icons ? 14 : 0), rowGap: 2, ...F("contact") }}>
          {items.map((it, i) => {
            const label = it.url ? <a href={it.url} style={{ color: "inherit", textDecoration: "none" }}>{it.label}</a> : it.label;
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: px(4), whiteSpace: "nowrap" }}>
                {!header.icons && i > 0 && <span style={{ margin: `0 ${px(7)}`, color: "#999" }}>|</span>}
                {header.icons && <Icon id={it.icon} size={st.base * 1.333} />}
                {label}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ padding: `0 ${mm(m.right)}px ${mm(m.bottom)}px ${mm(m.left)}px` }}>{r.sections.map(renderSection)}</div>
      {[1, 2, 3].map((n) => (
        <div key={n} style={{ position: "absolute", left: 0, right: 0, top: n * PAGE_H, borderTop: "1px dashed #bbb", pointerEvents: "none" }}>
          <span style={{ position: "absolute", right: 6, top: 2, fontSize: 10, color: "#999", fontFamily: "system-ui" }}>page {n + 1}</span>
        </div>
      ))}
    </div>
  );
}
