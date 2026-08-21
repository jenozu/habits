"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { JournalComposer, type PendingAttachment } from "./components/journal-composer";
import { Modal } from "./components/modal";
import { useAppStore } from "./hooks/use-app-store";
import { useCurrentDate } from "./hooks/use-current-date";
import { createCheckIn, routineProgress, taskSnapshots, updateTaskCompletion } from "./lib/completion";
import { addDays, formatDateLabel, weekDates } from "./lib/date";
import { calculateOverallStreak, dueProgressForDate, evaluateDay } from "./lib/streaks";
import { isRoutineAvailable, isRoutineDue, scheduleLabel } from "./lib/schedules";
import { deleteMedia, getMedia, saveMedia } from "./media-store";
import type { AppSettings, AppStateV3, CompletionRule, ISODate, JournalAttachment, JournalEntry, RoutineCheckIn, RoutineDefinition, ScheduleRule, TaskDefinition } from "./types/domain";

type Tab = "today" | "progress" | "journal" | "settings";

export default function HabitApp() {
  const { state, setState, hydrated, loadResult, saveError, resetAfterRecovery } = useAppStore();
  const currentDate = useCurrentDate(state.settings.timeZone);
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const previousCurrentDate = useRef(currentDate);
  const [tab, setTab] = useState<Tab>("today");
  const [journalOpen, setJournalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineDefinition | null | undefined>(undefined);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (selectedDate === previousCurrentDate.current) setSelectedDate(currentDate);
    previousCurrentDate.current = currentDate;
  }, [currentDate, selectedDate]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1900);
  }, []);

  const totals = useMemo(() => dueProgressForDate(state, selectedDate), [selectedDate, state]);
  const streak = useMemo(() => calculateOverallStreak(state, currentDate), [currentDate, state]);
  const dueRoutines = useMemo(() => state.routines.filter((routine) => isRoutineDue(routine, selectedDate, state.checkIns, state.settings)), [selectedDate, state]);
  const availableRoutines = useMemo(() => state.routines.filter((routine) => isRoutineAvailable(routine, selectedDate, state.checkIns, state.settings)), [selectedDate, state]);

  function toggleTask(routineId: string, taskId: string) {
    setState((current) => {
      const routine = current.routines.find((value) => value.id === routineId);
      if (!routine) return current;
      const index = current.checkIns.findIndex((value) => value.routineId === routineId && value.date === selectedDate);
      const existing = index >= 0 ? current.checkIns[index] : createCheckIn(routine, selectedDate, true, routine.schedule.type === "manual" || routine.schedule.type === "timesPerWeek");
      const task = existing.taskCheckIns.find((value) => value.taskId === taskId);
      const updated = updateTaskCompletion(existing, taskId, !task?.completed, current.settings, new Date(), selectedDate !== currentDate);
      const checkIns = index >= 0 ? current.checkIns.map((value, valueIndex) => valueIndex === index ? updated : value) : [...current.checkIns, updated];
      return { ...current, checkIns };
    });
    showNotice(selectedDate === currentDate ? "Progress saved" : "Historical check-in updated");
  }

  function activateRoutine(routineId: string) {
    setState((current) => {
      if (current.checkIns.some((value) => value.routineId === routineId && value.date === selectedDate)) return current;
      const routine = current.routines.find((value) => value.id === routineId);
      if (!routine) return current;
      return { ...current, checkIns: [...current.checkIns, createCheckIn(routine, selectedDate, true, true)] };
    });
    showNotice("Routine activated for this date");
  }

  function saveRoutine(routine: RoutineDefinition) {
    setState((current) => {
      const exists = current.routines.some((value) => value.id === routine.id);
      return { ...current, routines: exists ? current.routines.map((value) => value.id === routine.id ? routine : value) : [...current.routines, routine] };
    });
    setEditingRoutine(undefined);
    showNotice(editingRoutine ? "Routine updated" : "Routine added");
  }

  async function addJournal(entry: JournalEntry, pending: PendingAttachment[]) {
    const saved: string[] = [];
    try {
      for (const item of pending) {
        await saveMedia(item.id, item.blob);
        saved.push(item.id);
      }
      setState((current) => {
        let checkIns = current.checkIns;
        for (const routine of current.routines.filter((value) => isRoutineDue(value, entry.date, current.checkIns, current.settings))) {
          for (const task of routine.tasks.filter((value) => value.type === "journalLink")) {
            const index = checkIns.findIndex((value) => value.routineId === routine.id && value.date === entry.date);
            const existing = index >= 0 ? checkIns[index] : createCheckIn(routine, entry.date, true, false);
            const updated = updateTaskCompletion(existing, task.id, true, current.settings, new Date(), entry.date !== currentDate);
            checkIns = index >= 0 ? checkIns.map((value, valueIndex) => valueIndex === index ? updated : value) : [...checkIns, updated];
          }
        }
        return {
          ...current,
          checkIns,
          journalEntries: [entry, ...current.journalEntries],
          attachments: [...current.attachments, ...pending.map((item) => ({ id: item.id, kind: item.kind, name: item.name, mimeType: item.mimeType, size: item.size, durationSeconds: item.durationSeconds, width: item.width, height: item.height, createdAt: item.createdAt }))],
        };
      });
      setJournalOpen(false);
      showNotice("Journal entry saved");
    } catch (error) {
      await Promise.allSettled(saved.map(deleteMedia));
      throw new Error(error instanceof Error ? `Media could not be saved: ${error.message}` : "Media could not be saved.");
    }
  }

  function updateSettings(settings: AppSettings) {
    setState((current) => ({ ...current, settings }));
    showNotice("Settings saved");
  }

  function downloadRecovery() {
    if (loadResult?.status !== "error") return;
    downloadFile(loadResult.raw, `habit-tracker-${loadResult.source}-recovery.json`, "application/json");
  }

  if (!hydrated) return <main className="app-shell"><div className="phone-frame loading-screen">Loading your routines…</div></main>;

  const dateLabel = formatDateLabel(selectedDate, state.settings.timeZone);
  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <div className="phone-frame">
        <header className="topbar"><div className="brand-mark">H</div><div className="brand-copy"><span className="eyebrow">HABIT TRACKER</span><strong>{tab === "today" ? "Today" : tab[0].toUpperCase() + tab.slice(1)}</strong></div><button className="icon-button" aria-label="Notifications"><span className="bell">◔</span></button></header>
        {(loadResult?.status === "error" || saveError) && <div className="recovery-banner" role="alert"><strong>Your saved data needs attention.</strong><span>{loadResult?.status === "error" ? loadResult.message : saveError}</span>{loadResult?.status === "error" && <div><button onClick={downloadRecovery}>Download original data</button><button onClick={resetAfterRecovery}>Start fresh after recovery</button></div>}</div>}
        <section className="content">
          {tab === "today" && <TodayView dateLabel={dateLabel} date={selectedDate} currentDate={currentDate} setDate={setSelectedDate} routines={dueRoutines} available={availableRoutines} checkIns={state.checkIns} totals={totals} streak={streak} state={state} onToggle={toggleTask} onActivate={activateRoutine} onEdit={setEditingRoutine} onAddRoutine={() => setEditingRoutine(null)} />}
          {tab === "progress" && <ProgressView date={selectedDate} state={state} totals={totals} onToggle={toggleTask} onActivate={activateRoutine} onEdit={setEditingRoutine} onAddRoutine={() => setEditingRoutine(null)} />}
          {tab === "journal" && <JournalView entries={state.journalEntries} attachments={state.attachments} onNew={() => setJournalOpen(true)} />}
          {tab === "settings" && <SettingsView state={state} onSettings={updateSettings} />}
        </section>
        <nav className="bottom-nav" aria-label="Primary navigation"><NavButton active={tab === "today"} icon="✓" label="Today" onClick={() => setTab("today")} /><NavButton active={tab === "progress"} icon="↗" label="Progress" onClick={() => setTab("progress")} /><NavButton active={tab === "journal"} icon="≡" label="Journal" onClick={() => setTab("journal")} /><NavButton active={tab === "settings"} icon="⚙" label="Settings" onClick={() => setTab("settings")} /></nav>
      </div>
      {journalOpen && <JournalComposer date={selectedDate} onClose={() => setJournalOpen(false)} onSave={addJournal} />}
      {editingRoutine !== undefined && <RoutineComposer initial={editingRoutine ?? undefined} today={currentDate} onClose={() => setEditingRoutine(undefined)} onSave={saveRoutine} />}
      {notice && <div className="toast" role="status">✓ {notice}</div>}
    </main>
  );
}

function TodayView({ dateLabel, date, currentDate, setDate, routines, available, checkIns, totals, streak, state, onToggle, onActivate, onEdit, onAddRoutine }: { dateLabel: string; date: ISODate; currentDate: ISODate; setDate: (date: ISODate) => void; routines: RoutineDefinition[]; available: RoutineDefinition[]; checkIns: RoutineCheckIn[]; totals: ReturnType<typeof dueProgressForDate>; streak: number; state: AppStateV3; onToggle: (routineId: string, taskId: string) => void; onActivate: (routineId: string) => void; onEdit: (routine: RoutineDefinition) => void; onAddRoutine: () => void }) {
  const status = evaluateDay(state, date);
  return <><div className="date-navigator"><button aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</button><label><span>{date === currentDate ? "Viewing today" : "Editing history"}</span><input type="date" max={currentDate} value={date} onChange={(event) => setDate(event.target.value)} /></label><button aria-label="Next day" disabled={date >= currentDate} onClick={() => setDate(addDays(date, 1))}>›</button></div><div className="greeting-row"><div><p className="date-label">{dateLabel}</p><h1>Keep the promise<br />you made to yourself.</h1></div><div className="streak-pill"><span>🔥</span><strong>{streak}</strong><small>day streak</small></div></div><article className="hero-card"><ProgressRing percent={totals.percent} label={`${totals.complete} of ${totals.total} due routines complete`} /><div className="hero-copy"><span className="eyebrow light">{date === currentDate ? "TODAY’S MOMENTUM" : "HISTORICAL CHECK-IN"}</span><h2>{totals.neutral ? "No routines due" : `${totals.complete} of ${totals.total} routines complete`}</h2><p>{status === "neutral" ? "This is a neutral day and does not change your streak." : status === "provisional" ? "This day remains open while grace periods are active." : totals.percent === 100 ? "Your due routines are complete." : "One small step at a time. Keep moving."}</p></div></article><div className="section-heading"><div><span className="eyebrow">ACTIVE THIS DATE</span><h2>Your routines</h2></div><button className="mini-link" onClick={onAddRoutine}>+ Add routine</button></div><div className="routine-stack">{routines.length ? routines.map((routine) => <RoutineChecklist key={routine.id} routine={routine} checkIn={checkIns.find((value) => value.routineId === routine.id && value.date === date)} onToggle={onToggle} onEdit={() => onEdit(routine)} />) : <div className="empty-state"><strong>No routines are due</strong><p>This date is neutral unless you activate an available routine.</p></div>}</div>{available.length > 0 && <><div className="section-heading"><div><span className="eyebrow">AVAILABLE</span><h2>Start when relevant</h2></div></div><div className="available-list">{available.map((routine) => <article className="trade-card" key={routine.id}><div className="trade-icon">{routine.icon}</div><div className="trade-copy"><h3>{routine.name}</h3><p>{scheduleLabel(routine.schedule)} · optional until activated</p></div><button className="compact-button" onClick={() => onActivate(routine.id)}>Activate</button></article>)}</div></>}<div className="section-heading weekly-heading"><div><span className="eyebrow">THIS CONFIGURED WEEK</span><h2>Consistency</h2></div><span className="score-chip">{weeklyAverage(state, currentDate)}% average</span></div><article className="week-card"><WeekBars state={state} today={currentDate} /><div className="week-insight"><span>◆</span><p><strong>{totals.percent >= 75 ? "You’re building momentum" : "Choose the next smallest step"}</strong><br />Only routines due or activated on each date affect progress.</p></div></article></>;
}

function RoutineChecklist({ routine, checkIn, onToggle, onEdit }: { routine: RoutineDefinition; checkIn?: RoutineCheckIn; onToggle: (routineId: string, taskId: string) => void; onEdit: () => void }) {
  const snapshots = checkIn?.taskSnapshots ?? taskSnapshots(routine);
  return <article className="routine-block"><header><div className="routine-icon">{routine.icon}</div><div><span className="eyebrow">{routine.areaId}</span><h3>{routine.name}</h3><small>{scheduleLabel(routine.schedule)} · {completionLabel(routine.completionRule)}</small></div><strong>{routineProgress(checkIn)}%</strong></header><button className="card-edit" onClick={onEdit}>Edit rules</button><div className="slim-progress" role="progressbar" aria-label={`${routine.name} progress`} aria-valuenow={routineProgress(checkIn)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${routineProgress(checkIn)}%` }} /></div><div className="task-list compact-list">{snapshots.map((task) => { const complete = checkIn?.taskCheckIns.find((value) => value.taskId === task.id)?.completed === true; return <button key={task.id} role="checkbox" aria-checked={complete} className={`task-row ${complete ? "done" : ""}`} onClick={() => onToggle(routine.id, task.id)}><span className="checkmark">{complete ? "✓" : ""}</span><span className="task-copy"><strong>{task.label}</strong>{!task.required && <small>{task.countsTowardProgress ? "Optional · scored" : "Optional · unscored"}</small>}</span></button>; })}</div></article>;
}

function ProgressView({ date, state, totals, onToggle, onActivate, onEdit, onAddRoutine }: { date: ISODate; state: AppStateV3; totals: ReturnType<typeof dueProgressForDate>; onToggle: (routineId: string, taskId: string) => void; onActivate: (routineId: string) => void; onEdit: (routine: RoutineDefinition) => void; onAddRoutine: () => void }) {
  return <><div className="page-intro"><span className="eyebrow">YOUR DIRECTION</span><h1>See what you’re<br />working toward.</h1><p>Review each active routine, the progress you’ve made, and the next useful step.</p></div><div className="progress-overview"><ProgressRing percent={totals.percent} label={`${totals.percent}% due-based progress`} /><div><span className="eyebrow">DUE-BASED PROGRESS</span><h2>{totals.neutral ? "Neutral day" : `${totals.percent}% complete`}</h2><p>{weeklyAverage(state, date)}% configured-week consistency</p></div></div><div className="section-heading"><div><span className="eyebrow">ACTIVE WORK</span><h2>Routines & next steps</h2></div><button className="mini-link" onClick={onAddRoutine}>+ Add</button></div><div className="focus-list">{state.routines.filter((routine) => !routine.archivedAt).map((routine) => { const due = isRoutineDue(routine, date, state.checkIns, state.settings); const available = isRoutineAvailable(routine, date, state.checkIns, state.settings); const checkIn = state.checkIns.find((value) => value.routineId === routine.id && value.date === date); const snapshots = checkIn?.taskSnapshots ?? taskSnapshots(routine); const next = snapshots.find((task) => !checkIn?.taskCheckIns.find((value) => value.taskId === task.id)?.completed); return <article className="focus-card" key={routine.id}><header><div className="routine-icon">{routine.icon}</div><div><span className="eyebrow">{routine.areaId}</span><h3>{routine.name}</h3></div><strong>{routineProgress(checkIn)}%</strong></header><button className="card-edit" onClick={() => onEdit(routine)}>Edit rules</button><div className="slim-progress"><i style={{ width: `${routineProgress(checkIn)}%` }} /></div><div className="next-step"><span>{due ? "NEXT STEP" : "SCHEDULE"}</span><p>{due ? next?.label ?? routine.nextAction ?? "Routine complete" : scheduleLabel(routine.schedule)}</p></div>{due && next ? <button className="secondary-button small" onClick={() => onToggle(routine.id, next.id)}>Mark next step complete</button> : available ? <button className="secondary-button small" onClick={() => onActivate(routine.id)}>Activate for this date</button> : due ? <div className="complete-note">✓ Routine complete for this date</div> : <div className="not-due-note">Not due on this date</div>}</article>; })}</div><article className="reflection-card"><span>✦</span><div><strong>Weekly review prompt</strong><p>Which routine is moving you forward—and which one needs a smaller next step?</p></div></article></>;
}

function JournalView({ entries, attachments, onNew }: { entries: JournalEntry[]; attachments: JournalAttachment[]; onNew: () => void }) {
  return <><div className="journal-hero"><span className="eyebrow light">DAILY JOURNAL</span><h1>Make sense<br />of your day.</h1><p>Write, speak, add photos, or leave a voice memo. This space is about your whole life.</p><button className="journal-new" onClick={onNew}>+ New journal entry</button></div><div className="section-heading"><div><span className="eyebrow">YOUR ENTRIES</span><h2>Recent reflections</h2></div><span className="score-chip">{entries.length} saved</span></div><div className="entry-list">{entries.length ? entries.map((entry) => <JournalCard key={entry.id} entry={entry} attachments={attachments.filter((value) => entry.attachmentIds.includes(value.id))} />) : <div className="empty-state"><span>✎</span><strong>Your journal is ready</strong><p>At the end of today, record what happened, how you felt, and what you want to carry forward.</p><button className="secondary-button" onClick={onNew}>Write your first entry</button></div>}</div></>;
}

function JournalCard({ entry, attachments }: { entry: JournalEntry; attachments: JournalAttachment[] }) {
  const date = new Date(`${entry.date}T12:00:00Z`);
  return <article className="entry-card"><header><div className="journal-date"><strong>{date.getUTCDate()}</strong><span>{date.toLocaleString("en", { month: "short", timeZone: "UTC" }).toUpperCase()}</span></div><div><span className="eyebrow">{entry.mood || "DAILY REFLECTION"}</span><h3>{entry.title || "A note about today"}</h3></div></header><p>{entry.text}</p>{attachments.length > 0 && <div className="media-grid">{attachments.map((attachment) => <StoredMedia key={attachment.id} attachment={attachment} />)}</div>}</article>;
}

function StoredMedia({ attachment }: { attachment: JournalAttachment }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let active = true; let objectUrl = ""; getMedia(attachment.id).then((blob) => { if (blob && active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [attachment.id]);
  if (!url) return <div className="media-loading">Loading…</div>;
  return attachment.kind === "image" ? <Image unoptimized width={320} height={240} src={url} alt={attachment.name || "Journal attachment"} /> : <div className="audio-attachment"><span>◉ Voice memo</span><audio controls src={url} /></div>;
}

type TaskDraft = Pick<TaskDefinition, "id" | "label" | "required" | "countsTowardProgress">;

function RoutineComposer({ initial, today, onClose, onSave }: { initial?: RoutineDefinition; today: ISODate; onClose: () => void; onSave: (routine: RoutineDefinition) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [area, setArea] = useState(initial?.areaId ?? "Personal");
  const [nextAction, setNextAction] = useState(initial?.nextAction ?? "");
  const [schedule, setSchedule] = useState<ScheduleRule>(initial?.schedule ?? { type: "daily" });
  const [completionRule, setCompletionRule] = useState<CompletionRule>(initial?.completionRule ?? { type: "allRequired" });
  const [graceMinutes, setGraceMinutes] = useState(initial?.graceMinutes ?? 0);
  const [tasks, setTasks] = useState<TaskDraft[]>(() => initial?.tasks.map(({ id, label, required, countsTowardProgress }) => ({ id, label, required, countsTowardProgress })) ?? [{ id: crypto.randomUUID(), label: "", required: true, countsTowardProgress: true }]);
  const setScheduleType = (type: ScheduleRule["type"]) => setSchedule(type === "daily" ? { type } : type === "weekdays" ? { type, days: [1, 2, 3, 4, 5] } : type === "timesPerWeek" ? { type, count: 3 } : type === "interval" ? { type, every: 2, unit: "day", anchorDate: today } : type === "specificDates" ? { type, dates: [today] } : { type: "manual" });
  function save() {
    const validTasks = tasks.filter((task) => task.label.trim());
    if (!name.trim() || !validTasks.length) return;
    const timestamp = new Date().toISOString();
    onSave({ id: initial?.id ?? crypto.randomUUID(), name: name.trim(), areaId: area, icon: initial?.icon ?? (area === "Trading" ? "↗" : area === "Health" ? "♥" : "◆"), nextAction: nextAction.trim() || validTasks[0].label.trim(), schedule, completionRule, graceMinutes: Math.max(0, graceMinutes), sortOrder: initial?.sortOrder ?? 999, createdAt: initial?.createdAt ?? timestamp, updatedAt: timestamp, tasks: validTasks.map((task, order) => ({ ...task, label: task.label.trim(), order, type: initial?.tasks.find((value) => value.id === task.id)?.type ?? "check" })) });
  }
  return <Modal onClose={onClose} wide title={initial ? "Edit routine" : "New routine"}><span className="eyebrow">{initial ? "EDIT ROUTINE" : "NEW ROUTINE"}</span><h2>{initial ? "Adjust the routine rules" : "What are you working on?"}</h2><div className="field"><label>Routine name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Study French" /></label></div><div className="field split"><label>Life area<select value={area} onChange={(event) => setArea(event.target.value)}>{["Personal", "Health", "Learning", "Work", "Trading"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Schedule<select value={schedule.type} onChange={(event) => setScheduleType(event.target.value as ScheduleRule["type"])}><option value="daily">Every day</option><option value="weekdays">Selected weekdays</option><option value="timesPerWeek">Times per week</option><option value="interval">Interval</option><option value="specificDates">Specific dates</option><option value="manual">Manual activation</option></select></label></div><ScheduleFields schedule={schedule} setSchedule={setSchedule} today={today} /><div className="field"><label>Completion rule<select value={completionRule.type} onChange={(event) => { const type = event.target.value as "allRequired" | "percentage" | "count"; setCompletionRule(type === "allRequired" ? { type } : type === "percentage" ? { type, threshold: 75 } : { type, requiredCount: 1 }); }}><option value="allRequired">All required tasks</option><option value="percentage">Percentage threshold</option><option value="count">Task count</option>{completionRule.type === "duration" && <option value="duration">Duration target (legacy)</option>}</select></label></div><CompletionFields rule={completionRule} setRule={setCompletionRule} /><div className="field"><label>Grace period after midnight (minutes)<input type="number" min="0" max="1440" value={graceMinutes} onChange={(event) => setGraceMinutes(Number(event.target.value))} /></label></div><div className="field"><label>Tasks</label><div className="task-editor">{tasks.map((task, index) => <div key={task.id}><input aria-label={`Task ${index + 1}`} value={task.label} onChange={(event) => setTasks((current) => current.map((value) => value.id === task.id ? { ...value, label: event.target.value } : value))} placeholder="Task name" /><label><input type="checkbox" checked={task.required} onChange={(event) => setTasks((current) => current.map((value) => value.id === task.id ? { ...value, required: event.target.checked } : value))} /> Required</label><label><input type="checkbox" checked={task.countsTowardProgress} onChange={(event) => setTasks((current) => current.map((value) => value.id === task.id ? { ...value, countsTowardProgress: event.target.checked } : value))} /> Counts toward progress</label>{tasks.length > 1 && <button type="button" onClick={() => setTasks((current) => current.filter((value) => value.id !== task.id))}>Remove</button>}</div>)}</div><button className="mini-link add-task" type="button" onClick={() => setTasks((current) => [...current, { id: crypto.randomUUID(), label: "", required: true, countsTowardProgress: true }])}>+ Add task</button></div><div className="field"><label>What comes next?<input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Your immediate focus" /></label></div><button className="primary-button wide-button" disabled={!name.trim() || !tasks.some((task) => task.label.trim())} onClick={save}>{initial ? "Save routine" : "Add routine"}</button></Modal>;
}

function ScheduleFields({ schedule, setSchedule, today }: { schedule: ScheduleRule; setSchedule: (schedule: ScheduleRule) => void; today: ISODate }) {
  if (schedule.type === "weekdays") return <div className="weekday-picker" aria-label="Selected weekdays">{["S", "M", "T", "W", "T", "F", "S"].map((label, day) => <button type="button" key={`${label}-${day}`} aria-pressed={schedule.days.includes(day)} className={schedule.days.includes(day) ? "selected" : ""} onClick={() => setSchedule({ ...schedule, days: schedule.days.includes(day) ? schedule.days.filter((value) => value !== day) : [...schedule.days, day].sort() })}>{label}</button>)}</div>;
  if (schedule.type === "timesPerWeek") return <div className="field"><label>Target completions per week<input type="number" min="1" max="7" value={schedule.count} onChange={(event) => setSchedule({ ...schedule, count: Math.min(7, Math.max(1, Number(event.target.value))) })} /></label></div>;
  if (schedule.type === "interval") return <div className="field split"><label>Every<input type="number" min="1" value={schedule.every} onChange={(event) => setSchedule({ ...schedule, every: Math.max(1, Number(event.target.value)) })} /></label><label>Unit<select value={schedule.unit} onChange={(event) => setSchedule({ ...schedule, unit: event.target.value as "day" | "week" })}><option value="day">Day(s)</option><option value="week">Week(s)</option></select></label><label>Anchor date<input type="date" value={schedule.anchorDate || today} onChange={(event) => setSchedule({ ...schedule, anchorDate: event.target.value })} /></label></div>;
  if (schedule.type === "specificDates") return <SpecificDateFields schedule={schedule} setSchedule={setSchedule} today={today} />;
  if (schedule.type === "manual") return <p className="helper-message">This routine is neutral until you activate it for a date—ideal for “only on days I trade” or other event-based routines.</p>;
  return null;
}

function SpecificDateFields({ schedule, setSchedule, today }: { schedule: Extract<ScheduleRule, { type: "specificDates" }>; setSchedule: (schedule: ScheduleRule) => void; today: ISODate }) {
  const [nextDate, setNextDate] = useState(today);
  function addDate() { if (nextDate && !schedule.dates.includes(nextDate)) setSchedule({ ...schedule, dates: [...schedule.dates, nextDate].sort() }); }
  return <div className="field"><label>Add a due date<input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></label><button type="button" className="mini-link add-task" onClick={addDate}>+ Add date</button><div className="date-chips">{schedule.dates.map((date) => <button type="button" key={date} onClick={() => setSchedule({ ...schedule, dates: schedule.dates.filter((value) => value !== date) })}>{date} ×</button>)}</div></div>;
}

function CompletionFields({ rule, setRule }: { rule: CompletionRule; setRule: (rule: CompletionRule) => void }) {
  if (rule.type === "percentage") return <div className="field"><label>Required percentage<input type="number" min="1" max="100" value={rule.threshold} onChange={(event) => setRule({ ...rule, threshold: Math.min(100, Math.max(1, Number(event.target.value))) })} /></label></div>;
  if (rule.type === "count") return <div className="field"><label>Required task count<input type="number" min="1" value={rule.requiredCount} onChange={(event) => setRule({ ...rule, requiredCount: Math.max(1, Number(event.target.value)) })} /></label></div>;
  if (rule.type === "duration") return <div className="field"><label>Target minutes<input type="number" min="1" value={rule.targetMinutes} onChange={(event) => setRule({ ...rule, targetMinutes: Math.max(1, Number(event.target.value)) })} /></label></div>;
  return null;
}

function SettingsView({ state, onSettings }: { state: AppStateV3; onSettings: (settings: AppSettings) => void }) {
  const settings = state.settings;
  function save(next: AppSettings) { onSettings(next); }
  function exportData() { downloadFile(JSON.stringify(state, null, 2), "habit-tracker-v3-data-export.json", "application/json"); }
  const rule = settings.successfulDayRule;
  return <><div className="page-intro"><span className="eyebrow">PREFERENCES</span><h1>Make it yours.</h1><p>Routine rules, time boundaries, and data controls live here.</p></div><div className="settings-group"><h2>Calendar & success</h2><div className="settings-editor"><label>Time zone<select value={settings.timeZone} onChange={(event) => save({ ...settings, timeZone: event.target.value })}><option value="America/Toronto">America/Toronto</option><option value="America/New_York">America/New_York</option><option value="UTC">UTC</option></select></label><label>Week starts on<select value={settings.weekStartsOn} onChange={(event) => save({ ...settings, weekStartsOn: Number(event.target.value) })}>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label><label>Successful day rule<select value={rule.type} onChange={(event) => { const type = event.target.value; save({ ...settings, successfulDayRule: type === "percentage" ? { type, threshold: 75 } : type === "selectedRoutines" ? { type, routineIds: [] } : { type: "allDueRoutines" } }); }}><option value="allDueRoutines">Complete all due routines</option><option value="percentage">Percentage of due routines</option><option value="selectedRoutines">Selected routines</option></select></label>{rule.type === "percentage" && <label>Success threshold<input type="number" min="1" max="100" value={rule.threshold} onChange={(event) => save({ ...settings, successfulDayRule: { ...rule, threshold: Number(event.target.value) } })} /></label>}{rule.type === "selectedRoutines" && <fieldset><legend>Routines required for success</legend>{state.routines.map((routine) => <label key={routine.id}><input type="checkbox" checked={rule.routineIds.includes(routine.id)} onChange={(event) => save({ ...settings, successfulDayRule: { ...rule, routineIds: event.target.checked ? [...rule.routineIds, routine.id] : rule.routineIds.filter((id) => id !== routine.id) } })} /> {routine.name}</label>)}</fieldset>}</div></div><div className="settings-group"><h2>Journal</h2><SettingRow title="Daily journal reminder" detail="Prompt me during the evening routine" /><SettingRow title="Microphone & photos" detail="Permissions are requested only when used" /></div><div className="settings-group"><h2>Your data</h2><SettingRow title="Download V3 data export" detail="Versioned routines, check-ins, settings, and journal metadata" onClick={exportData} /><SettingRow title="Generate PDF report" detail="Open a print-ready view" onClick={() => window.print()} /><SettingRow title="Notification permission" detail="Enable browser reminders while supported" onClick={() => "Notification" in window && window.Notification.requestPermission()} /></div></>;
}

function completionLabel(rule: CompletionRule) { if (rule.type === "allRequired") return "all required"; if (rule.type === "percentage") return `${rule.threshold}% required`; if (rule.type === "count") return `${rule.requiredCount} tasks required`; return `${rule.targetMinutes} minutes required`; }
function weeklyValues(state: AppStateV3, date: ISODate) { return weekDates(date, state.settings.weekStartsOn).map((value) => { const progress = dueProgressForDate(state, value); const legacy = state.legacyDailySnapshots.find((snapshot) => snapshot.date === value); return { date: value, day: new Date(`${value}T12:00:00Z`).toLocaleString("en", { weekday: "narrow", timeZone: "UTC" }), value: progress.neutral ? legacy?.completionPercent ?? 0 : progress.percent, neutral: progress.neutral && !legacy }; }); }
function weeklyAverage(state: AppStateV3, date: ISODate) { const scored = weeklyValues(state, date).filter((value) => !value.neutral); return scored.length ? Math.round(scored.reduce((sum, item) => sum + item.value, 0) / scored.length) : 0; }
function WeekBars({ state, today }: { state: AppStateV3; today: ISODate }) { return <div className="week-bars">{weeklyValues(state, today).map((item) => <div className="day-bar" key={item.date} title={item.neutral ? "Neutral day" : `${item.value}%`}><div className="bar-track"><i className={item.neutral ? "neutral-bar" : ""} style={{ height: `${item.neutral ? 4 : Math.max(item.value, 7)}%` }} /></div><span>{item.day}</span></div>)}</div>; }
function ProgressRing({ percent, label }: { percent: number; label: string }) { return <div className="ring" role="img" aria-label={label} style={{ "--progress": `${percent * 3.6}deg` } as React.CSSProperties}><div><strong>{percent}%</strong><span>complete</span></div></div>; }
function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) { return <button aria-current={active ? "page" : undefined} className={active ? "active" : ""} onClick={onClick}><span aria-hidden="true">{icon}</span><small>{label}</small></button>; }
function SettingRow({ title, detail, onClick }: { title: string; detail: string; onClick?: () => void }) { return <button className="setting-row" onClick={onClick}><span><strong>{title}</strong><small>{detail}</small></span><b aria-hidden="true">›</b></button>; }
function downloadFile(content: string, filename: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
