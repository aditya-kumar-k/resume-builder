import { createElement } from "react";
import { ICONS } from "@/lib/icons";

/** An outline icon from the registry, coloured by the text colour around it. */
export function Icon({ id, size = 14 }: { id: string; size?: number }) {
  const def = ICONS[id];
  if (!def) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden>
      {def.node.map(([tag, attrs], i) => createElement(tag, { ...attrs, key: i }))}
    </svg>
  );
}
