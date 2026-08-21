"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getMedia, saveMedia } from "./media-store";

type Tab = "today" | "progress" | "journal" | "settings";
type Step = { id: string; label: string; done: boolean; optional?: boolean };
type Routine = { id: string; name: string; area: string; icon: string; schedule: string; nextStep: string; steps: Step[] };
type Attachment = { id: string; type: "image" | "audio"; name: string };
type JournalEntry = { id: string; date: string; title: string; text: string; mood: string; attachments: Attachment[] };
type PendingAttachment = Attachment & { blob: Blob; preview: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

const STORAGE_KEY = "habit-tracker-v2";
const defaultRoutines: Routine[] = [
  { id: "morning", name: "Morning routine", area: "Personal", icon: "☀", schedule: "Every morning", nextStep: "Finish before starting work", steps: [
    { id: "priorities", label: "Review today’s priorities", done: false },
    { id: "supplements", label: "Take supplements", done: false },
  ] },
  { id: "evening", name: "Evening routine", area: "Personal", icon: "☾", schedule: "Every evening", nextStep: "Close the day with a short reflection", steps: [
    { id: "review-day", label: "Review the day", done: false },
    { id: "plan-tomorrow", label: "Plan tomorrow", done: false },
    { id: "daily-journal", label: "Write a journal entry", done: false, optional: true },
  ] },
  { id: "trading", name: "Trading discipline", area: "Trading", icon: "↗", schedule: "Only on days I trade", nextStep: "Review the session after trading", steps: [
    { id: "follow-plan", label: "Follow the trading plan", done: false },
    { id: "review-session", label: "Complete session review", done: false },
  ] },
];

export default function HabitApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [routines, setRoutines] = useState<Routine[]>(defaultRoutines);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [history, setHistory] = useState<Record<string, number>>({});
  const [journalOpen, setJournalOpen] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const today = localDate();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { date?: string; routines?: Routine[]; entries?: JournalEntry[]; history?: Record<string, number> } | null;
      if (saved?.routines) setRoutines(saved.date === today ? saved.routines : resetRoutines(saved.routines));
      if (saved?.entries) setEntries(saved.entries);
      if (saved?.history) setHistory(saved.history);
    } catch { localStorage.removeItem(STORAGE_KEY); }
    setHydrated(true);
  }, [today]);

  const totals = useMemo(() => {
    const steps = routines.flatMap((routine) => routine.steps.filter((step) => !step.optional));
    const complete = steps.filter((step) => step.done).length;
    return { complete, total: steps.length, percent: steps.length ? Math.round((complete / steps.length) * 100) : 0 };
  }, [routines]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, routines, entries, history }));
  }, [hydrated, today, routines, entries, history]);

  function toggleStep(routineId: string, stepId: string) {
    setRoutines((current) => {
      const next = current.map((routine) => routine.id === routineId ? { ...routine, steps: routine.steps.map((step) => step.id === stepId ? { ...step, done: !step.done } : step) } : routine);
      const required = next.flatMap((routine) => routine.steps.filter((step) => !step.optional));
      const percent = required.length ? Math.round((required.filter((step) => step.done).length / required.length) * 100) : 0;
      setHistory((value) => ({ ...value, [today]: percent }));
      return next;
    });
    showNotice("Progress saved");
  }

  function addRoutine(routine: Routine) {
    setRoutines((current) => [...current, routine]);
    setRoutineOpen(false);
    showNotice("Routine added");
  }

  async function addJournal(entry: JournalEntry, pending: PendingAttachment[]) {
    await Promise.all(pending.map((item) => saveMedia(item.id, item.blob)));
    setEntries((current) => [entry, ...current]);
    setJournalOpen(false);
    setRoutines((current) => current.map((routine) => routine.id === "evening" ? { ...routine, steps: routine.steps.map((step) => step.id === "daily-journal" ? { ...step, done: true } : step) } : routine));
    showNotice("Journal entry saved");
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1700);
  }

  const streak = calculateStreak(history, today, totals.percent);
  const dateLabel = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Toronto" }).format(new Date());

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <div className="phone-frame">
        <header className="topbar">
          <div className="brand-mark">H</div>
          <div className="brand-copy"><span className="eyebrow">HABIT TRACKER</span><strong>{tab === "today" ? "Today" : tab[0].toUpperCase() + tab.slice(1)}</strong></div>
          <button className="icon-button" aria-label="Notifications"><span className="bell">◔</span><span className="notification-dot" /></button>
        </header>
        <section className="content" aria-live="polite">
          {tab === "today" && <TodayView dateLabel={dateLabel} routines={routines} totals={totals} streak={streak} history={history} today={today} onToggle={toggleStep} onAddRoutine={() => setRoutineOpen(true)} />}
          {tab === "progress" && <ProgressView routines={routines} totals={totals} history={history} today={today} onToggle={toggleStep} onAddRoutine={() => setRoutineOpen(true)} />}
          {tab === "journal" && <JournalView entries={entries} onNew={() => setJournalOpen(true)} />}
          {tab === "settings" && <SettingsView routines={routines} entries={entries} />}
        </section>
        <nav className="bottom-nav" aria-label="Primary navigation">
          <NavButton active={tab === "today"} icon="✓" label="Today" onClick={() => setTab("today")} />
          <NavButton active={tab === "progress"} icon="↗" label="Progress" onClick={() => setTab("progress")} />
          <NavButton active={tab === "journal"} icon="≡" label="Journal" onClick={() => setTab("journal")} />
          <NavButton active={tab === "settings"} icon="⚙" label="Settings" onClick={() => setTab("settings")} />
        </nav>
      </div>
      {journalOpen && <JournalComposer onClose={() => setJournalOpen(false)} onSave={addJournal} />}
      {routineOpen && <RoutineComposer onClose={() => setRoutineOpen(false)} onSave={addRoutine} />}
      {notice && <div className="toast">✓ {notice}</div>}
    </main>
  );
}

function TodayView({ dateLabel, routines, totals, streak, history, today, onToggle, onAddRoutine }: { dateLabel: string; routines: Routine[]; totals: { complete: number; total: number; percent: number }; streak: number; history: Record<string, number>; today: string; onToggle: (routineId: string, stepId: string) => void; onAddRoutine: () => void }) {
  return <>
    <div className="greeting-row"><div><p className="date-label">{dateLabel}</p><h1>Keep the promise<br />you made to yourself.</h1></div><div className="streak-pill"><span>🔥</span><strong>{streak}</strong><small>day streak</small></div></div>
    <article className="hero-card"><ProgressRing percent={totals.percent} /><div className="hero-copy"><span className="eyebrow light">TODAY’S MOMENTUM</span><h2>{totals.complete} of {totals.total} tasks complete</h2><p>{totals.percent === 100 ? "Your required routines are complete." : "One small step at a time. Keep moving."}</p></div></article>
    <div className="section-heading"><div><span className="eyebrow">ACTIVE TODAY</span><h2>Your routines</h2></div><button className="mini-link" onClick={onAddRoutine}>+ Add routine</button></div>
    <div className="routine-stack">{routines.map((routine) => <RoutineChecklist key={routine.id} routine={routine} onToggle={onToggle} />)}</div>
    <div className="section-heading weekly-heading"><div><span className="eyebrow">THIS WEEK</span><h2>Consistency</h2></div><span className="score-chip">{weeklyAverage(history, today, totals.percent)}% average</span></div>
    <article className="week-card"><WeekBars history={history} today={today} current={totals.percent} /><div className="week-insight"><span>◆</span><p><strong>{totals.percent >= 75 ? "You’re building momentum" : "Choose the next smallest step"}</strong><br />Progress is measured across every active routine.</p></div></article>
  </>;
}

function RoutineChecklist({ routine, onToggle }: { routine: Routine; onToggle: (routineId: string, stepId: string) => void }) {
  const percent = routinePercent(routine);
  return <article className="routine-block"><header><div className="routine-icon">{routine.icon}</div><div><span className="eyebrow">{routine.area}</span><h3>{routine.name}</h3><small>{routine.schedule}</small></div><strong>{percent}%</strong></header><div className="slim-progress"><i style={{ width: `${percent}%` }} /></div><div className="task-list compact-list">{routine.steps.map((step) => <button key={step.id} className={`task-row ${step.done ? "done" : ""}`} onClick={() => onToggle(routine.id, step.id)}><span className="checkmark">{step.done ? "✓" : ""}</span><span className="task-copy"><strong>{step.label}</strong>{step.optional && <small>Optional</small>}</span></button>)}</div></article>;
}

function ProgressView({ routines, totals, history, today, onToggle, onAddRoutine }: { routines: Routine[]; totals: { complete: number; total: number; percent: number }; history: Record<string, number>; today: string; onToggle: (routineId: string, stepId: string) => void; onAddRoutine: () => void }) {
  return <>
    <div className="page-intro"><span className="eyebrow">YOUR DIRECTION</span><h1>See what you’re<br />working toward.</h1><p>Review each active routine, the progress you’ve made, and the next useful step.</p></div>
    <div className="progress-overview"><ProgressRing percent={totals.percent} /><div><span className="eyebrow">OVERALL PROGRESS</span><h2>{totals.percent}% complete today</h2><p>{weeklyAverage(history, today, totals.percent)}% weekly consistency</p></div></div>
    <div className="section-heading"><div><span className="eyebrow">ACTIVE WORK</span><h2>Routines & next steps</h2></div><button className="mini-link" onClick={onAddRoutine}>+ Add</button></div>
    <div className="focus-list">{routines.map((routine) => {
      const next = routine.steps.find((step) => !step.done);
      const percent = routinePercent(routine);
      return <article className="focus-card" key={routine.id}><header><div className="routine-icon">{routine.icon}</div><div><span className="eyebrow">{routine.area}</span><h3>{routine.name}</h3></div><strong>{percent}%</strong></header><div className="slim-progress"><i style={{ width: `${percent}%` }} /></div><div className="next-step"><span>NEXT STEP</span><p>{next?.label ?? routine.nextStep}</p></div>{next ? <button className="secondary-button small" onClick={() => onToggle(routine.id, next.id)}>Mark next step complete</button> : <div className="complete-note">✓ Routine complete for today</div>}</article>;
    })}</div>
    <article className="reflection-card"><span>✦</span><div><strong>Weekly review prompt</strong><p>Which routine is moving you forward—and which one needs a smaller next step?</p></div></article>
  </>;
}

function JournalView({ entries, onNew }: { entries: JournalEntry[]; onNew: () => void }) {
  return <>
    <div className="journal-hero"><span className="eyebrow light">DAILY JOURNAL</span><h1>Make sense<br />of your day.</h1><p>Write, speak, add photos, or leave a voice memo. This space is about your whole life.</p><button className="journal-new" onClick={onNew}>+ New journal entry</button></div>
    <div className="section-heading"><div><span className="eyebrow">YOUR ENTRIES</span><h2>Recent reflections</h2></div><span className="score-chip">{entries.length} saved</span></div>
    <div className="entry-list">{entries.length ? entries.map((entry) => <JournalCard key={entry.id} entry={entry} />) : <div className="empty-state"><span>✎</span><strong>Your journal is ready</strong><p>At the end of today, record what happened, how you felt, and what you want to carry forward.</p><button className="secondary-button" onClick={onNew}>Write your first entry</button></div>}</div>
  </>;
}

function JournalCard({ entry }: { entry: JournalEntry }) {
  const date = new Date(`${entry.date}T12:00:00`);
  return <article className="entry-card"><header><div className="journal-date"><strong>{date.getDate()}</strong><span>{date.toLocaleString("en", { month: "short" }).toUpperCase()}</span></div><div><span className="eyebrow">{entry.mood || "DAILY REFLECTION"}</span><h3>{entry.title || "A note about today"}</h3></div></header><p>{entry.text}</p>{entry.attachments.length > 0 && <div className="media-grid">{entry.attachments.map((attachment) => <StoredMedia key={attachment.id} attachment={attachment} />)}</div>}</article>;
}

function StoredMedia({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let active = true; let objectUrl = ""; getMedia(attachment.id).then((blob) => { if (blob && active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [attachment.id]);
  if (!url) return <div className="media-loading">Loading…</div>;
  return attachment.type === "image" ? <img src={url} alt={attachment.name || "Journal attachment"} /> : <div className="audio-attachment"><span>◉ Voice memo</span><audio controls src={url} /></div>;
}

function JournalComposer({ onClose, onSave }: { onClose: () => void; onSave: (entry: JournalEntry, pending: PendingAttachment[]) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [mood, setMood] = useState("Reflective");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const additions = Array.from(files).slice(0, 6).map((file) => ({ id: crypto.randomUUID(), type: "image" as const, name: file.name, blob: file, preview: URL.createObjectURL(file) }));
    setPending((current) => [...current, ...additions].slice(0, 6));
  }

  function startDictation() {
    const Speech = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Speech) { setSpeechMessage("Voice-to-text is not supported in this browser. You can still record a voice memo."); return; }
    const recognition = new Speech(); recognition.continuous = true; recognition.interimResults = false; recognition.lang = "en-CA";
    recognition.onresult = (event) => { let transcript = ""; for (let i = 0; i < event.results.length; i += 1) transcript += `${event.results[i][0].transcript} `; setText((current) => `${current}${current ? " " : ""}${transcript.trim()}`); };
    recognition.onend = () => setListening(false); recognition.onerror = () => { setListening(false); setSpeechMessage("Dictation stopped. Try again or use a voice memo."); };
    recognition.start(); setListening(true); setSpeechMessage("Listening… tap again when you’re finished.");
    window.setTimeout(() => { if (listening) recognition.stop(); }, 60000);
  }

  async function toggleVoiceMemo() {
    if (recording && recorderRef.current) { recorderRef.current.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream;
      const recorder = new MediaRecorder(stream); recorderRef.current = recorder; chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => { const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); setPending((current) => [...current, { id: crypto.randomUUID(), type: "audio", name: "Voice memo", blob, preview: URL.createObjectURL(blob) }]); stream.getTracks().forEach((track) => track.stop()); };
      recorder.start(); setRecording(true);
    } catch { setSpeechMessage("Microphone access was unavailable. Check your browser permission and try again."); }
  }

  function save() {
    if (!text.trim() && !title.trim() && pending.length === 0) return;
    const attachments = pending.map(({ id, type, name }) => ({ id, type, name }));
    onSave({ id: crypto.randomUUID(), date: localDate(), title: title.trim(), text: text.trim(), mood, attachments }, pending);
  }

  return <Modal onClose={onClose} wide><span className="eyebrow">NEW DAILY ENTRY</span><h2>How did today go?</h2><div className="mood-row">{["Good", "Reflective", "Hard", "Grateful"].map((item) => <button key={item} className={mood === item ? "selected" : ""} onClick={() => setMood(item)}>{item}</button>)}</div><div className="field"><label>Title <span className="optional">optional</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What stands out about today?" /></label></div><div className="field"><label>Your reflection<textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Write freely, or use the microphone to dictate…" /></label></div><div className="capture-tools"><button className={listening ? "active" : ""} onClick={startDictation}>◉ {listening ? "Listening" : "Voice to text"}</button><button className={recording ? "recording" : ""} onClick={toggleVoiceMemo}>● {recording ? "Stop recording" : "Voice memo"}</button><label>▧ Add photos<input type="file" accept="image/*" multiple onChange={(event) => addPhotos(event.target.files)} /></label></div>{speechMessage && <p className="helper-message">{speechMessage}</p>}{pending.length > 0 && <div className="pending-media">{pending.map((item) => <div key={item.id}>{item.type === "image" ? <img src={item.preview} alt="Pending upload" /> : <audio controls src={item.preview} />}<button aria-label="Remove attachment" onClick={() => setPending((current) => current.filter((value) => value.id !== item.id))}>×</button></div>)}</div>}<button className="primary-button wide-button" disabled={!text.trim() && !title.trim() && pending.length === 0} onClick={save}>Save journal entry</button></Modal>;
}

function RoutineComposer({ onClose, onSave }: { onClose: () => void; onSave: (routine: Routine) => void }) {
  const [name, setName] = useState(""); const [area, setArea] = useState("Personal"); const [schedule, setSchedule] = useState("Every day"); const [nextStep, setNextStep] = useState(""); const [steps, setSteps] = useState("");
  function save() { const labels = steps.split("\n").map((item) => item.trim()).filter(Boolean); if (!name.trim() || !labels.length) return; onSave({ id: crypto.randomUUID(), name: name.trim(), area, icon: area === "Trading" ? "↗" : area === "Health" ? "♥" : "◆", schedule, nextStep: nextStep.trim() || labels[0], steps: labels.map((label) => ({ id: crypto.randomUUID(), label, done: false })) }); }
  return <Modal onClose={onClose}><span className="eyebrow">NEW ROUTINE</span><h2>What are you working on?</h2><div className="field"><label>Routine name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Study French" /></label></div><div className="field split"><label>Life area<select value={area} onChange={(event) => setArea(event.target.value)}><option>Personal</option><option>Health</option><option>Learning</option><option>Work</option><option>Trading</option></select></label><label>Schedule<select value={schedule} onChange={(event) => setSchedule(event.target.value)}><option>Every day</option><option>Selected days</option><option>Weekly</option><option>Custom</option></select></label></div><div className="field"><label>Tasks or steps <span className="optional">one per line</span><textarea value={steps} onChange={(event) => setSteps(event.target.value)} placeholder={"First step\nSecond step\nThird step"} /></label></div><div className="field"><label>What comes next?<input value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="Your immediate focus" /></label></div><button className="primary-button wide-button" disabled={!name.trim() || !steps.trim()} onClick={save}>Add routine</button></Modal>;
}

function SettingsView({ routines, entries }: { routines: Routine[]; entries: JournalEntry[] }) {
  function exportData() { downloadFile(JSON.stringify({ routines, entries }, null, 2), "habit-tracker-backup.json", "application/json"); }
  return <><div className="page-intro"><span className="eyebrow">PREFERENCES</span><h1>Make it yours.</h1><p>Routine rules, reminders, and data controls live here.</p></div><div className="settings-group"><h2>Routine settings</h2><SettingRow title="Reminder windows" detail="Choose a window for each routine" /><SettingRow title="Successful day rule" detail="Set the completion threshold" /><SettingRow title="Grace periods" detail="Choose per routine" /></div><div className="settings-group"><h2>Journal</h2><SettingRow title="Daily journal reminder" detail="Prompt me during the evening routine" /><SettingRow title="Microphone & photos" detail="Permissions are requested only when used" /></div><div className="settings-group"><h2>Your data</h2><SettingRow title="Download backup" detail="Routines and journal metadata" onClick={exportData} /><SettingRow title="Generate PDF report" detail="Open a print-ready view" onClick={() => window.print()} /><SettingRow title="Notification permission" detail="Enable browser reminders" onClick={() => "Notification" in window && window.Notification.requestPermission()} /></div></>;
}

function Modal({ onClose, wide, children }: { onClose: () => void; wide?: boolean; children: React.ReactNode }) { return <div className="modal-backdrop" onMouseDown={onClose}><section className={`modal ${wide ? "review-modal" : ""}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close">×</button>{children}</section></div>; }
function ProgressRing({ percent }: { percent: number }) { return <div className="ring" style={{ "--progress": `${percent * 3.6}deg` } as React.CSSProperties}><div><strong>{percent}%</strong><span>complete</span></div></div>; }
function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) { return <button className={active ? "active" : ""} onClick={onClick}><span>{icon}</span><small>{label}</small></button>; }
function SettingRow({ title, detail, onClick }: { title: string; detail: string; onClick?: () => void }) { return <button className="setting-row" onClick={onClick}><span><strong>{title}</strong><small>{detail}</small></span><b>›</b></button>; }
function routinePercent(routine: Routine) { const required = routine.steps.filter((step) => !step.optional); return required.length ? Math.round((required.filter((step) => step.done).length / required.length) * 100) : 0; }
function resetRoutines(routines: Routine[]) { return routines.map((routine) => ({ ...routine, steps: routine.steps.map((step) => ({ ...step, done: false })) })); }
function localDate(offset = 0) { const date = new Date(); date.setDate(date.getDate() + offset); return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function weeklyValues(history: Record<string, number>, today: string, current: number) { return Array.from({ length: 7 }, (_, index) => { const offset = index - 6; const date = localDate(offset); return { date, day: new Date(`${date}T12:00:00`).toLocaleString("en", { weekday: "narrow" }), value: date === today ? current : history[date] ?? 0 }; }); }
function weeklyAverage(history: Record<string, number>, today: string, current: number) { const values = weeklyValues(history, today, current); return Math.round(values.reduce((sum, item) => sum + item.value, 0) / values.length); }
function calculateStreak(history: Record<string, number>, today: string, current: number) { const values = { ...history, [today]: current }; let streak = 0; for (let offset = 0; offset > -365; offset -= 1) { if ((values[localDate(offset)] ?? 0) < 100) break; streak += 1; } return streak; }
function WeekBars({ history, today, current }: { history: Record<string, number>; today: string; current: number }) { return <div className="week-bars">{weeklyValues(history, today, current).map((item) => <div className="day-bar" key={item.date}><div className="bar-track"><i style={{ height: `${Math.max(item.value, 7)}%` }} /></div><span>{item.day}</span></div>)}</div>; }
function downloadFile(content: string, filename: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
