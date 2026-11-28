import type { Resume } from "./types";
import { defaultResume } from "./default";

export type ResumeMetadata = {
  id: string;
  name: string;
  updatedAt: number;
};

const MANIFEST_KEY = "resume-builder:manifest:v1";
const ACTIVE_ID_KEY = "resume-builder:active-id:v1";
const DOC_PREFIX = "resume-builder:doc:";
const LEGACY_KEY = "resume-builder:v2";

export function getResumeManifest(): ResumeMetadata[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveResumeManifest(list: ResumeMetadata[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(list));
  } catch {}
}

export function getActiveResumeId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(ACTIVE_ID_KEY) || "";
  } catch {}
  return "";
}

export function setActiveResumeId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_ID_KEY, id);
  } catch {}
}

export function loadResume(id: string): Resume | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${DOC_PREFIX}${id}`);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Resume>;
      return {
        ...defaultResume,
        ...p,
        style: { ...defaultResume.style, ...p.style },
        header: { ...defaultResume.header, ...p.header },
      };
    }
  } catch {}
  return null;
}

export function saveResumeDoc(id: string, r: Resume): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${DOC_PREFIX}${id}`, JSON.stringify(r));
    // Also keep legacy key updated so single-resume expectations remain intact
    localStorage.setItem(LEGACY_KEY, JSON.stringify(r));
  } catch {}
}

export function deleteResumeDoc(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${DOC_PREFIX}${id}`);
  } catch {}
}

/** Initializes resume manager state: migrates existing legacy resume or creates a default one */
export function initResumes(): { list: ResumeMetadata[]; activeId: string; activeResume: Resume } {
  let list = getResumeManifest();
  let activeId = getActiveResumeId();

  if (!list.length) {
    let initialResume: Resume = defaultResume;
    try {
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        const p = JSON.parse(legacyRaw) as Partial<Resume>;
        initialResume = {
          ...defaultResume,
          ...p,
          style: { ...defaultResume.style, ...p.style },
          header: { ...defaultResume.header, ...p.header },
        };
      }
    } catch {}

    const initialId = "r_" + Math.random().toString(36).slice(2, 10);
    const initialName = initialResume.name ? `${initialResume.name}'s Resume` : "My Resume";
    const initialMeta: ResumeMetadata = {
      id: initialId,
      name: initialName,
      updatedAt: Date.now(),
    };

    list = [initialMeta];
    activeId = initialId;
    saveResumeManifest(list);
    setActiveResumeId(activeId);
    saveResumeDoc(initialId, initialResume);
    return { list, activeId, activeResume: initialResume };
  }

  // Ensure activeId exists in manifest
  if (!list.some((item) => item.id === activeId)) {
    activeId = list[0].id;
    setActiveResumeId(activeId);
  }

  const activeResume = loadResume(activeId) || defaultResume;
  return { list, activeId, activeResume };
}

/** Exports resume as a downloadable .json file */
export function exportResumeJson(name: string, r: Resume): void {
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fileName = (name || "resume").toLowerCase().replace(/[^a-z0-9_-]+/gi, "_");
  a.href = url;
  a.download = `${fileName}.resume.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parses and validates imported JSON */
export function parseImportedJson(jsonStr: string): Resume | null {
  try {
    const p = JSON.parse(jsonStr) as Partial<Resume>;
    if (typeof p !== "object" || !p || !Array.isArray(p.sections)) return null;
    return {
      ...defaultResume,
      ...p,
      style: { ...defaultResume.style, ...p.style },
      header: { ...defaultResume.header, ...p.header },
    };
  } catch {
    return null;
  }
}
