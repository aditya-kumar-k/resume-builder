import type { FontId, FontRole, Style } from "./types";

type FontDef = {
  label: string;
  /** CSS font-family stack for the preview. */
  css: string;
  /** Word font name. Custom fonts show in Word only where installed. */
  docx: string;
  /** PDF built-in font names, when the family needs no file. */
  builtin?: { regular: string; bold: string; italic: string };
  /** Files in /public/fonts/<file>-{regular,bold,italic}.woff, and the family name registered with the PDF. */
  file?: string;
  family?: string;
};

export const FONTS: Record<FontId, FontDef> = {
  sans: { label: "Helvetica (default)", css: "Helvetica, Arial, sans-serif", docx: "Calibri", builtin: { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" } },
  serif: { label: "Times", css: "'Times New Roman', Times, serif", docx: "Times New Roman", builtin: { regular: "Times-Roman", bold: "Times-Bold", italic: "Times-Italic" } },
  mono: { label: "Courier", css: "'Courier New', Courier, monospace", docx: "Courier New", builtin: { regular: "Courier", bold: "Courier-Bold", italic: "Courier-Oblique" } },
  inter: { label: "Inter", css: "'Inter', sans-serif", docx: "Inter", file: "inter", family: "Inter" },
  lato: { label: "Lato", css: "'Lato', sans-serif", docx: "Lato", file: "lato", family: "Lato" },
  opensans: { label: "Open Sans", css: "'Open Sans', sans-serif", docx: "Open Sans", file: "open-sans", family: "Open Sans" },
  roboto: { label: "Roboto", css: "'Roboto', sans-serif", docx: "Roboto", file: "roboto", family: "Roboto" },
  merriweather: { label: "Merriweather (serif)", css: "'Merriweather', serif", docx: "Merriweather", file: "merriweather", family: "Merriweather" },
  lora: { label: "Lora (serif)", css: "'Lora', serif", docx: "Lora", file: "lora", family: "Lora" },
};

export const FONT_IDS = Object.keys(FONTS) as FontId[];

export type Variant = "regular" | "bold" | "italic";

export const FONT_ROLES: { id: FontRole; label: string; variant: Variant }[] = [
  { id: "name", label: "Name", variant: "bold" },
  { id: "occupation", label: "Occupation", variant: "regular" },
  { id: "contact", label: "Contact line and links", variant: "regular" },
  { id: "heading", label: "Section headings", variant: "bold" },
  { id: "itemTitle", label: "Entry titles and skill labels", variant: "bold" },
  { id: "subtitle", label: "Subtitles", variant: "italic" },
  { id: "date", label: "Dates", variant: "regular" },
  { id: "body", label: "Body text and bullets", variant: "regular" },
];

export const variantOf = (role: FontRole) => FONT_ROLES.find((r) => r.id === role)?.variant ?? "regular";

/** The font a kind of text uses: its own pick, or the base font. */
export const fontFor = (st: Pick<Style, "font" | "roleFonts">, role: FontRole): FontId => st.roleFonts[role] ?? st.font;

/** Preview styles for a kind of text; `variant` overrides the role's usual weight (a body-font bold label, say). */
export function cssFont(st: Pick<Style, "font" | "roleFonts">, role: FontRole, variant: Variant = variantOf(role)) {
  return {
    fontFamily: FONTS[fontFor(st, role)].css,
    fontWeight: variant === "bold" ? 700 : 400,
    fontStyle: variant === "italic" ? ("italic" as const) : ("normal" as const),
  };
}

/** PDF styles for a font id and weight. Built-in fonts are named per weight; file fonts use a family plus weight/style. */
export function pdfFont(id: FontId, variant: Variant) {
  const def = FONTS[id];
  if (def.builtin) return { fontFamily: def.builtin[variant] };
  return {
    fontFamily: def.family as string,
    fontWeight: variant === "bold" ? 700 : 400,
    fontStyle: variant === "italic" ? ("italic" as const) : ("normal" as const),
  };
}

export const pdfFontFor = (st: Pick<Style, "font" | "roleFonts">, role: FontRole, variant: Variant = variantOf(role)) =>
  pdfFont(fontFor(st, role), variant);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FontApi = { register: (o: any) => void };
let registeredFrom = "";

/** Registers the file fonts with the PDF renderer. `base` is a URL (browser) or a folder path (tests) ending in "/". */
export function registerPdfFonts(Font: FontApi, base: string) {
  if (registeredFrom === base) return;
  for (const def of Object.values(FONTS)) {
    if (!def.file) continue;
    Font.register({
      family: def.family,
      fonts: [
        { src: `${base}${def.file}-regular.woff`, fontWeight: 400, fontStyle: "normal" },
        { src: `${base}${def.file}-bold.woff`, fontWeight: 700, fontStyle: "normal" },
        { src: `${base}${def.file}-italic.woff`, fontWeight: 400, fontStyle: "italic" },
      ],
    });
  }
  registeredFrom = base;
}

/** @font-face rules for the preview. */
export const fontFaceCss = () =>
  Object.values(FONTS)
    .filter((d) => d.file)
    .flatMap((d) =>
      (["regular", "bold", "italic"] as const).map(
        (v) =>
          `@font-face{font-family:'${d.family}';src:url('/fonts/${d.file}-${v}.woff') format('woff');font-weight:${v === "bold" ? 700 : 400};font-style:${v === "italic" ? "italic" : "normal"};font-display:swap}`,
      ),
    )
    .join("\n");
