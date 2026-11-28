import React from "react";
import { Circle, Document, Ellipse, Font, G, Line, Link, Page, Path, Polygon, Polyline, Rect, StyleSheet, Svg, Text, View, pdf } from "@react-pdf/renderer";
import type { Resume, Section } from "./types";
import { pdfFontFor, registerPdfFonts } from "./fonts";
import { ICONS, sectionIconId } from "./icons";
import { isShortBlock, parseLineRuns, parseRich } from "./richtext";
import type { Block, Run } from "./richtext";
import { TEMPLATES, bulletLines, headerItems, headingGapOf, resolveColors, showHeadingRule, titleSeparator } from "./templates";

Font.registerHyphenationCallback((word) => [word]);

/** Points per millimetre. */
const MM = 72 / 25.4;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SHAPES: Record<string, any> = { path: Path, circle: Circle, rect: Rect, line: Line, polyline: Polyline, polygon: Polygon, ellipse: Ellipse };

function PdfIcon({ id, size, color, style }: { id: string; size: number; color: string; style?: Record<string, number> }) {
  const def = ICONS[id];
  if (!def) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <G fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {def.node.map(([tag, attrs], i) => {
          const Shape = SHAPES[tag];
          return Shape ? <Shape key={i} {...attrs} /> : null;
        })}
      </G>
    </Svg>
  );
}

/**
 * `fontBase` is where the font files live: a URL ending in "/" in the browser, or a folder path in tests.
 */
export async function createPdfBlob(r: Resume, fontBase = "/fonts/"): Promise<Blob> {
  registerPdfFonts(Font, fontBase.startsWith("/") && typeof window !== "undefined" ? `${window.location.origin}${fontBase}` : fontBase);
  const { style: st, header } = r;
  const m = st.margins;
  const t = TEMPLATES[st.template];
  const F = (role: Parameters<typeof pdfFontFor>[1], variant?: Parameters<typeof pdfFontFor>[2]) => pdfFontFor(st, role, variant);
  const s = StyleSheet.create({
    page: { ...F("body"), fontSize: st.base, color: "#1a1a1a", lineHeight: 1.35, paddingBottom: m.bottom * MM },
    band: { backgroundColor: st.band ? st.bandColor : undefined, paddingLeft: m.left * MM, paddingRight: m.right * MM, paddingTop: m.top * MM, paddingBottom: st.band ? 12 : 0 },
    body: { paddingLeft: m.left * MM, paddingRight: m.right * MM },
    section: { marginTop: st.gap },
    row: { flexDirection: "row", justifyContent: "space-between" },
    bullet: { flexDirection: "row", marginTop: 1 },
    dot: { width: 10 },
    item: { marginBottom: 6 },
  });

  const colors = resolveColors(st);

  // Without its line a heading is plain text; the "bar" style has no bar left, so it reads as bold text.
  const Heading = ({ text, iconId, rule, below }: { text: string; iconId: string | null; rule: boolean; below: number }) => {
    const headingBox = {
      marginBottom: below,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      ...(rule && t.heading === "caps" ? { borderBottomWidth: 2, borderBottomColor: colors.ruleColor, paddingBottom: 2 } : {}),
      ...(rule && t.heading === "rule" ? { borderBottomWidth: 0.8, borderBottomColor: colors.ruleColor, paddingBottom: 2 } : {}),
      ...(rule && t.heading === "bar" ? { backgroundColor: colors.ruleColor, paddingHorizontal: 4, paddingVertical: 2 } : {}),
    };
    const headingColor = colors.sectionTitleColor;
    return (
      <View style={headingBox}>
        {st.sectionIcons && iconId ? (
          <PdfIcon id={iconId} size={st.base * 1.1} color={headingColor} style={{ marginRight: 5 }} />
        ) : null}
        <Text style={{ ...F("heading"), fontSize: st.base * 1.05, color: headingColor, textTransform: t.heading === "caps" ? "uppercase" : "none" }}>{text}</Text>
      </View>
    );
  };

  const renderSection = (sec: Section) => {
    if (!sec.visible) return null;
    const iconId = sectionIconId(sec);
    const rule = showHeadingRule(st, sec);
    const below = headingGapOf(st, sec);
    const align = (sec.textAlign ?? st.textAlign ?? "left") as "left" | "right" | "center" | "justify";
    const renderPdfRuns = (runs: Run[]) =>
      runs.map((r, k) => {
        const v = r.bold ? "bold" : r.italic ? "italic" : undefined;
        const text = <Text key={k} style={{ ...(v ? F("body", v) : {}), ...(r.underline ? { textDecoration: "underline" as const } : {}) }}>{r.text}</Text>;
        return r.href ? <Link key={k} src={r.href} style={{ color: "#1a1a1a", textDecoration: "none" }}>{text}</Link> : text;
      });

    if (sec.type === "text") {
      const blocks = parseRich(sec.body);
      if (!blocks.length) return null;
      const richBlock = (blk: Block, index: number) => {
        const runs = renderPdfRuns(blk.runs);
        return blk.bullet ? (
          <View style={s.bullet}>
            <Text style={s.dot}>•</Text>
            <Text style={{ flex: 1, textAlign: align, ...F("body") }}>{runs}</Text>
          </View>
        ) : (
          <Text style={{ marginTop: index > 0 ? 2 : 0, textAlign: align, ...F("body") }}>{runs}</Text>
        );
      };
      return (
        <View key={sec.id} style={s.section}>
          {blocks.map((blk, bi) => {
            const short = isShortBlock(blk);
            if (bi === 0)
              return short ? (
                <View key={bi} wrap={false}>
                  <Heading text={sec.title} iconId={iconId} rule={rule} below={below} />
                  {richBlock(blk, bi)}
                </View>
              ) : (
                <View key={bi}>
                  <View wrap={false}>
                    <Heading text={sec.title} iconId={iconId} rule={rule} below={below} />
                  </View>
                  {richBlock(blk, bi)}
                </View>
              );
            return <View key={bi} wrap={!short}>{richBlock(blk, bi)}</View>;
          })}
        </View>
      );
    }
    if (sec.type === "skills") {
      const groups = sec.groups.filter((g) => g.items.trim());
      if (!groups.length) return null;
      return (
        <View key={sec.id} style={s.section}>
          {groups.map((g, gi) => {
            const lbl = g.label.trim();
            const labelText = lbl ? (lbl.endsWith(":") ? `${lbl} ` : `${lbl}: `) : "";
            const cleanItems = g.items.replace(/\s*[\r\n]+\s*/g, " ").trim();
            const line = (
              <Text key={g.id} style={{ marginBottom: 4, textAlign: align, ...F("body") }}>
                {labelText ? <Text style={{ ...F("itemTitle"), color: colors.itemTitleColor }}>{labelText}</Text> : null}
                {renderPdfRuns(parseLineRuns(cleanItems))}
              </Text>
            );
            return gi === 0 ? (
              <View key={g.id} wrap={false}>
                <Heading text={sec.title} iconId={iconId} rule={rule} below={below} />
                {line}
              </View>
            ) : (
              line
            );
          })}
        </View>
      );
    }
    if (!sec.items.length) return null;
    return (
      <View key={sec.id} style={s.section}>
        {sec.items.map((it, index) => {
          const itemAlign = (it.align ?? align) as "left" | "right" | "center" | "justify";
          const isInline = it.subtitleInline !== undefined ? it.subtitleInline : sec.subtitleInline;
          const hasSub1 = !!it.subtitle;
          const hasSub2 = !!it.subtitle2;
          const hasAnySub = hasSub1 || hasSub2;
          const inline = isInline && hasAnySub;
          const sep = sec.separator;
          const titleText = <Text style={{ ...F("itemTitle"), color: colors.itemTitleColor }}>{it.title}{inline ? titleSeparator(sep) : ""}</Text>;
          const bullets = bulletLines(it.bullets);
          const bullet = (b: string, i: number) => (
            <View key={i} style={s.bullet}>
              <Text style={s.dot}>•</Text>
              <Text style={{ flex: 1, textAlign: itemAlign, ...F("body") }}>
                {renderPdfRuns(parseLineRuns(b))}
              </Text>
            </View>
          );
          const head = (
            <>
              {index === 0 ? <Heading text={sec.title} iconId={iconId} rule={rule} below={below} /> : null}
              <View style={s.row}>
                <Text style={{ flex: 1 }}>
                  {it.link ? <Link src={it.link} style={{ color: colors.itemTitleColor, textDecoration: "none" }}>{titleText}</Link> : titleText}
                  {isInline && hasSub1 ? <Text style={F("subtitle")}> {it.subtitle}</Text> : null}
                  {isInline && hasSub1 && hasSub2 ? <Text style={F("subtitle")}>{titleSeparator(sep)}</Text> : null}
                  {isInline && hasSub2 ? <Text style={F("subtitle")}> {it.subtitle2}</Text> : null}
                </Text>
                {it.date ? <Text style={{ color: "#555555", marginLeft: 10, ...F("date") }}>{it.date}</Text> : null}
              </View>
              {!isInline && hasSub1 ? <Text style={{ textAlign: itemAlign, ...F("subtitle") }}>{it.subtitle}</Text> : null}
              {!isInline && hasSub2 ? <Text style={{ textAlign: itemAlign, ...F("subtitle") }}>{it.subtitle2}</Text> : null}
            </>
          );
          const itemStyle = index === sec.items.length - 1 ? { marginBottom: 0 } : s.item;
          // Short entries stay whole on one page. Long ones may split, but the heading, title line and first bullet stay together.
          if (bullets.length <= 4) {
            return (
              <View key={it.id} style={itemStyle} wrap={false}>
                {head}
                {bullets.map(bullet)}
              </View>
            );
          }
          return (
            <View key={it.id} style={itemStyle}>
              <View wrap={false}>
                {head}
                {bullet(bullets[0] as string, 0)}
              </View>
              {bullets.slice(1).map((b, i) => bullet(b, i + 1))}
            </View>
          );
        })}
      </View>
    );
  };

  const items = headerItems(r);
  const align = header.align === "center" ? ("center" as const) : header.align === "right" ? ("right" as const) : ("left" as const);
  const headerJustify = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
  const nameStyle = { ...F("name"), fontSize: st.base * 2.2 };
  const occStyle = { ...F("occupation"), fontSize: st.base * 1.3, color: "#444444" };
  const contactBase = { ...F("contact"), fontSize: st.base * 0.95, color: "#333333" };
  const linkEl = (it: (typeof items)[number], text: React.ReactNode) =>
    it.url ? <Link src={it.url} style={{ color: "#333333", textDecoration: "none" }}>{text}</Link> : text;

  const doc = (
    <Document title={`${r.name} Resume`} author={r.name}>
      <Page size="A4" style={s.page}>
        <View fixed render={({ pageNumber }) => (pageNumber > 1 ? <View style={{ height: m.top * MM }} /> : null)} />
        <View style={s.band}>
          {header.occupationNewLine ? (
            <View>
              <Text style={{ ...nameStyle, textAlign: align }}>{r.name}</Text>
              {r.title ? <Text style={{ ...occStyle, marginTop: 2, textAlign: align }}>{r.title}</Text> : null}
            </View>
          ) : (
            <Text style={{ textAlign: align }}>
              <Text style={nameStyle}>{r.name}</Text>
              {r.title ? <Text style={occStyle}>{"  "}{r.title}</Text> : null}
            </Text>
          )}
          {header.icons ? (
            <View style={{ marginTop: 6, flexDirection: "row", flexWrap: "wrap", justifyContent: headerJustify }}>
              {items.map((it, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
                  <PdfIcon id={it.icon} size={st.base * 1.0} color="#333333" />
                  <Text style={{ ...contactBase, marginLeft: 4 }}>{linkEl(it, it.label)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ ...contactBase, marginTop: 6, textAlign: align }}>
              {items.map((it, i) => (
                <Text key={i}>
                  {i > 0 ? <Text style={{ color: "#999999" }}>{"   |   "}</Text> : null}
                  {linkEl(it, it.label)}
                </Text>
              ))}
            </Text>
          )}
        </View>
        <View style={s.body}>{r.sections.map(renderSection)}</View>
      </Page>
    </Document>
  );
  return pdf(doc).toBlob();
}
