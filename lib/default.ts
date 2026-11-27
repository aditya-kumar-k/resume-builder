import type { Resume } from "./types";

export const defaultResume: Resume = {
  name: "Alex Morgan",
  title: "Product Designer",
  email: "alex@example.com",
  phone: "+1 555 0100",
  location: "Austin, TX",
  links: [
    { id: "l1", label: "LinkedIn", url: "https://linkedin.com" },
    { id: "l2", label: "Portfolio", url: "https://example.com" },
  ],
  header: { occupationNewLine: false, contactOrder: ["email", "phone", "location"], icons: false, align: "left" },
  sections: [
    {
      id: "s1", type: "text", title: "Summary", visible: true,
      body: "Designer with 6 years of experience turning messy problems into simple, shippable interfaces.",
    },
    {
      id: "s2", type: "skills", title: "Skills", visible: true,
      groups: [
        { id: "g1", label: "Design", items: "Figma, Prototyping, User research, Design systems" },
        { id: "g2", label: "Web", items: "HTML, CSS, Accessibility, React" },
      ],
    },
    {
      id: "s3", type: "entries", title: "Projects", visible: true, subtitleInline: false,
      items: [
        {
          id: "p1", title: "Onboarding Redesign", subtitle: "Web app | Northwind", date: "", link: "https://example.com",
          bullets: "Cut onboarding time by 35%\nRan 20 usability sessions to find the drop-off points",
        },
      ],
    },
    {
      id: "s4", type: "entries", title: "Experience", visible: true, subtitleInline: true,
      items: [
        {
          id: "x1", title: "Northwind", subtitle: "Senior Product Designer", date: "01/2022 – Present", link: "",
          bullets: "Led a team of 3 designers\nBuilt and maintained the company design system",
        },
        {
          id: "x2", title: "Contoso", subtitle: "Product Designer", date: "06/2019 – 12/2021 | Remote", link: "",
          bullets: "Shipped 12 features across web and mobile",
        },
      ],
    },
    {
      id: "s5", type: "entries", title: "Education", visible: true, subtitleInline: true,
      items: [{ id: "d1", title: "BA - Graphic Design", subtitle: "University of Texas", date: "07/2019", link: "", bullets: "" }],
    },
  ],
  style: { template: "band", accent: "#9ca3af", sectionTitleColor: "#111827", ruleColor: "#9ca3af", itemTitleColor: "#111827", font: "sans", textAlign: "left", base: 10, gap: 14, band: true, bandColor: "#e5e7eb", sectionIcons: false, headingRule: true, headingGap: 4, margins: { top: 10, right: 14, bottom: 13, left: 14 }, roleFonts: {} },
};
