"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useDictation } from "../hooks/use-dictation";
import { useMediaRecorder } from "../hooks/use-media-recorder";
import type { ISODate, JournalAttachment, JournalEntry } from "../types/domain";
import { Modal } from "./modal";

export type PendingAttachment = JournalAttachment & { blob: Blob; preview: string };

function revoke(item: PendingAttachment) {
  URL.revokeObjectURL(item.preview);
}

export function JournalComposer({ date, onClose, onSave }: { date: ISODate; onClose: () => void; onSave: (entry: JournalEntry, pending: PendingAttachment[]) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [mood, setMood] = useState("Reflective");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef<PendingAttachment[]>([]);
  const appendTranscript = useCallback((transcript: string) => setText((current) => `${current}${current ? " " : ""}${transcript}`), []);
  const dictation = useDictation(appendTranscript);
  const addVoiceMemo = useCallback((blob: Blob) => {
    const createdAt = new Date().toISOString();
    const item: PendingAttachment = { id: crypto.randomUUID(), kind: "audio", name: "Voice memo", mimeType: blob.type || "audio/webm", size: blob.size, createdAt, blob, preview: URL.createObjectURL(blob) };
    setPending((current) => [...current, item]);
  }, []);
  const recorder = useMediaRecorder(addVoiceMemo);

  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => () => pendingRef.current.forEach(revoke), []);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const capacity = Math.max(0, 6 - pending.length);
    const additions = Array.from(files).slice(0, capacity).map((file): PendingAttachment => ({
      id: crypto.randomUUID(), kind: "image", name: file.name, mimeType: file.type || "image/*", size: file.size,
      createdAt: new Date().toISOString(), blob: file, preview: URL.createObjectURL(file),
    }));
    setPending((current) => [...current, ...additions]);
  }

  function removeAttachment(id: string) {
    setPending((current) => {
      const item = current.find((value) => value.id === id);
      if (item) revoke(item);
      return current.filter((value) => value.id !== id);
    });
  }

  async function save() {
    if (saving || (!text.trim() && !title.trim() && pending.length === 0)) return;
    setSaving(true);
    setError("");
    const timestamp = new Date().toISOString();
    try {
      await onSave({ id: crypto.randomUUID(), date, title: title.trim(), text: text.trim(), mood, attachmentIds: pending.map((item) => item.id), createdAt: timestamp, updatedAt: timestamp }, pending);
      pending.forEach(revoke);
      pendingRef.current = [];
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The journal entry could not be saved.");
      setSaving(false);
    }
  }

  const close = () => {
    dictation.stop();
    recorder.cleanup();
    onClose();
  };

  return <Modal onClose={close} wide title="New daily entry"><span className="eyebrow">NEW DAILY ENTRY</span><h2>How did today go?</h2><div className="mood-row">{["Good", "Reflective", "Hard", "Grateful"].map((item) => <button type="button" key={item} className={mood === item ? "selected" : ""} onClick={() => setMood(item)}>{item}</button>)}</div><div className="field"><label>Title <span className="optional">optional</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What stands out about today?" /></label></div><div className="field"><label>Your reflection<textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Write freely, or use the microphone to dictate…" /></label></div><div className="capture-tools"><button type="button" className={dictation.listening ? "active" : ""} aria-pressed={dictation.listening} onClick={dictation.toggle}>◉ {dictation.listening ? "Stop dictation" : "Voice to text"}</button><button type="button" className={recorder.recording ? "recording" : ""} aria-pressed={recorder.recording} onClick={recorder.toggle}>● {recorder.recording ? "Stop recording" : "Voice memo"}</button><label>▧ Add photos<input type="file" accept="image/*" multiple onChange={(event) => addPhotos(event.target.files)} /></label></div>{(dictation.message || recorder.message) && <p className="helper-message" role="status">{dictation.message || recorder.message}</p>}{pending.length > 0 && <div className="pending-media">{pending.map((item) => <div key={item.id}>{item.kind === "image" ? <Image unoptimized width={180} height={120} src={item.preview} alt="Pending upload" /> : <audio controls src={item.preview} />}<button type="button" aria-label={`Remove ${item.name}`} onClick={() => removeAttachment(item.id)}>×</button></div>)}</div>}{error && <p className="error-message" role="alert">{error}</p>}<button className="primary-button wide-button" disabled={saving || (!text.trim() && !title.trim() && pending.length === 0)} onClick={save}>{saving ? "Saving…" : "Save journal entry"}</button></Modal>;
}
