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
  linkedin: {
    label: "LinkedIn",
    node: [
      ["path", { d: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" }],
      ["rect", { width: "4", height: "12", x: "2", y: "9" }],
      ["circle", { cx: "4", cy: "4", r: "2" }],
    ],
  },
  github: {
    label: "GitHub",
    node: [
      ["path", { d: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" }],
    ],
  },
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

/** Links get a relevant icon: matches GitHub, LinkedIn, etc., or defaults to globe/link. */
export function linkIcon(label: string, url: string): string {
  const s = `${label} ${url}`.toLowerCase();
  if (/github/.test(s)) return "github";
  if (/linkedin/.test(s)) return "linkedin";
  if (/gitlab|bitbucket/.test(s)) return "code";
  if (/twitter|x\.com|instagram|facebook/.test(s)) return "link";
  return "globe";
}
