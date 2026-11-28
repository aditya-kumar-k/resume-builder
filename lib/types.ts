export type TemplateId = "band" | "plain" | "compact";
export type FontId = "sans" | "serif" | "mono" | "inter" | "lato" | "opensans" | "roboto" | "merriweather" | "lora";
/** Every kind of text that can take its own font. */
export type FontRole = "name" | "occupation" | "contact" | "heading" | "itemTitle" | "subtitle" | "date" | "body";
export type ContactKey = "email" | "phone" | "location";
export type TextAlign = "left" | "center" | "right" | "justify";

export type Link = { id: string; label: string; url: string; icon?: string };

/** One entry: a project, job, degree, award or certificate. */
export type Item = {
  id: string;
  title: string;
  subtitle: string;
  /** Optional second subtitle (e.g. project details, tech stack, or secondary affiliation) */
  subtitle2?: string;
  /** Shown at the right edge: dates, place or both. */
  date: string;
  /** Makes the title a clickable link. */
  link: string;
  bullets: string;
  /** Alignment of bullet points for this entry (overrides section setting). */
  align?: TextAlign;
  /** Override section setting: true = same line as title, false = new line under title. */
  subtitleInline?: boolean;
};

export type SkillGroup = { id: string; label: string; items: string };

/** icon: undefined picks one from the title, "none" shows no icon, otherwise an id from ICONS. */
type Base = {
  id: string;
  title: string;
  visible: boolean;
  icon?: string;
  /** The line under this section's heading: undefined follows the design setting. */
  rule?: "show" | "hide";
  /** Space between this section's heading and its content, in pt: undefined follows the design setting. */
  headingGap?: number;
  /** Alignment of text in this section: undefined follows the design setting. */
  textAlign?: TextAlign;
};

export type TextSection = Base & { type: "text"; body: string };
export type SkillsSection = Base & { type: "skills"; groups: SkillGroup[] };
export type EntriesSection = Base & {
  type: "entries";
  /** true: "Title, Subtitle" on one line. false: the subtitle sits on its own line below. */
  subtitleInline: boolean;
  /** Between title and subtitle when inline. Empty means no symbol. Missing (older saves) means ",". */
  separator?: string;
  items: Item[];
};
export type Section = TextSection | SkillsSection | EntriesSection;
export type SectionType = Section["type"];

export type Style = {
  template: TemplateId;
  accent: string;
  /** Section heading text color (defaults to template preset). */
  sectionTitleColor?: string;
  /** Separator / rule line under section headings (defaults to accent). */
  ruleColor?: string;
  /** Entry titles and skill group labels color (defaults to dark / accent). */
  itemTitleColor?: string;
  font: FontId;
  /** Text alignment (legacy or fallback). */
  textAlign?: TextAlign;
  /** Body size in pt. */
  base: number;
  /** Space between sections in pt. */
  gap: number;
  band: boolean;
  bandColor: string;
  sectionIcons: boolean;
  /** Draws the line (or filled bar) under section headings. Sections can override it. */
  headingRule: boolean;
  /** Space between a section heading and its content, in pt. Sections can override it. */
  headingGap: number;
  /** Page margins in mm. */
  margins: { top: number; right: number; bottom: number; left: number };
  /** Fonts per kind of text. Anything missing uses `font`. */
  roleFonts: Partial<Record<FontRole, FontId>>;
};

export type HeaderOptions = {
  occupationNewLine: boolean;
  contactOrder: ContactKey[];
  icons: boolean;
  /** Alignment of the whole header block. */
  align: "left" | "center" | "right";
};

export type Resume = {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  links: Link[];
  header: HeaderOptions;
  sections: Section[];
  style: Style;
};
