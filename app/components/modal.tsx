"use client";

import { useEffect, useId, useRef } from "react";

export function Modal({ onClose, wide, title, subtitle, children }: { onClose: () => void; wide?: boolean; title: string; subtitle?: string; children: React.ReactNode }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><section className={`modal ${wide ? "review-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}><button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Close">×</button><h2 id={titleId} className="sr-only">{title}</h2>{subtitle && <p className="modal-subtitle">{subtitle}</p>}{children}</section></div>;
}
