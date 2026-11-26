"use client";

import { useEffect, useRef, useState } from "react";
import { defaultResume } from "@/lib/default";
import { downloadBlob, safeName } from "@/lib/download";
import { FONTS, FONT_IDS, FONT_ROLES } from "@/lib/fonts";
import { ICONS } from "@/lib/icons";
import { TEMPLATES, newItem, newSection, uid } from "@/lib/templates";
import type { ContactKey, EntriesSection, FontId, FontRole, HeaderOptions, Item, Resume, Section, SectionType, SkillsSection, Style, TemplateId, TextSection } from "@/lib/types";
import { Preview } from "./Preview";

const KEY = "resume-builder:v2";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Field(props: { label: string; value: string; onChange: (v: string) => void; area?: boolean; rows?: number; placeholder?: string }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.area ? (
        <textarea rows={props.rows ?? 3} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      ) : (
        <input value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      )}
    </label>
  );
}

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
};

function EntriesEditor({ sec, onChange }: { sec: EntriesSection; onChange: (s: EntriesSection) => void }) {
  const setItem = (id: string, patch: Partial<Item>) =>
    onChange({ ...sec, items: sec.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  /** The entry just added opens by itself; every other entry starts folded. */
  const [fresh, setFresh] = useState("");
  return (
    <>
      <label className="check">
        <input type="checkbox" checked={sec.subtitleInline} onChange={(e) => onChange({ ...sec, subtitleInline: e.target.checked })} />
        Put the subtitle on the same line as the title
      </label>
      {sec.subtitleInline && (
        <Field
          label="Separator between title and subtitle (empty = none)"
          value={sec.separator ?? ","}
          placeholder="e.g.  ,  |  –  •  /"
          onChange={(v) => onChange({ ...sec, separator: v })}
        />
      )}
      {sec.items.map((it, i) => (
        <details className="card entry" key={it.id} open={it.id === fresh}>
          <summary>
            {it.title || "Untitled entry"}
            {it.date ? <small> · {it.date}</small> : null}
          </summary>
          <Field label="Title" value={it.title} onChange={(v) => setItem(it.id, { title: v })} />
          <Field label="Subtitle" value={it.subtitle} onChange={(v) => setItem(it.id, { subtitle: v })} />
          <div className="two">
            <Field label="Date / place (right side)" value={it.date} onChange={(v) => setItem(it.id, { date: v })} />
            <Field label="Link on title (optional)" value={it.link} placeholder="https://" onChange={(v) => setItem(it.id, { link: v })} />
          </div>
          <Field label="Bullets (one per line)" area rows={4} value={it.bullets} onChange={(v) => setItem(it.id, { bullets: v })} />
          <div className="row">
            <button disabled={i === 0} onClick={() => onChange({ ...sec, items: move(sec.items, i, i - 1) })}>↑</button>
            <button disabled={i === sec.items.length - 1} onClick={() => onChange({ ...sec, items: move(sec.items, i, i + 1) })}>↓</button>
            <button className="danger" onClick={() => onChange({ ...sec, items: sec.items.filter((x) => x.id !== it.id) })}>Remove</button>
          </div>
        </details>
      ))}
      <button
        onClick={() => {
          const item = newItem();
          setFresh(item.id);
          onChange({ ...sec, items: [...sec.items, item] });
        }}
      >
        + Add entry
      </button>
    </>
  );
}

function SkillsEditor({ sec, onChange }: { sec: SkillsSection; onChange: (s: SkillsSection) => void }) {
  const setGroup = (id: string, patch: { label?: string; items?: string }) =>
    onChange({ ...sec, groups: sec.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  return (
    <>
      {sec.groups.map((g, i) => (
        <details className="card entry" key={g.id}>
          <summary>{g.label || "Untitled group"}</summary>
          <Field label="Group name" value={g.label} onChange={(v) => setGroup(g.id, { label: v })} />
          <Field label="Skills (comma separated)" area value={g.items} onChange={(v) => setGroup(g.id, { items: v })} />
          <div className="row">
            <button disabled={i === 0} onClick={() => onChange({ ...sec, groups: move(sec.groups, i, i - 1) })}>↑</button>
            <button disabled={i === sec.groups.length - 1} onClick={() => onChange({ ...sec, groups: move(sec.groups, i, i + 1) })}>↓</button>
            <button className="danger" onClick={() => onChange({ ...sec, groups: sec.groups.filter((x) => x.id !== g.id) })}>Remove</button>
          </div>
        </details>
      ))}
      <button onClick={() => onChange({ ...sec, groups: [...sec.groups, { id: uid(), label: "Group", items: "" }] })}>+ Add group</button>
    </>
  );
}

export function Editor() {
  const [r, setR] = useState<Resume>(defaultResume);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<"" | "pdf" | "docx" | "both">("");
  const [error, setError] = useState("");
  const [scale, setScale] = useState(0.8);
  const [newType, setNewType] = useState<SectionType>("entries");
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const p = JSON.parse(saved) as Partial<Resume>;
        setR({ ...defaultResume, ...p, style: { ...defaultResume.style, ...p.style }, header: { ...defaultResume.header, ...p.header } });
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(r));
    } catch {}
  }, [r, loaded]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 24) / 794));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const set = <K extends keyof Resume>(key: K, value: Resume[K]) => setR((prev) => ({ ...prev, [key]: value }));
  const setStyle = (patch: Partial<Style>) => setR((prev) => ({ ...prev, style: { ...prev.style, ...patch } }));
  const setSection = (next: Section) => setR((prev) => ({ ...prev, sections: prev.sections.map((s) => (s.id === next.id ? next : s)) }));

  const setHeader = (patch: Partial<HeaderOptions>) => setR((prev) => ({ ...prev, header: { ...prev.header, ...patch } }));
  const setRoleFont = (role: FontRole, value: string) =>
    setR((prev) => {
      const roleFonts = { ...prev.style.roleFonts };
      if (value) roleFonts[role] = value as FontId;
      else delete roleFonts[role];
      return { ...prev, style: { ...prev.style, roleFonts } };
    });

  const pickTemplate = (id: TemplateId) => setStyle({ template: id, ...TEMPLATES[id].defaults });

  const exportFiles = async (kind: "pdf" | "docx" | "both") => {
    setBusy(kind);
    setError("");
    try {
      const base = safeName(r.name);
      if (kind !== "docx") {
        const { createPdfBlob } = await import("@/lib/exportPdf");
        downloadBlob(await createPdfBlob(r), `${base}.pdf`);
      }
      if (kind === "both") await wait(400);
      if (kind !== "pdf") {
        const { createDocxBlob } = await import("@/lib/exportDocx");
        downloadBlob(await createDocxBlob(r), `${base}.docx`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed. Try again.");
    }
    setBusy("");
  };

  const st = r.style;
  const labelOf: Record<ContactKey, string> = { email: "Email", phone: "Phone", location: "Location" };

  return (
    <div className="app">
      <aside className="panel">
        <h1>Resume Builder</h1>

        <details open>
          <summary>Design</summary>
          <div className="templates">
            {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => (
              <button key={id} className={st.template === id ? "tpl on" : "tpl"} onClick={() => pickTemplate(id)}>
                <b>{TEMPLATES[id].name}</b>
                <small>{TEMPLATES[id].description}</small>
              </button>
            ))}
          </div>
          <div className="two">
            <label className="field"><span>Accent / rule colour</span><input type="color" value={st.accent} onChange={(e) => setStyle({ accent: e.target.value })} /></label>
            <label className="field"><span>Base font</span>
              <select value={st.font} onChange={(e) => setStyle({ font: e.target.value as FontId })}>
                {FONT_IDS.map((id) => <option key={id} value={id}>{FONTS[id].label}</option>)}
              </select>
            </label>
          </div>
          <label className="field"><span>Text size: {st.base} pt</span>
            <input type="range" min={8} max={12} step={0.5} value={st.base} onChange={(e) => setStyle({ base: Number(e.target.value) })} /></label>
          <label className="field"><span>Space between a heading and its content: {st.headingGap} pt</span>
            <input type="range" min={0} max={16} step={1} value={st.headingGap} onChange={(e) => setStyle({ headingGap: Number(e.target.value) })} /></label>
          <div className="field"><span>Page margins (mm)</span>
            <div className="margins">
              {(["top", "right", "bottom", "left"] as const).map((side) => (
                <label key={side} className="field">
                  <span>{side[0]?.toUpperCase() + side.slice(1)}</span>
                  <input
                    type="number" min={0} max={40} step={1} value={st.margins[side]}
                    onChange={(e) => setStyle({ margins: { ...st.margins, [side]: Math.max(0, Math.min(40, Number(e.target.value) || 0)) } })}
                  />
                </label>
              ))}
            </div>
            <button onClick={() => setStyle({ margins: defaultResume.style.margins })}>Reset margins</button>
          </div>
          <label className="field"><span>Space between sections: {st.gap} pt</span>
            <input type="range" min={4} max={24} step={1} value={st.gap} onChange={(e) => setStyle({ gap: Number(e.target.value) })} /></label>
          <div className="two">
            <label className="check"><input type="checkbox" checked={st.band} onChange={(e) => setStyle({ band: e.target.checked })} />Header band</label>
            <label className="field"><span>Band colour</span><input type="color" value={st.bandColor} onChange={(e) => setStyle({ bandColor: e.target.value })} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={st.sectionIcons} onChange={(e) => setStyle({ sectionIcons: e.target.checked })} />Show icons beside section headings</label>
          <label className="check"><input type="checkbox" checked={st.headingRule} onChange={(e) => setStyle({ headingRule: e.target.checked })} />Show the line under section headings</label>
          <details className="inner">
            <summary>Fonts for each kind of text</summary>
            <p className="hint">Anything left on “Same as base” follows the base font. Word shows these fonts only where they are installed.</p>
            {FONT_ROLES.map((role) => (
              <label className="field" key={role.id}>
                <span>{role.label}</span>
                <select value={st.roleFonts[role.id] ?? ""} onChange={(e) => setRoleFont(role.id, e.target.value)}>
                  <option value="">Same as base</option>
                  {FONT_IDS.map((id) => <option key={id} value={id}>{FONTS[id].label}</option>)}
                </select>
              </label>
            ))}
            <button onClick={() => setStyle({ roleFonts: {} })}>Reset all to base font</button>
          </details>
        </details>

        <details open>
          <summary>Header</summary>
          <Field label="Full name" value={r.name} onChange={(v) => set("name", v)} />
          <Field label="Occupation" value={r.title} onChange={(v) => set("title", v)} />
          <label className="field"><span>Header alignment</span>
            <select value={r.header.align} onChange={(e) => setHeader({ align: e.target.value as "left" | "center" })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={r.header.occupationNewLine} onChange={(e) => setHeader({ occupationNewLine: e.target.checked })} />Occupation on its own line under the name</label>
          <Field label="Email" value={r.email} onChange={(v) => set("email", v)} />
          <Field label="Phone" value={r.phone} onChange={(v) => set("phone", v)} />
          <Field label="Location" value={r.location} onChange={(v) => set("location", v)} />
          <label className="field"><span>Order on the contact line</span></label>
          {r.header.contactOrder.map((key, i) => (
            <div className="row order" key={key}>
              <span>{i + 1}. {labelOf[key]}</span>
              <button disabled={i === 0} onClick={() => setHeader({ contactOrder: move(r.header.contactOrder, i, i - 1) })}>↑</button>
              <button disabled={i === r.header.contactOrder.length - 1} onClick={() => setHeader({ contactOrder: move(r.header.contactOrder, i, i + 1) })}>↓</button>
            </div>
          ))}
          <label className="check"><input type="checkbox" checked={r.header.icons} onChange={(e) => setHeader({ icons: e.target.checked })} />Show icons in the header (PDF and preview; Word stays plain)</label>
          <p className="hint">Links appear after the location, all on one line.</p>
          {r.links.map((l, i) => (
            <div className="row link" key={l.id}>
              <input value={l.label} placeholder="Label" onChange={(e) => set("links", r.links.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))} />
              <input value={l.url} placeholder="https://" onChange={(e) => set("links", r.links.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))} />
              <button disabled={i === 0} onClick={() => set("links", move(r.links, i, i - 1))}>↑</button>
              <button className="danger" onClick={() => set("links", r.links.filter((x) => x.id !== l.id))}>✕</button>
            </div>
          ))}
          <button onClick={() => set("links", [...r.links, { id: uid(), label: "", url: "" }])}>+ Add link</button>
        </details>

        <h2>Sections</h2>
        {r.sections.map((sec, i) => (
          <details className={sec.visible ? "sec" : "sec off"} key={sec.id}>
            <summary>
              <span className="mv">
                <button
                  title="Move section up" aria-label="Move section up" disabled={i === 0}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); set("sections", move(r.sections, i, i - 1)); }}
                >↑</button>
                <button
                  title="Move section down" aria-label="Move section down" disabled={i === r.sections.length - 1}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); set("sections", move(r.sections, i, i + 1)); }}
                >↓</button>
              </span>
              {sec.title || "Untitled"} <small>({sec.type}{sec.visible ? "" : ", hidden"})</small>
            </summary>
            <Field label="Section title" value={sec.title} onChange={(v) => setSection({ ...sec, title: v })} />
            <label className="field"><span>Icon (shown when section icons are on)</span>
              <select value={sec.icon ?? ""} onChange={(e) => setSection({ ...sec, icon: e.target.value || undefined } as Section)}>
                <option value="">Automatic (from the title)</option>
                <option value="none">No icon</option>
                {Object.entries(ICONS).map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}
              </select>
            </label>
            <label className="field"><span>Line under this heading</span>
              <select value={sec.rule ?? ""} onChange={(e) => setSection({ ...sec, rule: e.target.value ? (e.target.value as "show" | "hide") : undefined } as Section)}>
                <option value="">Same as design ({st.headingRule ? "shown" : "hidden"})</option>
                <option value="show">Always show</option>
                <option value="hide">Always hide</option>
              </select>
            </label>
            <label className="field"><span>Space under this heading, pt (empty = same as design, {st.headingGap})</span>
              <input
                type="number" min={0} max={30} step={1} value={sec.headingGap ?? ""} placeholder={String(st.headingGap)}
                onChange={(e) => setSection({ ...sec, headingGap: e.target.value === "" ? undefined : Math.max(0, Math.min(30, Number(e.target.value))) } as Section)}
              />
            </label>
            <div className="row">
              <label className="check"><input type="checkbox" checked={sec.visible} onChange={(e) => setSection({ ...sec, visible: e.target.checked })} />Show</label>
              <button className="danger" onClick={() => set("sections", r.sections.filter((x) => x.id !== sec.id))}>Delete</button>
            </div>
            {sec.type === "text" && <Field label="Text (HTML works: <b> <i> <u> <a href> <br> <p> <ul><li>)" area rows={6} value={sec.body} onChange={(v) => setSection({ ...(sec as TextSection), body: v })} />}
            {sec.type === "skills" && <SkillsEditor sec={sec} onChange={setSection} />}
            {sec.type === "entries" && <EntriesEditor sec={sec} onChange={setSection} />}
          </details>
        ))}
        <div className="row add">
          <select value={newType} onChange={(e) => setNewType(e.target.value as SectionType)}>
            <option value="entries">Entries (jobs, projects, education, awards)</option>
            <option value="skills">Skills (grouped)</option>
            <option value="text">Text (summary, about)</option>
          </select>
          <button onClick={() => set("sections", [...r.sections, newSection(newType)])}>+ Add section</button>
        </div>

        <section className="export">
          <h2>Download</h2>
          <button className="primary" disabled={!!busy} onClick={() => void exportFiles("both")}>
            {busy === "both" ? "Preparing…" : "Download PDF + Word"}
          </button>
          <div className="row">
            <button disabled={!!busy} onClick={() => void exportFiles("pdf")}>{busy === "pdf" ? "…" : "PDF only"}</button>
            <button disabled={!!busy} onClick={() => void exportFiles("docx")}>{busy === "docx" ? "…" : "Word only"}</button>
          </div>
          {error && <p role="alert" className="err">{error}</p>}
          <p className="hint">Word uses one simple column so applicant systems read it cleanly. Everything stays in your browser.</p>
        </section>
      </aside>

      <main className="stage" ref={wrap}>
        <div style={{ zoom: scale }}>
          <Preview r={r} />
        </div>
      </main>
    </div>
  );
}
