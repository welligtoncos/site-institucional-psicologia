"use client";

import { useMemo, useState } from "react";

/** Textos acima disso costumam ocupar mais de ~3 linhas em mobile. */
const TOGGLE_THRESHOLD_CHARS = 140;

type CompactBioProps = {
  text: string;
};

export function CompactBio({ text }: CompactBioProps) {
  const trimmed = text.trim();
  const [expanded, setExpanded] = useState(false);

  const needsToggle = useMemo(() => trimmed.length > TOGGLE_THRESHOLD_CHARS, [trimmed.length]);

  if (!trimmed) return null;

  return (
    <div className="mt-3">
      <p
        className={`text-sm leading-snug text-slate-700 ${!expanded && needsToggle ? "line-clamp-3" : ""}`}
      >
        {trimmed}
      </p>
      {needsToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
        >
          {expanded ? "Ver menos" : "Ver mais"}
        </button>
      ) : null}
    </div>
  );
}
