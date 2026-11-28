"use client";

import { useEffect, useRef, useState } from "react";
import { defaultResume } from "@/lib/default";
import { downloadBlob, safeName } from "@/lib/download";
import { FONTS, FONT_IDS, FONT_ROLES } from "@/lib/fonts";
import { ICONS } from "@/lib/icons";
import {
  initResumes,
  saveResumeDoc,
  deleteResumeDoc,
  loadResume,
  saveResumeManifest,
  setActiveResumeId,
  exportResumeJson,
  parseImportedJson,
} from "@/lib/storage";
import type { ResumeMetadata } from "@/lib/storage";
import type { HeaderDraft, MappedSectionDraft, ParseDraft } from "@/lib/pdfImport";
import { TEMPLATES, newItem, newSection, resolveColors, uid } from "@/lib/templates";
import type { ContactKey, EntriesSection, FontId, FontRole, HeaderOptions, Item, Resume, Section, SectionType, SkillsSection, Style, TemplateId, TextAlign, TextSection } from "@/lib/types";
import { Preview } from "./Preview";

const KEY = "resume-builder:v2";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function applyTag(
  textarea: HTMLTextAreaElement,
  tag: "b" | "i" | "u",
  currentValue: string,
  onChange: (val: string) => void
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  const openLen = openTag.length;
  const closeLen = closeTag.length;

  const selectedText = currentValue.substring(start, end);

  const isAlreadyWrapped =
    (selectedText.startsWith(openTag) && selectedText.endsWith(closeTag)) ||
    (start >= openLen &&
      end + closeLen <= currentValue.length &&
      currentValue.substring(start - openLen, start) === openTag &&
      currentValue.substring(end, end + closeLen) === closeTag);

  let nextValue: string;
  let nextStart: number;
  let nextEnd: number;

  if (isAlreadyWrapped) {
    if (selectedText.startsWith(openTag) && selectedText.endsWith(closeTag)) {
      const unwrapped = selectedText.slice(openLen, -closeLen);
      nextValue = currentValue.substring(0, start) + unwrapped + currentValue.substring(end);
      nextStart = start;
      nextEnd = start + unwrapped.length;
    } else {
      nextValue =
        currentValue.substring(0, start - openLen) +
        selectedText +
        currentValue.substring(end + closeLen);
      nextStart = start - openLen;
      nextEnd = nextStart + selectedText.length;
    }
  } else {
    if (selectedText.length > 0) {
      nextValue = currentValue.substring(0, start) + openTag + selectedText + closeTag + currentValue.substring(end);
      nextStart = start;
      nextEnd = end + openLen + closeLen;
    } else {
      nextValue = currentValue.substring(0, start) + openTag + closeTag + currentValue.substring(end);
      nextStart = start + openLen;
      nextEnd = nextStart;
    }
  }

  onChange(nextValue);

  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(nextStart, nextEnd);
  });
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  area?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === "b" || k === "i" || k === "u") {
        e.preventDefault();
        e.stopPropagation();
        if (textareaRef.current) {
          applyTag(textareaRef.current, k as "b" | "i" | "u", props.value, props.onChange);
        }
      }
    }
  };

  const handleToolbarClick = (tag: "b" | "i" | "u") => {
    if (textareaRef.current) {
      applyTag(textareaRef.current, tag, props.value, props.onChange);
    }
  };

  return (
    <div className="field">
      <div className="field-head">
        <span>{props.label}</span>
        {props.area && (
          <div className="format-toolbar">
            <button
              type="button"
              className="btn-format"
              title="Bold (Ctrl+B)"
              onClick={(e) => {
                e.preventDefault();
                handleToolbarClick("b");
              }}
            >
              <b>B</b>
            </button>
            <button
              type="button"
              className="btn-format"
              title="Italic (Ctrl+I)"
              onClick={(e) => {
                e.preventDefault();
                handleToolbarClick("i");
              }}
            >
              <i>I</i>
            </button>
            <button
              type="button"
              className="btn-format"
              title="Underline (Ctrl+U)"
              onClick={(e) => {
                e.preventDefault();
                handleToolbarClick("u");
              }}
            >
              <u>U</u>
            </button>
          </div>
        )}
      </div>
      {props.area ? (
        <textarea
          ref={textareaRef}
          rows={props.rows ?? 3}
          value={props.value}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <input value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      )}
    </div>
  );
}

function Chevron() {
  return (
    <svg className="chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function UpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function DownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="13" height="13" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
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
      <div className="two">
        <label className="field"><span>Bullet points alignment</span>
          <select value={sec.textAlign ?? "left"} onChange={(e) => onChange({ ...sec, textAlign: e.target.value as TextAlign })}>
            <option value="left">Left</option>
            <option value="justify">Justify</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label className="field"><span>Subtitle position (default)</span>
          <select
            value={sec.subtitleInline ? "inline" : "below"}
            onChange={(e) => onChange({ ...sec, subtitleInline: e.target.value === "inline" })}
          >
            <option value="inline">Same line as title</option>
            <option value="below">New line under title</option>
          </select>
        </label>
      </div>
      {sec.subtitleInline && (
        <Field
          label="Separator between title and subtitle (empty = none)"
          value={sec.separator ?? ""}
          placeholder="e.g.  ,  |  –  •  /  (leave empty for none)"
          onChange={(v) => onChange({ ...sec, separator: v })}
        />
      )}
      {sec.items.map((it, i) => (
        <details className="card entry" key={it.id} open={it.id === fresh}>
          <summary className="entry-summary">
            <Chevron />
            <span className="entry-title">{it.title || "Untitled entry"}</span>
            {it.date ? <span className="entry-date">{it.date}</span> : null}
            <span className="mv">
              <button
                type="button"
                className="btn-icon"
                title="Move entry up"
                aria-label="Move entry up"
                disabled={i === 0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange({ ...sec, items: move(sec.items, i, i - 1) });
                }}
              >
                <UpIcon />
              </button>
              <button
                type="button"
                className="btn-icon"
                title="Move entry down"
                aria-label="Move entry down"
                disabled={i === sec.items.length - 1}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange({ ...sec, items: move(sec.items, i, i + 1) });
                }}
              >
                <DownIcon />
              </button>
            </span>
          </summary>
          <div className="entry-body">
            <Field label="Title" value={it.title} onChange={(v) => setItem(it.id, { title: v })} />
            <div className="two">
              <Field label="Subtitle" value={it.subtitle} onChange={(v) => setItem(it.id, { subtitle: v })} />
              <Field label="Subtitle 2 (optional)" value={it.subtitle2 ?? ""} onChange={(v) => setItem(it.id, { subtitle2: v })} />
            </div>
            <label className="field"><span>Subtitle position</span>
              <select
                value={it.subtitleInline === undefined ? "" : it.subtitleInline ? "inline" : "below"}
                onChange={(e) =>
                  setItem(it.id, {
                    subtitleInline: e.target.value === "" ? undefined : e.target.value === "inline",
                  })
                }
              >
                <option value="">Same as section ({sec.subtitleInline ? "Same line" : "New line under title"})</option>
                <option value="below">New line under title</option>
                <option value="inline">Same line as title</option>
              </select>
            </label>
            <div className="two">
              <Field label="Date / place (right side)" value={it.date} onChange={(v) => setItem(it.id, { date: v })} />
              <Field label="Link on title (optional)" value={it.link} placeholder="https://" onChange={(v) => setItem(it.id, { link: v })} />
            </div>
            <Field label="Bullets (one per line)" area rows={4} value={it.bullets} onChange={(v) => setItem(it.id, { bullets: v })} />
            <label className="field"><span>Bullet alignment for this entry</span>
              <select value={it.align ?? ""} onChange={(e) => setItem(it.id, { align: e.target.value ? (e.target.value as TextAlign) : undefined })}>
                <option value="">Same as section ({sec.textAlign ?? "left"})</option>
                <option value="left">Left</option>
                <option value="justify">Justify</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
            <div className="row entry-actions">
              <button type="button" className="btn-subtle" disabled={i === 0} onClick={() => onChange({ ...sec, items: move(sec.items, i, i - 1) })}>↑ Move</button>
              <button type="button" className="btn-subtle" disabled={i === sec.items.length - 1} onClick={() => onChange({ ...sec, items: move(sec.items, i, i + 1) })}>↓ Move</button>
              <button type="button" className="danger btn-subtle" onClick={() => onChange({ ...sec, items: sec.items.filter((x) => x.id !== it.id) })}>Remove</button>
            </div>
          </div>
        </details>
      ))}
      <button
        className="btn-add-sub"
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
      <label className="field"><span>Skills alignment</span>
        <select value={sec.textAlign ?? "left"} onChange={(e) => onChange({ ...sec, textAlign: e.target.value as TextAlign })}>
          <option value="left">Left</option>
          <option value="justify">Justify</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>
      {sec.groups.map((g, i) => (
        <details className="card entry" key={g.id}>
          <summary className="entry-summary">
            <Chevron />
            <span className="entry-title">{g.label || "Untitled group"}</span>
            <span className="mv">
              <button
                type="button"
                className="btn-icon"
                title="Move group up"
                aria-label="Move group up"
                disabled={i === 0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange({ ...sec, groups: move(sec.groups, i, i - 1) });
                }}
              >
                <UpIcon />
              </button>
              <button
                type="button"
                className="btn-icon"
                title="Move group down"
                aria-label="Move group down"
                disabled={i === sec.groups.length - 1}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange({ ...sec, groups: move(sec.groups, i, i + 1) });
                }}
              >
                <DownIcon />
              </button>
            </span>
          </summary>
          <div className="entry-body">
            <Field label="Group name" value={g.label} onChange={(v) => setGroup(g.id, { label: v })} />
            <Field label="Skills (comma separated)" area value={g.items} onChange={(v) => setGroup(g.id, { items: v })} />
            <div className="row entry-actions">
              <button type="button" className="btn-subtle" disabled={i === 0} onClick={() => onChange({ ...sec, groups: move(sec.groups, i, i - 1) })}>↑ Move</button>
              <button type="button" className="btn-subtle" disabled={i === sec.groups.length - 1} onClick={() => onChange({ ...sec, groups: move(sec.groups, i, i + 1) })}>↓ Move</button>
              <button type="button" className="danger btn-subtle" onClick={() => onChange({ ...sec, groups: sec.groups.filter((x) => x.id !== g.id) })}>Remove</button>
            </div>
          </div>
        </details>
      ))}
      <button className="btn-add-sub" onClick={() => onChange({ ...sec, groups: [...sec.groups, { id: uid(), label: "Group", items: "" }] })}>+ Add group</button>
    </>
  );
}

export function Editor() {
  const [resumes, setResumes] = useState<ResumeMetadata[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [r, setR] = useState<Resume>(defaultResume);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<"" | "pdf" | "docx" | "both">("");
  const [importingPdf, setImportingPdf] = useState(false);
  const [pdfDraft, setPdfDraft] = useState<ParseDraft | null>(null);
  const [draftFileName, setDraftFileName] = useState("");
  const [error, setError] = useState("");
  const [scale, setScale] = useState(0.8);
  const [newType, setNewType] = useState<SectionType>("entries");
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { list, activeId: initId, activeResume } = initResumes();
    setResumes(list);
    setActiveId(initId);
    setR(activeResume);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !activeId) return;
    saveResumeDoc(activeId, r);
  }, [r, activeId, loaded]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 24) / 794));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const switchResume = (targetId: string) => {
    if (targetId === activeId) return;
    saveResumeDoc(activeId, r);
    const doc = loadResume(targetId);
    if (doc) {
      setActiveId(targetId);
      setActiveResumeId(targetId);
      setR(doc);
    }
  };

  const createNewResume = () => {
    const defaultName = `Resume ${resumes.length + 1}`;
    const name = window.prompt("Enter a name for the new resume:", defaultName);
    if (!name || !name.trim()) return;
    saveResumeDoc(activeId, r);
    const newId = "r_" + Math.random().toString(36).slice(2, 10);
    const newMeta: ResumeMetadata = {
      id: newId,
      name: name.trim(),
      updatedAt: Date.now(),
    };
    const nextList = [...resumes, newMeta];
    setResumes(nextList);
    saveResumeManifest(nextList);
    setActiveId(newId);
    setActiveResumeId(newId);
    setR(defaultResume);
    saveResumeDoc(newId, defaultResume);
  };

  const duplicateCurrentResume = () => {
    const current = resumes.find((x) => x.id === activeId);
    const defaultName = `${current?.name || "Resume"} (Copy)`;
    const name = window.prompt("Enter a name for the duplicate resume:", defaultName);
    if (!name || !name.trim()) return;
    saveResumeDoc(activeId, r);
    const newId = "r_" + Math.random().toString(36).slice(2, 10);
    const clone: Resume = JSON.parse(JSON.stringify(r));
    clone.sections = clone.sections.map((s) => ({
      ...s,
      id: uid(),
      ...(s.type === "skills" ? { groups: s.groups.map((g) => ({ ...g, id: uid() })) } : {}),
      ...(s.type === "entries" ? { items: s.items.map((it) => ({ ...it, id: uid() })) } : {}),
    }));
    const newMeta: ResumeMetadata = {
      id: newId,
      name: name.trim(),
      updatedAt: Date.now(),
    };
    const nextList = [...resumes, newMeta];
    setResumes(nextList);
    saveResumeManifest(nextList);
    setActiveId(newId);
    setActiveResumeId(newId);
    setR(clone);
    saveResumeDoc(newId, clone);
  };

  const renameCurrentResume = () => {
    const current = resumes.find((x) => x.id === activeId);
    if (!current) return;
    const name = window.prompt("Rename resume:", current.name);
    if (!name || !name.trim() || name.trim() === current.name) return;
    const nextList = resumes.map((item) =>
      item.id === activeId ? { ...item, name: name.trim(), updatedAt: Date.now() } : item
    );
    setResumes(nextList);
    saveResumeManifest(nextList);
  };

  const deleteCurrentResume = () => {
    if (resumes.length <= 1) return;
    const current = resumes.find((x) => x.id === activeId);
    if (!window.confirm(`Are you sure you want to delete "${current?.name || "this resume"}"?`)) return;
    deleteResumeDoc(activeId);
    const nextList = resumes.filter((item) => item.id !== activeId);
    const nextActive = nextList[0];
    setResumes(nextList);
    saveResumeManifest(nextList);
    setActiveId(nextActive.id);
    setActiveResumeId(nextActive.id);
    const nextDoc = loadResume(nextActive.id) || defaultResume;
    setR(nextDoc);
  };

  const handleExportJson = () => {
    const current = resumes.find((x) => x.id === activeId);
    exportResumeJson(current?.name || "resume", r);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsed = parseImportedJson(text);
      if (!parsed) {
        alert("Invalid resume JSON file format.");
        return;
      }
      saveResumeDoc(activeId, r);
      const fileName = file.name.replace(/\.resume\.json$/i, "").replace(/\.json$/i, "");
      const newId = "r_" + Math.random().toString(36).slice(2, 10);
      const newMeta: ResumeMetadata = {
        id: newId,
        name: fileName || "Imported Resume",
        updatedAt: Date.now(),
      };
      const nextList = [...resumes, newMeta];
      setResumes(nextList);
      saveResumeManifest(nextList);
      setActiveId(newId);
      setActiveResumeId(newId);
      setR(parsed);
      saveResumeDoc(newId, parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingPdf(true);
    setError("");

    try {
      const buffer = await file.arrayBuffer();
      const { extractPdfLines, parseDraftFromLines } = await import("@/lib/pdfImport");
      const lines = await extractPdfLines(buffer);
      if (!lines.length) {
        throw new Error("Could not extract any readable text from this PDF. It may be a scanned image.");
      }
      const draft = parseDraftFromLines(lines);
      setPdfDraft(draft);
      setDraftFileName(file.name.replace(/\.pdf$/i, "").trim());
    } catch (err: any) {
      setError(err?.message || "Failed to parse PDF. Please try another file.");
    } finally {
      setImportingPdf(false);
      e.target.value = "";
    }
  };

  const updateDraftHeader = (patch: Partial<HeaderDraft>) => {
    if (!pdfDraft) return;
    setPdfDraft({ ...pdfDraft, header: { ...pdfDraft.header, ...patch } });
  };

  const updateDraftSection = (id: string, patch: Partial<MappedSectionDraft>) => {
    if (!pdfDraft) return;
    setPdfDraft({
      ...pdfDraft,
      sections: pdfDraft.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const removeDraftSection = (id: string) => {
    if (!pdfDraft) return;
    setPdfDraft({
      ...pdfDraft,
      sections: pdfDraft.sections.filter((s) => s.id !== id),
    });
  };

  const addEmptyDraftSection = () => {
    if (!pdfDraft) return;
    setPdfDraft({
      ...pdfDraft,
      sections: [
        ...pdfDraft.sections,
        {
          id: uid(),
          title: "New Section",
          type: "entries",
          lines: [],
        },
      ],
    });
  };

  const applyDraftToBuilder = async () => {
    if (!pdfDraft) return;
    try {
      const { compileResumeFromDraft } = await import("@/lib/pdfImport");
      const parsed = compileResumeFromDraft(pdfDraft);

      const resumeName = parsed.name
        ? `${parsed.name}'s Resume (PDF)`
        : draftFileName || "Imported Resume";

      saveResumeDoc(activeId, r);
      const newId = "r_" + Math.random().toString(36).slice(2, 10);
      const newMeta: ResumeMetadata = {
        id: newId,
        name: resumeName,
        updatedAt: Date.now(),
      };
      const nextList = [...resumes, newMeta];
      setResumes(nextList);
      saveResumeManifest(nextList);
      setActiveId(newId);
      setActiveResumeId(newId);
      setR(parsed);
      saveResumeDoc(newId, parsed);
      setPdfDraft(null);
    } catch (err: any) {
      setError(err?.message || "Failed to apply imported sections.");
    }
  };

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
  const colors = resolveColors(st);
  const labelOf: Record<ContactKey, string> = { email: "Email", phone: "Phone", location: "Location" };

  return (
    <div className="app">
      <aside className="panel">
        <div className="brand-header">
          <div className="brand-title-wrap">
            <h1>Resume Builder</h1>
            <span className="brand-pill">Client-side · Private</span>
          </div>
        </div>

        <div className="resume-manager-card">
          <div className="resume-manager-header">
            <span className="resume-manager-label">SAVED RESUMES</span>
            <div className="resume-header-actions">
              <label className="btn-import-pdf" title="Import an existing resume from a PDF file">
                {importingPdf ? "Parsing…" : "Import PDF"}
                <input
                  type="file"
                  accept=".pdf"
                  disabled={importingPdf}
                  onChange={handleImportPdf}
                  style={{ display: "none" }}
                />
              </label>
              <span className="resume-count-badge">{resumes.length} saved</span>
            </div>
          </div>
          <div className="resume-select-row">
            <select
              className="resume-select"
              value={activeId}
              onChange={(e) => switchResume(e.target.value)}
              title="Switch active resume"
            >
              {resumes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="resume-actions-group">
              <button
                type="button"
                className="btn-icon"
                onClick={createNewResume}
                title="Create new blank resume"
                aria-label="New resume"
              >
                <PlusIcon />
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={duplicateCurrentResume}
                title="Duplicate current resume as a copy"
                aria-label="Duplicate resume"
              >
                <CopyIcon />
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={renameCurrentResume}
                title="Rename current resume"
                aria-label="Rename resume"
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                className="btn-icon danger"
                onClick={deleteCurrentResume}
                disabled={resumes.length <= 1}
                title={resumes.length <= 1 ? "Cannot delete the only resume" : "Delete current resume"}
                aria-label="Delete resume"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        </div>

        <details className="card acc-root" open>
          <summary className="acc-summary">
            <Chevron />
            <span>Design</span>
          </summary>
          <div className="acc-body">
            <div className="templates">
              {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => (
                <button key={id} className={st.template === id ? "tpl on" : "tpl"} onClick={() => pickTemplate(id)}>
                  <b>{TEMPLATES[id].name}</b>
                  <small>{TEMPLATES[id].description}</small>
                </button>
              ))}
            </div>
            <div className="two">
              <label className="field"><span>Base font</span>
                <select value={st.font} onChange={(e) => setStyle({ font: e.target.value as FontId })}>
                  {FONT_IDS.map((id) => <option key={id} value={id}>{FONTS[id].label}</option>)}
                </select>
              </label>
              <label className="field"><span>Text size: {st.base} pt</span>
                <input type="range" min={8} max={12} step={0.5} value={st.base} onChange={(e) => setStyle({ base: Number(e.target.value) })} />
              </label>
            </div>

            <div className="color-section-group">
              <div className="color-section-head">
                <span className="field-group-title">Colors</span>
                <button
                  type="button"
                  className="btn-subtle btn-reset-colors"
                  onClick={() =>
                    setStyle({
                      sectionTitleColor: TEMPLATES[st.template].defaults.sectionTitleColor,
                      ruleColor: TEMPLATES[st.template].defaults.ruleColor,
                      itemTitleColor: TEMPLATES[st.template].defaults.itemTitleColor,
                      accent: TEMPLATES[st.template].defaults.accent,
                    })
                  }
                  title="Reset colors to template preset"
                >
                  Reset defaults
                </button>
              </div>
              <div className="colors-grid">
                <label className="field">
                  <span>Section titles</span>
                  <div className="color-picker-wrap">
                    <input
                      type="color"
                      value={colors.sectionTitleColor}
                      onChange={(e) => setStyle({ sectionTitleColor: e.target.value })}
                    />
                    <span className="color-hex">{colors.sectionTitleColor}</span>
                  </div>
                </label>
                <label className="field">
                  <span>Separator / rule</span>
                  <div className="color-picker-wrap">
                    <input
                      type="color"
                      value={colors.ruleColor}
                      onChange={(e) => setStyle({ ruleColor: e.target.value, accent: e.target.value })}
                    />
                    <span className="color-hex">{colors.ruleColor}</span>
                  </div>
                </label>
                <label className="field">
                  <span>Entry titles</span>
                  <div className="color-picker-wrap">
                    <input
                      type="color"
                      value={colors.itemTitleColor}
                      onChange={(e) => setStyle({ itemTitleColor: e.target.value })}
                    />
                    <span className="color-hex">{colors.itemTitleColor}</span>
                  </div>
                </label>
              </div>
            </div>
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
              <button className="btn-subtle" onClick={() => setStyle({ margins: defaultResume.style.margins })}>Reset margins</button>
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
              <button className="btn-subtle" onClick={() => setStyle({ roleFonts: {} })}>Reset all to base font</button>
            </details>
          </div>
        </details>

        <details className="card acc-root" open>
          <summary className="acc-summary">
            <Chevron />
            <span>Header</span>
          </summary>
          <div className="acc-body">
            <Field label="Full name" value={r.name} onChange={(v) => set("name", v)} />
            <Field label="Occupation" value={r.title} onChange={(v) => set("title", v)} />
            <div className="two">
              <label className="field"><span>Header alignment</span>
                <select value={r.header.align} onChange={(e) => setHeader({ align: e.target.value as "left" | "center" | "right" })}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label className="field"><span>Occupation position</span>
                <select
                  value={r.header.occupationNewLine ? "below" : "inline"}
                  onChange={(e) => setHeader({ occupationNewLine: e.target.value === "below" })}
                >
                  <option value="inline">Same line as name</option>
                  <option value="below">New line under name</option>
                </select>
              </label>
            </div>
            <Field label="Email" value={r.email} onChange={(v) => set("email", v)} />
            <Field label="Phone" value={r.phone} onChange={(v) => set("phone", v)} />
            <Field label="Location" value={r.location} onChange={(v) => set("location", v)} />
            <label className="field"><span>Order on the contact line</span></label>
            {r.header.contactOrder.map((key, i) => (
              <div className="row order" key={key}>
                <span>{i + 1}. {labelOf[key]}</span>
                <button className="btn-icon" disabled={i === 0} onClick={() => setHeader({ contactOrder: move(r.header.contactOrder, i, i - 1) })}><UpIcon /></button>
                <button className="btn-icon" disabled={i === r.header.contactOrder.length - 1} onClick={() => setHeader({ contactOrder: move(r.header.contactOrder, i, i + 1) })}><DownIcon /></button>
              </div>
            ))}
            <label className="check"><input type="checkbox" checked={r.header.icons} onChange={(e) => setHeader({ icons: e.target.checked })} />Show icons in the header (PDF and preview; Word stays plain)</label>
            <p className="hint">Links appear after the location, all on one line.</p>
            {r.links.map((l, i) => (
              <div className="row link" key={l.id}>
                <select
                  value={l.icon ?? ""}
                  title="Icon"
                  style={{ width: "auto", flex: "0 0 88px", padding: "7px 4px", fontSize: 12 }}
                  onChange={(e) => set("links", r.links.map((x) => (x.id === l.id ? { ...x, icon: e.target.value || undefined } : x)))}
                >
                  <option value="">Auto</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="github">GitHub</option>
                  <option value="globe">Globe</option>
                  <option value="link">Link</option>
                  <option value="code">Code</option>
                </select>
                <input value={l.label} placeholder="Label" onChange={(e) => set("links", r.links.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))} />
                <input value={l.url} placeholder="https://" onChange={(e) => set("links", r.links.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))} />
                <button className="btn-icon" disabled={i === 0} onClick={() => set("links", move(r.links, i, i - 1))}><UpIcon /></button>
                <button className="btn-icon danger" onClick={() => set("links", r.links.filter((x) => x.id !== l.id))}>✕</button>
              </div>
            ))}
            <button className="btn-add-sub" onClick={() => set("links", [...r.links, { id: uid(), label: "", url: "" }])}>+ Add link</button>
          </div>
        </details>

        <div className="section-head-bar">
          <h2>Sections</h2>
          <span className="section-count">{r.sections.length}</span>
        </div>

        <div className="sections-list">
          {r.sections.map((sec, i) => (
            <details className={`card sec ${sec.visible ? "" : "off"}`} key={sec.id}>
              <summary className="sec-summary">
                <Chevron />
                <span className="sec-title">{sec.title || "Untitled"}</span>
                <span className={`sec-badge ${sec.visible ? "" : "hidden"}`}>
                  {sec.type}
                  {!sec.visible && " · hidden"}
                </span>
                <span className="mv">
                  <button
                    className="btn-icon"
                    title="Move section up"
                    aria-label="Move section up"
                    disabled={i === 0}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      set("sections", move(r.sections, i, i - 1));
                    }}
                  >
                    <UpIcon />
                  </button>
                  <button
                    className="btn-icon"
                    title="Move section down"
                    aria-label="Move section down"
                    disabled={i === r.sections.length - 1}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      set("sections", move(r.sections, i, i + 1));
                    }}
                  >
                    <DownIcon />
                  </button>
                </span>
              </summary>
              <div className="sec-body">
                <Field label="Section title" value={sec.title} onChange={(v) => setSection({ ...sec, title: v })} />
                <label className="field"><span>Icon (shown when section icons are on)</span>
                  <select value={sec.icon ?? ""} onChange={(e) => setSection({ ...sec, icon: e.target.value || undefined } as Section)}>
                    <option value="">Automatic (from the title)</option>
                    <option value="none">No icon</option>
                    {Object.entries(ICONS).map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}
                  </select>
                </label>
                <div className="two">
                  <label className="field"><span>Line under heading</span>
                    <select value={sec.rule ?? ""} onChange={(e) => setSection({ ...sec, rule: e.target.value ? (e.target.value as "show" | "hide") : undefined } as Section)}>
                      <option value="">Same as design ({st.headingRule ? "shown" : "hidden"})</option>
                      <option value="show">Always show</option>
                      <option value="hide">Always hide</option>
                    </select>
                  </label>
                  <label className="field"><span>Space under heading, pt</span>
                    <input
                      type="number" min={0} max={30} step={1} value={sec.headingGap ?? ""} placeholder={String(st.headingGap)}
                      onChange={(e) => setSection({ ...sec, headingGap: e.target.value === "" ? undefined : Math.max(0, Math.min(30, Number(e.target.value))) } as Section)}
                    />
                  </label>
                </div>
                <div className="row sec-actions">
                  <label className="check"><input type="checkbox" checked={sec.visible} onChange={(e) => setSection({ ...sec, visible: e.target.checked })} />Visible in resume</label>
                  <button className="danger btn-del" onClick={() => set("sections", r.sections.filter((x) => x.id !== sec.id))}>Delete section</button>
                </div>
                {sec.type === "text" && (
                  <>
                    <label className="field"><span>Text alignment</span>
                      <select value={sec.textAlign ?? "left"} onChange={(e) => setSection({ ...sec, textAlign: e.target.value as TextAlign } as Section)}>
                        <option value="left">Left</option>
                        <option value="justify">Justify</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                    <Field label="Text (HTML works: <b> <i> <u> <a href> <br> <p> <ul><li>)" area rows={6} value={sec.body} onChange={(v) => setSection({ ...(sec as TextSection), body: v })} />
                  </>
                )}
                {sec.type === "skills" && <SkillsEditor sec={sec} onChange={setSection} />}
                {sec.type === "entries" && <EntriesEditor sec={sec} onChange={setSection} />}
              </div>
            </details>
          ))}
        </div>

        <div className="row add-section-bar">
          <select value={newType} onChange={(e) => setNewType(e.target.value as SectionType)}>
            <option value="entries">Entries (jobs, projects, education, awards)</option>
            <option value="skills">Skills (grouped)</option>
            <option value="text">Text (summary, about)</option>
          </select>
          <button className="btn-add-primary" onClick={() => set("sections", [...r.sections, newSection(newType)])}>+ Add section</button>
        </div>

        <section className="export-card">
          <h2>Download</h2>
          <button className="primary" disabled={!!busy} onClick={() => void exportFiles("both")}>
            {busy === "both" ? "Preparing…" : "Download PDF + Word"}
          </button>
          <div className="row">
            <button className="secondary" disabled={!!busy} onClick={() => void exportFiles("pdf")}>{busy === "pdf" ? "…" : "PDF only"}</button>
            <button className="secondary" disabled={!!busy} onClick={() => void exportFiles("docx")}>{busy === "docx" ? "…" : "Word only"}</button>
          </div>
          {error && <p role="alert" className="err">{error}</p>}
          <p className="hint">Word uses one simple column so applicant systems read it cleanly. Everything stays in your browser.</p>
          <div className="backup-row">
            <label className="btn-subtle file-btn" title="Import an existing resume from a PDF file">
              {importingPdf ? "Parsing PDF…" : "Import PDF"}
              <input type="file" accept=".pdf" disabled={importingPdf} onChange={handleImportPdf} style={{ display: "none" }} />
            </label>
            <button type="button" className="btn-subtle" onClick={handleExportJson} title="Save a .json backup file of this resume">
              Backup (.json)
            </button>
            <label className="btn-subtle file-btn" title="Restore a resume from a .json backup">
              Restore (.json)
              <input type="file" accept=".json" onChange={handleImportJson} style={{ display: "none" }} />
            </label>
          </div>
        </section>
      </aside>

      <main className="stage" ref={wrap}>
        <div style={{ zoom: scale }}>
          <Preview r={r} />
        </div>
      </main>

      {pdfDraft && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h3>Review & Map PDF Sections</h3>
                <p className="modal-subtitle">
                  Verify detected sections and choose how each section should be formatted in the builder.
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setPdfDraft(null)}
                title="Cancel"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="draft-header-section">
                <span className="field-group-title">Contact & Header</span>
                <div className="two">
                  <label className="field">
                    <span>Full Name</span>
                    <input
                      type="text"
                      value={pdfDraft.header.name}
                      onChange={(e) => updateDraftHeader({ name: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Occupation / Title</span>
                    <input
                      type="text"
                      value={pdfDraft.header.title}
                      onChange={(e) => updateDraftHeader({ title: e.target.value })}
                    />
                  </label>
                </div>
                <div className="two">
                  <label className="field">
                    <span>Email</span>
                    <input
                      type="text"
                      value={pdfDraft.header.email}
                      onChange={(e) => updateDraftHeader({ email: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Phone</span>
                    <input
                      type="text"
                      value={pdfDraft.header.phone}
                      onChange={(e) => updateDraftHeader({ phone: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              <div className="draft-sections-list">
                <div className="draft-sections-head">
                  <span className="field-group-title">Sections ({pdfDraft.sections.length})</span>
                  <button
                    type="button"
                    className="btn-subtle"
                    onClick={addEmptyDraftSection}
                  >
                    + Add Section
                  </button>
                </div>

                {pdfDraft.sections.map((sec) => (
                  <div key={sec.id} className={`draft-section-item ${sec.type === "skip" ? "skipped" : ""}`}>
                    <div className="draft-section-row">
                      <input
                        type="text"
                        className="draft-section-title"
                        value={sec.title}
                        placeholder="Section Title (e.g. Projects, Skills)"
                        onChange={(e) => updateDraftSection(sec.id, { title: e.target.value })}
                      />
                      <select
                        className="draft-section-type"
                        value={sec.type}
                        onChange={(e) => updateDraftSection(sec.id, { type: e.target.value as any })}
                      >
                        <option value="entries">Entries (Projects, Experience, Education)</option>
                        <option value="skills">Skills (Grouped / Categorized)</option>
                        <option value="text">Text (Summary, About)</option>
                        <option value="skip">Skip / Don't Import</option>
                      </select>
                      <button
                        type="button"
                        className="btn-icon danger"
                        title="Remove this section"
                        onClick={() => removeDraftSection(sec.id)}
                      >
                        <TrashIcon />
                      </button>
                    </div>

                    {sec.type !== "skip" && (
                      <div className="draft-section-preview">
                        <div className="draft-preview-lines">
                          {sec.lines.slice(0, 4).map((line, li) => (
                            <div key={li} className="draft-line-snippet">
                              {line}
                            </div>
                          ))}
                          {sec.lines.length > 4 && (
                            <div className="draft-line-snippet more">
                              + {sec.lines.length - 4} more lines
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary"
                onClick={() => setPdfDraft(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={applyDraftToBuilder}
              >
                Apply to Builder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
