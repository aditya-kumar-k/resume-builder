import { Award, BadgeCheck, BookOpen, Brain, Briefcase, Code, FileText, Folder, Globe, GraduationCap, Heart, Languages, Lightbulb, Link, Mail, MapPin, Phone, Puzzle, Rocket, Star, User, Wrench } from "lucide";

export type IconNode = [string, Record<string, string | number>][];

/** Icons come from Lucide (ISC licence). Each is a list of SVG shapes on a 24x24 grid, drawn as outlines. */
export const ICONS: Record<string, { label: string; node: IconNode }> = {
  mail: { label: "Mail", node: Mail as IconNode },
  phone: { label: "Phone", node: Phone as IconNode },
  "map-pin": { label: "Location pin", node: MapPin as IconNode },
  globe: { label: "Globe", node: Globe as IconNode },
  link: { label: "Link", node: Link as IconNode },
  code: { label: "Code", node: Code as IconNode },
  user: { label: "Person", node: User as IconNode },
  "file-text": { label: "Document", node: FileText as IconNode },
  brain: { label: "Brain", node: Brain as IconNode },
  lightbulb: { label: "Idea", node: Lightbulb as IconNode },
  wrench: { label: "Tools", node: Wrench as IconNode },
  folder: { label: "Folder", node: Folder as IconNode },
  rocket: { label: "Rocket", node: Rocket as IconNode },
  puzzle: { label: "Puzzle", node: Puzzle as IconNode },
  briefcase: { label: "Briefcase", node: Briefcase as IconNode },
  "graduation-cap": { label: "Graduation cap", node: GraduationCap as IconNode },
  "book-open": { label: "Book", node: BookOpen as IconNode },
  award: { label: "Award", node: Award as IconNode },
  "badge-check": { label: "Badge", node: BadgeCheck as IconNode },
  star: { label: "Star", node: Star as IconNode },
  languages: { label: "Languages", node: Languages as IconNode },
  heart: { label: "Heart", node: Heart as IconNode },
};

/** A section's icon: its own choice, or a guess from its title. "none" or no match gives no icon. */
export function sectionIconId(sec: { icon?: string; title: string; type: string }): string | null {
  if (sec.icon === "none") return null;
  if (sec.icon && ICONS[sec.icon]) return sec.icon;
  const t = sec.title.toLowerCase();
  const rules: [RegExp, string][] = [
    [/summary|about|profile|objective/, "user"],
    [/skill|technolog|tools/, "brain"],
    [/experience|employment|work|career/, "briefcase"],
    [/education|academic|school|university/, "graduation-cap"],
    [/project|app|portfolio/, "folder"],
    [/achievement|award|honou?r/, "award"],
    [/certif|licen[cs]e|course/, "badge-check"],
    [/language/, "languages"],
    [/volunteer|interest|hobb/, "heart"],
  ];
  for (const [re, id] of rules) if (re.test(t)) return id;
  return sec.type === "text" ? "file-text" : null;
}

/** Links get a generic icon: LinkedIn and GitHub marks are trademarks Lucide doesn't ship. */
export function linkIcon(label: string, url: string): string {
  const s = `${label} ${url}`.toLowerCase();
  if (/github|gitlab|bitbucket/.test(s)) return "code";
  if (/linkedin|twitter|x\.com|instagram|facebook/.test(s)) return "link";
  return "globe";
}
