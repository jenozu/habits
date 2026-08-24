"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { JournalComposer, type PendingAttachment } from "./components/journal-composer";
import { Modal } from "./components/modal";
import { useAppStore } from "./hooks/use-app-store";
import { useCurrentDate } from "./hooks/use-current-date";
import { createCheckIn, routineProgress, taskSnapshots, updateTaskCompletion } from "./lib/completion";
import { addDays, formatDateLabel, weekDates } from "./lib/date";
import { isRoutineAvailable, isRoutineDue, scheduleLabel } from "./lib/schedules";
import {
  activeStandaloneTasks,
  compareStandaloneTasks,
  overdueTasks,
  taskGroup,
  taskProgressForDate,
  tasksForDate,
  tasksInWeek,
  updateStandaloneTaskCompletion,
  type StandaloneTaskGroup,
} from "./lib/standalone-tasks";
import { calculateOverallStreak, dueProgressForDate } from "./lib/streaks";
import { deleteMedia, getMedia, saveMedia } from "./media-store";
import type {
  AppSettings,
  AppState,
  CompletionRule,
  ISODate,
  JournalAttachment,
  JournalEntry,
  RoutineCheckIn,
  RoutineDefinition,
  ScheduleRule,
  StandaloneTask,
  StandaloneTaskPriority,
  TaskDefinition,
} from "./types/domain";

export type AppView = "dashboard" | "routines" | "tasks" | "journal" | "settings" | "routineDetail" | "taskDetail";
type DashboardMode = "day" | "week";

export default function HabitApp({ initialView = "dashboard", initialEntityId }: { initialView?: AppView; initialEntityId?: string }) {
  const { state, setState, hydrated, loadResult, saveError, resetAfterRecovery } = useAppStore();
  const currentDate = useCurrentDate(state.settings.timeZone);
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const previousCurrentDate = useRef(currentDate);
  const [view, setView] = useState<AppView>(initialView);
  const [entityId, setEntityId] = useState(initialEntityId);
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>("day");
  const [journalOpen, setJournalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineDefinition | null | undefined>(undefined);
  const [editingTask, setEditingTask] = useState<StandaloneTask | null | undefined>(undefined);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (selectedDate === previousCurrentDate.current) setSelectedDate(currentDate);
    previousCurrentDate.current = currentDate;
  }, [currentDate, selectedDate]);

  useEffect(() => {
    function handlePopState() {
      const destination = destinationFromPath(window.location.pathname);
      setView(destination.view);
      setEntityId(destination.id);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1900);
  }, []);

  function navigate(nextView: AppView, id?: string) {
    const path = pathForDestination(nextView, id);
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setView(nextView);
    setEntityId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleRoutineStep(routineId: string, taskId: string) {
    setState((current) => {
      const routine = current.routines.find((value) => value.id === routineId);
      if (!routine) return current;
      const index = current.checkIns.findIndex((value) => value.routineId === routineId && value.date === selectedDate);
      const existing = index >= 0
        ? current.checkIns[index]
        : createCheckIn(routine, selectedDate, true, routine.schedule.type === "manual" || routine.schedule.type === "timesPerWeek");
      const task = existing.taskCheckIns.find((value) => value.taskId === taskId);
      const updated = updateTaskCompletion(existing, taskId, !task?.completed, current.settings, new Date(), selectedDate !== currentDate);
      const checkIns = index >= 0
        ? current.checkIns.map((value, valueIndex) => valueIndex === index ? updated : value)
        : [...current.checkIns, updated];
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
    const wasEditing = Boolean(editingRoutine);
    setState((current) => {
      const exists = current.routines.some((value) => value.id === routine.id);
      return { ...current, routines: exists ? current.routines.map((value) => value.id === routine.id ? routine : value) : [...current.routines, routine] };
    });
    setEditingRoutine(undefined);
    showNotice(wasEditing ? "Routine updated" : "Routine added");
  }

  function archiveRoutine(routineId: string) {
    const archivedAt = new Date().toISOString();
    setState((current) => ({ ...current, routines: current.routines.map((routine) => routine.id === routineId ? { ...routine, archivedAt, updatedAt: archivedAt } : routine) }));
    setEditingRoutine(undefined);
    if (view === "routineDetail") navigate("routines");
    showNotice("Routine archived; history preserved");
  }

  function saveStandaloneTask(task: StandaloneTask) {
    const wasEditing = Boolean(editingTask);
    setState((current) => {
      const exists = current.standaloneTasks.some((value) => value.id === task.id);
      return { ...current, standaloneTasks: exists ? current.standaloneTasks.map((value) => value.id === task.id ? task : value) : [...current.standaloneTasks, task] };
    });
    setEditingTask(undefined);
    showNotice(wasEditing ? "Task updated" : "Task added");
  }

  function toggleStandaloneTask(taskId: string) {
    setState((current) => ({
      ...current,
      standaloneTasks: current.standaloneTasks.map((task) => task.id === taskId ? updateStandaloneTaskCompletion(task, !task.completedAt) : task),
    }));
    showNotice("Task updated");
  }

  function deleteStandaloneTask(taskId: string) {
    const deletedAt = new Date().toISOString();
    setState((current) => ({
      ...current,
      standaloneTasks: current.standaloneTasks.map((task) => task.id === taskId ? { ...task, deletedAt, updatedAt: deletedAt } : task),
    }));
    setEditingTask(undefined);
    navigate("tasks");
    showNotice("Task removed");
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

  const routine = view === "routineDetail" ? state.routines.find((value) => value.id === entityId) : undefined;
  const standaloneTask = view === "taskDetail" ? state.standaloneTasks.find((value) => value.id === entityId && !value.deletedAt) : undefined;
  const pageTitle = view === "routineDetail" ? "Routine" : view === "taskDetail" ? "Task" : view[0].toUpperCase() + view.slice(1);

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <div className="phone-frame">
        <header className="topbar">
          <div className="brand-mark">H</div>
          <div className="brand-copy"><span className="eyebrow">HABIT TRACKER</span><strong>{pageTitle}</strong></div>
          <button className="icon-button" aria-label="Notifications"><span className="bell">◔</span></button>
        </header>
        {(loadResult?.status === "error" || saveError) && (
          <div className="recovery-banner" role="alert">
            <strong>Your saved data needs attention.</strong>
            <span>{loadResult?.status === "error" ? loadResult.message : saveError}</span>
            {loadResult?.status === "error" && <div><button onClick={downloadRecovery}>Download original data</button><button onClick={resetAfterRecovery}>Start fresh after recovery</button></div>}
          </div>
        )}
        <section className="content">
          {view === "dashboard" && <DashboardView mode={dashboardMode} setMode={setDashboardMode} date={selectedDate} currentDate={currentDate} setDate={setSelectedDate} state={state} onToggleRoutine={toggleRoutineStep} onActivate={activateRoutine} onOpenRoutine={(id) => navigate("routineDetail", id)} onAddRoutine={() => setEditingRoutine(null)} onToggleTask={toggleStandaloneTask} onOpenTask={(id) => navigate("taskDetail", id)} onAddTask={() => setEditingTask(null)} />}
          {view === "routines" && <RoutinesView date={selectedDate} state={state} onOpen={(id) => navigate("routineDetail", id)} onAdd={() => setEditingRoutine(null)} />}
          {view === "tasks" && <TasksView date={currentDate} tasks={state.standaloneTasks} onToggle={toggleStandaloneTask} onOpen={(id) => navigate("taskDetail", id)} onAdd={() => setEditingTask(null)} />}
          {view === "routineDetail" && <RoutineDetailView routine={routine} date={selectedDate} currentDate={currentDate} setDate={setSelectedDate} state={state} onBack={() => navigate("routines")} onToggle={toggleRoutineStep} onActivate={activateRoutine} onEdit={(value) => setEditingRoutine(value)} />}
          {view === "taskDetail" && <TaskDetailView task={standaloneTask} onBack={() => navigate("tasks")} onToggle={toggleStandaloneTask} onEdit={(value) => setEditingTask(value)} onDelete={deleteStandaloneTask} />}
          {view === "journal" && <JournalView entries={state.journalEntries} attachments={state.attachments} onNew={() => setJournalOpen(true)} />}
          {view === "settings" && <SettingsView state={state} onSettings={updateSettings} />}
        </section>
        <nav className="bottom-nav" aria-label="Primary navigation">
          <NavButton active={view === "dashboard"} icon="⌂" label="Home" onClick={() => navigate("dashboard")} />
          <NavButton active={view === "routines" || view === "routineDetail"} icon="↻" label="Routines" onClick={() => navigate("routines")} />
          <NavButton active={view === "tasks" || view === "taskDetail"} icon="✓" label="Tasks" onClick={() => navigate("tasks")} />
          <NavButton active={view === "journal"} icon="≡" label="Journal" onClick={() => navigate("journal")} />
          <NavButton active={view === "settings"} icon="⚙" label="Settings" onClick={() => navigate("settings")} />
        </nav>
      </div>
      {journalOpen && <JournalComposer date={selectedDate} onClose={() => setJournalOpen(false)} onSave={addJournal} />}
      {editingRoutine !== undefined && <RoutineComposer initial={editingRoutine ?? undefined} today={currentDate} onClose={() => setEditingRoutine(undefined)} onSave={saveRoutine} onArchive={editingRoutine ? () => archiveRoutine(editingRoutine.id) : undefined} />}
      {editingTask !== undefined && <StandaloneTaskComposer initial={editingTask ?? undefined} defaultDate={selectedDate} onClose={() => setEditingTask(undefined)} onSave={saveStandaloneTask} />}
      {notice && <div className="toast" role="status">✓ {notice}</div>}
    </main>
  );
}

function DashboardView({ mode, setMode, date, currentDate, setDate, state, onToggleRoutine, onActivate, onOpenRoutine, onAddRoutine, onToggleTask, onOpenTask, onAddTask }: { mode: DashboardMode; setMode: (mode: DashboardMode) => void; date: ISODate; currentDate: ISODate; setDate: (date: ISODate) => void; state: AppState; onToggleRoutine: (routineId: string, taskId: string) => void; onActivate: (routineId: string) => void; onOpenRoutine: (id: string) => void; onAddRoutine: () => void; onToggleTask: (id: string) => void; onOpenTask: (id: string) => void; onAddTask: () => void }) {
  const routineTotals = dueProgressForDate(state, date);
  const taskTotals = taskProgressForDate(state.standaloneTasks, date);
  const streak = calculateOverallStreak(state, currentDate);
  const dueRoutines = state.routines.filter((routine) => isRoutineDue(routine, date, state.checkIns, state.settings));
  const available = state.routines.filter((routine) => isRoutineAvailable(routine, date, state.checkIns, state.settings));
  const dayTasks = tasksForDate(state.standaloneTasks, date);
  const lateTasks = date === currentDate ? overdueTasks(state.standaloneTasks, date) : [];

  return <>
    <div className="view-switch" role="group" aria-label="Dashboard range"><button className={mode === "day" ? "selected" : ""} aria-pressed={mode === "day"} onClick={() => setMode("day")}>Day</button><button className={mode === "week" ? "selected" : ""} aria-pressed={mode === "week"} onClick={() => setMode("week")}>Week</button></div>
    {mode === "day" ? <>
      <DateNavigator date={date} currentDate={currentDate} setDate={setDate} />
      <div className="greeting-row"><div><p className="date-label">{formatDateLabel(date, state.settings.timeZone)}</p><h1>Your day,<br />clearly mapped.</h1></div><div className="streak-pill"><span>🔥</span><strong>{streak}</strong><small>day streak</small></div></div>
      <div className="dashboard-metrics"><article><span>ROUTINES</span><strong>{routineTotals.neutral ? "—" : `${routineTotals.percent}%`}</strong><small>{routineTotals.neutral ? "Neutral day" : `${routineTotals.complete}/${routineTotals.total} complete`}</small></article><article><span>TASKS</span><strong>{taskTotals.total ? `${taskTotals.percent}%` : "—"}</strong><small>{taskTotals.total ? `${taskTotals.complete}/${taskTotals.total} complete` : "Nothing due"}</small></article></div>
      <SectionHeading eyebrow="ROUTINES" title="Due this day" action="+ Add routine" onAction={onAddRoutine} />
      <div className="routine-stack">{dueRoutines.length ? dueRoutines.map((routine) => <RoutineChecklist key={routine.id} routine={routine} checkIn={state.checkIns.find((value) => value.routineId === routine.id && value.date === date)} onToggle={onToggleRoutine} onOpen={() => onOpenRoutine(routine.id)} />) : <EmptyState title="No routines are due" detail="This date is neutral unless you activate an available routine." />}</div>
      {available.length > 0 && <><SectionHeading eyebrow="AVAILABLE" title="Start when relevant" /><div className="available-list">{available.map((routine) => <article className="trade-card" key={routine.id}><button className="available-main" onClick={() => onOpenRoutine(routine.id)}><span className="trade-icon">{routine.icon}</span><span className="trade-copy"><strong>{routine.name}</strong><small>{scheduleLabel(routine.schedule)} · optional until activated</small></span></button><button className="compact-button" onClick={() => onActivate(routine.id)}>Activate</button></article>)}</div></>}
      <SectionHeading eyebrow="TASKS" title="Due this day" action="+ Add task" onAction={onAddTask} />
      <div className="standalone-list">{[...lateTasks, ...dayTasks].length ? [...lateTasks, ...dayTasks].map((task) => <StandaloneTaskRow key={task.id} task={task} today={date} onToggle={onToggleTask} onOpen={onOpenTask} />) : <EmptyState title="No tasks due" detail="Add a one-time task for this date, or leave it in Anytime." />}</div>
    </> : <WeeklyDashboard date={date} currentDate={currentDate} state={state} setDate={(next) => { setDate(next); setMode("day"); }} onOpenTask={onOpenTask} />}
  </>;
}

function WeeklyDashboard({ date, currentDate, state, setDate, onOpenTask }: { date: ISODate; currentDate: ISODate; state: AppState; setDate: (date: ISODate) => void; onOpenTask: (id: string) => void }) {
  const dates = weekDates(date, state.settings.weekStartsOn);
  const weekTasks = tasksInWeek(state.standaloneTasks, date, state.settings.weekStartsOn);
  const completedTasks = weekTasks.filter((task) => task.completedAt).length;
  const scoredRoutineDays = dates.map((value) => dueProgressForDate(state, value)).filter((value) => !value.neutral);
  const routineAverage = scoredRoutineDays.length ? Math.round(scoredRoutineDays.reduce((sum, value) => sum + value.percent, 0) / scoredRoutineDays.length) : 0;
  return <>
    <div className="page-intro weekly-intro"><span className="eyebrow">YOUR CONFIGURED WEEK</span><h1>See the whole<br />week at a glance.</h1><p>Routine consistency and one-time tasks stay separate, so errands never change your streak.</p></div>
    <div className="week-strip">{dates.map((value) => { const progress = dueProgressForDate(state, value); const tasks = tasksForDate(state.standaloneTasks, value); return <button key={value} className={value === currentDate ? "today" : ""} onClick={() => setDate(value)}><span>{new Date(`${value}T12:00:00Z`).toLocaleString("en", { weekday: "narrow", timeZone: "UTC" })}</span><strong>{Number(value.slice(-2))}</strong><i style={{ "--day-progress": `${progress.percent}%` } as React.CSSProperties} /><small>{tasks.length ? `${tasks.filter((task) => task.completedAt).length}/${tasks.length}` : "—"}</small></button>; })}</div>
    <div className="dashboard-metrics weekly-metrics"><article><span>ROUTINE CONSISTENCY</span><strong>{scoredRoutineDays.length ? `${routineAverage}%` : "—"}</strong><small>{scoredRoutineDays.length ? `${scoredRoutineDays.length} active day${scoredRoutineDays.length === 1 ? "" : "s"}` : "No scored days"}</small></article><article><span>WEEKLY TASKS</span><strong>{weekTasks.length ? `${Math.round((completedTasks / weekTasks.length) * 100)}%` : "—"}</strong><small>{completedTasks}/{weekTasks.length} complete</small></article></div>
    <SectionHeading eyebrow="ROUTINE RHYTHM" title="Consistency by day" />
    <article className="week-card"><WeekBars state={state} date={date} /><div className="week-insight"><span>◆</span><p><strong>{routineAverage >= 75 ? "You’re building momentum" : "Choose the next smallest step"}</strong><br />Only due or activated routines affect routine consistency.</p></div></article>
    <SectionHeading eyebrow="THIS WEEK" title="Scheduled tasks" />
    <div className="standalone-list">{weekTasks.length ? weekTasks.map((task) => <StandaloneTaskRow key={task.id} task={task} today={currentDate} onToggle={() => undefined} onOpen={onOpenTask} readOnly />) : <EmptyState title="No tasks scheduled" detail="Your Anytime tasks remain available on the Tasks page." />}</div>
  </>;
}

function RoutinesView({ date, state, onOpen, onAdd }: { date: ISODate; state: AppState; onOpen: (id: string) => void; onAdd: () => void }) {
  const active = state.routines.filter((routine) => !routine.archivedAt).sort((left, right) => left.sortOrder - right.sortOrder);
  const archived = state.routines.filter((routine) => routine.archivedAt);
  return <>
    <div className="page-intro"><span className="eyebrow">REPEATING RHYTHMS</span><h1>Your routines.</h1><p>Recurring behaviours live here. Open any card to see its schedule, checklist, next step, and history.</p></div>
    <SectionHeading eyebrow="ACTIVE" title="All routines" action="+ Add routine" onAction={onAdd} />
    <div className="focus-list">{active.map((routine) => { const checkIn = state.checkIns.find((value) => value.routineId === routine.id && value.date === date); return <RoutineSummaryCard key={routine.id} routine={routine} checkIn={checkIn} state={state} date={date} onOpen={() => onOpen(routine.id)} />; })}</div>
    {archived.length > 0 && <><SectionHeading eyebrow="HISTORY PRESERVED" title="Archived routines" /><div className="focus-list muted-list">{archived.map((routine) => <RoutineSummaryCard key={routine.id} routine={routine} state={state} date={date} onOpen={() => onOpen(routine.id)} />)}</div></>}
  </>;
}

function RoutineDetailView({ routine, date, currentDate, setDate, state, onBack, onToggle, onActivate, onEdit }: { routine?: RoutineDefinition; date: ISODate; currentDate: ISODate; setDate: (date: ISODate) => void; state: AppState; onBack: () => void; onToggle: (routineId: string, taskId: string) => void; onActivate: (routineId: string) => void; onEdit: (routine: RoutineDefinition) => void }) {
  if (!routine) return <NotFound title="Routine not found" onBack={onBack} />;
  const checkIn = state.checkIns.find((value) => value.routineId === routine.id && value.date === date);
  const due = isRoutineDue(routine, date, state.checkIns, state.settings);
  const available = isRoutineAvailable(routine, date, state.checkIns, state.settings);
  const snapshots = checkIn?.taskSnapshots ?? taskSnapshots(routine);
  const next = snapshots.find((task) => !checkIn?.taskCheckIns.find((value) => value.taskId === task.id)?.completed);
  const history = state.checkIns.filter((value) => value.routineId === routine.id).sort((left, right) => right.date.localeCompare(left.date)).slice(0, 8);
  return <>
    <button className="back-button" onClick={onBack}>‹ All routines</button>
    <article className="detail-hero"><div className="detail-icon">{routine.icon}</div><span className="eyebrow light">{routine.areaId}</span><h1>{routine.name}</h1><p>{scheduleLabel(routine.schedule)} · {completionLabel(routine.completionRule)}</p><div className="detail-progress"><strong>{routineProgress(checkIn)}%</strong><span>for this date</span></div></article>
    <DateNavigator date={date} currentDate={currentDate} setDate={setDate} />
    <div className="detail-meta"><article><span>NEXT STEP</span><strong>{due ? next?.label ?? "Routine complete" : routine.nextAction ?? "Review the routine"}</strong></article><article><span>GRACE PERIOD</span><strong>{routine.graceMinutes ? `${routine.graceMinutes} minutes` : "None"}</strong></article></div>
    <div className="detail-actions"><button className="secondary-button" onClick={() => onEdit(routine)}>Edit routine</button>{available && <button className="primary-button" onClick={() => onActivate(routine.id)}>Activate for this date</button>}</div>
    <SectionHeading eyebrow={due ? "CHECKLIST" : "NOT DUE"} title={due ? "Routine steps" : scheduleLabel(routine.schedule)} />
    {due ? <article className="routine-block detail-checklist"><div className="task-list compact-list">{snapshots.map((task) => { const complete = checkIn?.taskCheckIns.find((value) => value.taskId === task.id)?.completed === true; return <button key={task.id} role="checkbox" aria-checked={complete} className={`task-row ${complete ? "done" : ""}`} onClick={() => onToggle(routine.id, task.id)}><span className="checkmark">{complete ? "✓" : ""}</span><span className="task-copy"><strong>{task.label}</strong>{!task.required && <small>{task.countsTowardProgress ? "Optional · scored" : "Optional · unscored"}</small>}</span></button>; })}</div></article> : <EmptyState title="Nothing required on this date" detail="The routine remains active and will appear when its schedule is due." />}
    <SectionHeading eyebrow="RECENT HISTORY" title="Check-ins" />
    <div className="history-list">{history.length ? history.map((value) => <button key={value.id} onClick={() => setDate(value.date)}><span>{value.date}</span><strong>{value.completionPercent}%</strong><small>{value.completed ? "Complete" : "Incomplete"}</small></button>) : <EmptyState title="No check-ins yet" detail="History will appear after the routine is due or activated." />}</div>
  </>;
}

function TasksView({ date, tasks, onToggle, onOpen, onAdd }: { date: ISODate; tasks: StandaloneTask[]; onToggle: (id: string) => void; onOpen: (id: string) => void; onAdd: () => void }) {
  const groups: { key: StandaloneTaskGroup; label: string; eyebrow: string }[] = [
    { key: "overdue", label: "Needs attention", eyebrow: "OVERDUE" },
    { key: "today", label: "Due today", eyebrow: "TODAY" },
    { key: "upcoming", label: "Coming up", eyebrow: "UPCOMING" },
    { key: "anytime", label: "No date required", eyebrow: "ANYTIME" },
    { key: "completed", label: "Finished tasks", eyebrow: "COMPLETED" },
  ];
  const active = activeStandaloneTasks(tasks).sort(compareStandaloneTasks);
  return <>
    <div className="page-intro task-page-intro"><span className="eyebrow">ONE-TIME ACTIONS</span><h1>Your tasks.</h1><p>Use tasks for dated or one-off work. Repeating behaviours belong under Routines.</p><button className="primary-button" onClick={onAdd}>+ Add task</button></div>
    {groups.map((group) => { const values = active.filter((task) => taskGroup(task, date) === group.key); if (!values.length) return null; return <div key={group.key}><SectionHeading eyebrow={group.eyebrow} title={group.label} /><div className="standalone-list">{values.map((task) => <StandaloneTaskRow key={task.id} task={task} today={date} onToggle={onToggle} onOpen={onOpen} />)}</div></div>; })}
    {!active.length && <EmptyState title="Your task list is clear" detail="Add a dated task or an Anytime item when something comes up." />}
  </>;
}

function TaskDetailView({ task, onBack, onToggle, onEdit, onDelete }: { task?: StandaloneTask; onBack: () => void; onToggle: (id: string) => void; onEdit: (task: StandaloneTask) => void; onDelete: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!task) return <NotFound title="Task not found" onBack={onBack} />;
  return <>
    <button className="back-button" onClick={onBack}>‹ All tasks</button>
    <article className={`task-detail ${task.completedAt ? "complete" : ""}`}><span className={`priority-badge ${task.priority}`}>{task.priority} priority</span><h1>{task.title}</h1><p>{task.notes || "No additional notes."}</p><div className="task-detail-date"><span>DUE</span><strong>{task.dueDate ? formatTaskDate(task.dueDate) : "Anytime"}{task.dueTime ? ` at ${task.dueTime}` : ""}</strong></div><button className={task.completedAt ? "secondary-button wide" : "primary-button wide"} onClick={() => onToggle(task.id)}>{task.completedAt ? "Mark as incomplete" : "Complete task"}</button></article>
    <div className="detail-actions"><button className="secondary-button" onClick={() => onEdit(task)}>Edit task</button><button className="danger-button" onClick={() => setConfirmDelete(true)}>Delete task</button></div>
    {confirmDelete && <Modal title="Delete task" subtitle="This removes the task from active lists. Existing app data remains otherwise unchanged." onClose={() => setConfirmDelete(false)}><button className="danger-button wide" onClick={() => onDelete(task.id)}>Delete this task</button><button className="text-button wide" onClick={() => setConfirmDelete(false)}>Keep task</button></Modal>}
  </>;
}

function RoutineChecklist({ routine, checkIn, onToggle, onOpen }: { routine: RoutineDefinition; checkIn?: RoutineCheckIn; onToggle: (routineId: string, taskId: string) => void; onOpen: () => void }) {
  const snapshots = checkIn?.taskSnapshots ?? taskSnapshots(routine);
  return <article className="routine-block"><button className="routine-card-header" onClick={onOpen} aria-label={`Open ${routine.name} details`}><span className="routine-icon">{routine.icon}</span><span className="routine-heading"><small className="eyebrow">{routine.areaId}</small><strong>{routine.name}</strong><em>{scheduleLabel(routine.schedule)}</em></span><span className="routine-percent">{routineProgress(checkIn)}%</span><span className="card-chevron" aria-hidden="true">›</span></button><div className="slim-progress" role="progressbar" aria-label={`${routine.name} progress`} aria-valuenow={routineProgress(checkIn)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${routineProgress(checkIn)}%` }} /></div><div className="task-list compact-list">{snapshots.map((task) => { const complete = checkIn?.taskCheckIns.find((value) => value.taskId === task.id)?.completed === true; return <button key={task.id} role="checkbox" aria-checked={complete} className={`task-row ${complete ? "done" : ""}`} onClick={() => onToggle(routine.id, task.id)}><span className="checkmark">{complete ? "✓" : ""}</span><span className="task-copy"><strong>{task.label}</strong>{!task.required && <small>{task.countsTowardProgress ? "Optional · scored" : "Optional · unscored"}</small>}</span></button>; })}</div></article>;
}

function RoutineSummaryCard({ routine, checkIn, state, date, onOpen }: { routine: RoutineDefinition; checkIn?: RoutineCheckIn; state: AppState; date: ISODate; onOpen: () => void }) {
  const due = isRoutineDue(routine, date, state.checkIns, state.settings);
  return <button className="routine-summary-card" onClick={onOpen}><span className="routine-icon">{routine.icon}</span><span><small className="eyebrow">{routine.areaId}</small><strong>{routine.name}</strong><em>{routine.archivedAt ? "Archived · history preserved" : due ? "Due today" : scheduleLabel(routine.schedule)}</em></span><b>{routineProgress(checkIn)}%</b><i aria-hidden="true">›</i></button>;
}

function StandaloneTaskRow({ task, today, onToggle, onOpen, readOnly = false }: { task: StandaloneTask; today: ISODate; onToggle: (id: string) => void; onOpen: (id: string) => void; readOnly?: boolean }) {
  const group = taskGroup(task, today);
  return <article className={`standalone-task-row ${task.completedAt ? "complete" : ""}`}><button className="standalone-check" role="checkbox" aria-checked={Boolean(task.completedAt)} aria-label={`${task.completedAt ? "Reopen" : "Complete"} ${task.title}`} disabled={readOnly} onClick={() => onToggle(task.id)}>{task.completedAt ? "✓" : ""}</button><button className="standalone-main" onClick={() => onOpen(task.id)}><span><strong>{task.title}</strong><small className={group === "overdue" ? "overdue" : ""}>{task.dueDate ? `${group === "overdue" ? "Overdue · " : ""}${formatTaskDate(task.dueDate)}${task.dueTime ? ` · ${task.dueTime}` : ""}` : "Anytime"}</small></span><span className={`priority-dot ${task.priority}`} aria-label={`${task.priority} priority`} /><i aria-hidden="true">›</i></button></article>;
}

function StandaloneTaskComposer({ initial, defaultDate, onClose, onSave }: { initial?: StandaloneTask; defaultDate: ISODate; onClose: () => void; onSave: (task: StandaloneTask) => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? defaultDate);
  const [dueTime, setDueTime] = useState(initial?.dueTime ?? "");
  const [priority, setPriority] = useState<StandaloneTaskPriority>(initial?.priority ?? "normal");
  const [anytime, setAnytime] = useState(!initial?.dueDate);
  function save() {
    if (!title.trim()) return;
    const timestamp = new Date().toISOString();
    onSave({ id: initial?.id ?? crypto.randomUUID(), title: title.trim(), notes: notes.trim() || undefined, dueDate: anytime ? undefined : dueDate, dueTime: anytime || !dueTime ? undefined : dueTime, priority, completedAt: initial?.completedAt, createdAt: initial?.createdAt ?? timestamp, updatedAt: timestamp });
  }
  return <Modal onClose={onClose} wide title={initial ? "Edit task" : "New task"}><span className="eyebrow">{initial ? "EDIT ONE-TIME TASK" : "NEW ONE-TIME TASK"}</span><h2>{initial ? "Update this task" : "What needs to get done?"}</h2><div className="field"><label>Task title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Book dentist appointment" /></label></div><div className="field"><label>Notes <span className="optional">optional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add useful details…" /></label></div><div className="field"><label className="inline-check"><input type="checkbox" checked={anytime} onChange={(event) => setAnytime(event.target.checked)} /> Keep in Anytime without a due date</label></div>{!anytime && <div className="field split"><label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label>Due time <span className="optional">optional</span><input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} /></label></div>}<div className="field"><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as StandaloneTaskPriority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label></div><button className="primary-button wide-button" disabled={!title.trim()} onClick={save}>{initial ? "Save changes" : "Add task"}</button></Modal>;
}

function JournalView({ entries, attachments, onNew }: { entries: JournalEntry[]; attachments: JournalAttachment[]; onNew: () => void }) {
  return <><div className="journal-hero"><span className="eyebrow light">DAILY JOURNAL</span><h1>Make sense<br />of your day.</h1><p>Write, speak, add photos, or leave a voice memo. This space is about your whole life.</p><button className="journal-new" onClick={onNew}>+ New journal entry</button></div><SectionHeading eyebrow="YOUR ENTRIES" title="Recent reflections" /><div className="entry-list">{entries.length ? entries.map((entry) => <JournalCard key={entry.id} entry={entry} attachments={attachments.filter((value) => entry.attachmentIds.includes(value.id))} />) : <EmptyState title="Your journal is ready" detail="At the end of today, record what happened, how you felt, and what you want to carry forward." />}</div></>;
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

function RoutineComposer({ initial, today, onClose, onSave, onArchive }: { initial?: RoutineDefinition; today: ISODate; onClose: () => void; onSave: (routine: RoutineDefinition) => void; onArchive?: () => void }) {
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
  return <Modal onClose={onClose} wide title={initial ? "Edit routine" : "New routine"}><span className="eyebrow">{initial ? "EDIT ROUTINE" : "NEW ROUTINE"}</span><h2>{initial ? "Adjust the routine rules" : "What are you working on?"}</h2><div className="field"><label>Routine name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Study French" /></label></div><div className="field split"><label>Life area<select value={area} onChange={(event) => setArea(event.target.value)}>{["Personal", "Health", "Learning", "Work", "Trading"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Schedule<select value={schedule.type} onChange={(event) => setScheduleType(event.target.value as ScheduleRule["type"])}><option value="daily">Every day</option><option value="weekdays">Selected weekdays</option><option value="timesPerWeek">Times per week</option><option value="interval">Interval</option><option value="specificDates">Specific dates</option><option value="manual">Manual activation</option></select></label></div><ScheduleFields schedule={schedule} setSchedule={setSchedule} today={today} /><div className="field"><label>Completion rule<select value={completionRule.type} onChange={(event) => { const type = event.target.value as "allRequired" | "percentage" | "count"; setCompletionRule(type === "allRequired" ? { type } : type === "percentage" ? { type, threshold: 75 } : { type, requiredCount: 1 }); }}><option value="allRequired">All required steps</option><option value="percentage">Percentage threshold</option><option value="count">Step count</option>{completionRule.type === "duration" && <option value="duration">Duration target (legacy)</option>}</select></label></div><CompletionFields rule={completionRule} setRule={setCompletionRule} /><div className="field"><label>Grace period after midnight (minutes)<input type="number" min="0" max="1440" value={graceMinutes} onChange={(event) => setGraceMinutes(Number(event.target.value))} /></label></div><div className="field"><label>Routine steps</label><div className="task-editor">{tasks.map((task, index) => <div key={task.id}><input aria-label={`Step ${index + 1}`} value={task.label} onChange={(event) => setTasks((current) => current.map((value) => value.id === task.id ? { ...value, label: event.target.value } : value))} placeholder="Step name" /><label><input type="checkbox" checked={task.required} onChange={(event) => setTasks((current) => current.map((value) => value.id === task.id ? { ...value, required: event.target.checked } : value))} /> Required</label><label><input type="checkbox" checked={task.countsTowardProgress} onChange={(event) => setTasks((current) => current.map((value) => value.id === task.id ? { ...value, countsTowardProgress: event.target.checked } : value))} /> Counts toward progress</label>{tasks.length > 1 && <button type="button" onClick={() => setTasks((current) => current.filter((value) => value.id !== task.id))}>Remove</button>}</div>)}</div><button className="mini-link add-task" type="button" onClick={() => setTasks((current) => [...current, { id: crypto.randomUUID(), label: "", required: true, countsTowardProgress: true }])}>+ Add step</button></div><div className="field"><label>What comes next?<input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Your immediate focus" /></label></div><button className="primary-button wide-button" disabled={!name.trim() || !tasks.some((task) => task.label.trim())} onClick={save}>{initial ? "Save routine" : "Add routine"}</button>{onArchive && <button className="archive-button" type="button" onClick={onArchive}>Archive routine and preserve history</button>}</Modal>;
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
  return <div className="field"><label>Add a due date<input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></label><button type="button" className="mini-link add-task" onClick={addDate}>+ Add date</button><div className="date-chips">{schedule.dates.map((value) => <button type="button" key={value} onClick={() => setSchedule({ ...schedule, dates: schedule.dates.filter((date) => date !== value) })}>{value} ×</button>)}</div></div>;
}

function CompletionFields({ rule, setRule }: { rule: CompletionRule; setRule: (rule: CompletionRule) => void }) {
  if (rule.type === "percentage") return <div className="field"><label>Required percentage<input type="number" min="1" max="100" value={rule.threshold} onChange={(event) => setRule({ ...rule, threshold: Math.min(100, Math.max(1, Number(event.target.value))) })} /></label></div>;
  if (rule.type === "count") return <div className="field"><label>Required step count<input type="number" min="1" value={rule.requiredCount} onChange={(event) => setRule({ ...rule, requiredCount: Math.max(1, Number(event.target.value)) })} /></label></div>;
  if (rule.type === "duration") return <div className="field"><label>Target minutes<input type="number" min="1" value={rule.targetMinutes} onChange={(event) => setRule({ ...rule, targetMinutes: Math.max(1, Number(event.target.value)) })} /></label></div>;
  return null;
}

function SettingsView({ state, onSettings }: { state: AppState; onSettings: (settings: AppSettings) => void }) {
  const settings = state.settings;
  const rule = settings.successfulDayRule;
  function exportData() { downloadFile(JSON.stringify(state, null, 2), "habit-tracker-v4-data-export.json", "application/json"); }
  return <><div className="page-intro"><span className="eyebrow">PREFERENCES</span><h1>Make it yours.</h1><p>Routine rules, time boundaries, and data controls live here.</p></div><div className="settings-group"><h2>Calendar & success</h2><div className="settings-editor"><label>Time zone<select value={settings.timeZone} onChange={(event) => onSettings({ ...settings, timeZone: event.target.value })}><option value="America/Toronto">America/Toronto</option><option value="America/New_York">America/New_York</option><option value="UTC">UTC</option></select></label><label>Week starts on<select value={settings.weekStartsOn} onChange={(event) => onSettings({ ...settings, weekStartsOn: Number(event.target.value) })}>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label><label>Successful day rule<select value={rule.type} onChange={(event) => { const type = event.target.value; onSettings({ ...settings, successfulDayRule: type === "percentage" ? { type, threshold: 75 } : type === "selectedRoutines" ? { type, routineIds: [] } : { type: "allDueRoutines" } }); }}><option value="allDueRoutines">Complete all due routines</option><option value="percentage">Percentage of due routines</option><option value="selectedRoutines">Selected routines</option></select></label>{rule.type === "percentage" && <label>Success threshold<input type="number" min="1" max="100" value={rule.threshold} onChange={(event) => onSettings({ ...settings, successfulDayRule: { ...rule, threshold: Number(event.target.value) } })} /></label>}{rule.type === "selectedRoutines" && <fieldset><legend>Routines required for success</legend>{state.routines.map((routine) => <label key={routine.id}><input type="checkbox" checked={rule.routineIds.includes(routine.id)} onChange={(event) => onSettings({ ...settings, successfulDayRule: { ...rule, routineIds: event.target.checked ? [...rule.routineIds, routine.id] : rule.routineIds.filter((id) => id !== routine.id) } })} /> {routine.name}</label>)}</fieldset>}</div></div><div className="settings-group"><h2>Journal</h2><SettingRow title="Daily journal reminder" detail="Prompt me during the evening routine" /><SettingRow title="Microphone & photos" detail="Permissions are requested only when used" /></div><div className="settings-group"><h2>Your data</h2><SettingRow title="Download V4 data export" detail="Versioned routines, tasks, check-ins, settings, and journal metadata" onClick={exportData} /><SettingRow title="Generate PDF report" detail="Open a print-ready view" onClick={() => window.print()} /><SettingRow title="Notification permission" detail="Enable browser reminders while supported" onClick={() => "Notification" in window && window.Notification.requestPermission()} /></div></>;
}

function DateNavigator({ date, currentDate, setDate }: { date: ISODate; currentDate: ISODate; setDate: (date: ISODate) => void }) {
  return <div className="date-navigator"><button aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</button><label><span>{date === currentDate ? "Viewing today" : "Editing history"}</span><input type="date" max={currentDate} value={date} onChange={(event) => setDate(event.target.value)} /></label><button aria-label="Next day" disabled={date >= currentDate} onClick={() => setDate(addDays(date, 1))}>›</button></div>;
}

function SectionHeading({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) { return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action && onAction && <button className="mini-link" onClick={onAction}>{action}</button>}</div>; }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="empty-state"><strong>{title}</strong><p>{detail}</p></div>; }
function NotFound({ title, onBack }: { title: string; onBack: () => void }) { return <div className="not-found"><span>◇</span><h1>{title}</h1><p>The item may have been archived, removed, or opened from a different browser profile.</p><button className="primary-button" onClick={onBack}>Go back</button></div>; }
function completionLabel(rule: CompletionRule) { if (rule.type === "allRequired") return "all required"; if (rule.type === "percentage") return `${rule.threshold}% required`; if (rule.type === "count") return `${rule.requiredCount} steps required`; return `${rule.targetMinutes} minutes required`; }
function weeklyValues(state: AppState, date: ISODate) { return weekDates(date, state.settings.weekStartsOn).map((value) => { const progress = dueProgressForDate(state, value); const legacy = state.legacyDailySnapshots.find((snapshot) => snapshot.date === value); return { date: value, day: new Date(`${value}T12:00:00Z`).toLocaleString("en", { weekday: "narrow", timeZone: "UTC" }), value: progress.neutral ? legacy?.completionPercent ?? 0 : progress.percent, neutral: progress.neutral && !legacy }; }); }
function WeekBars({ state, date }: { state: AppState; date: ISODate }) { return <div className="week-bars">{weeklyValues(state, date).map((item) => <div className="day-bar" key={item.date} title={item.neutral ? "Neutral day" : `${item.value}%`}><div className="bar-track"><i className={item.neutral ? "neutral-bar" : ""} style={{ height: `${item.neutral ? 4 : Math.max(item.value, 7)}%` }} /></div><span>{item.day}</span></div>)}</div>; }
function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) { return <button aria-current={active ? "page" : undefined} className={active ? "active" : ""} onClick={onClick}><span aria-hidden="true">{icon}</span><small>{label}</small></button>; }
function SettingRow({ title, detail, onClick }: { title: string; detail: string; onClick?: () => void }) { return <button className="setting-row" onClick={onClick}><span><strong>{title}</strong><small>{detail}</small></span><b aria-hidden="true">›</b></button>; }
function formatTaskDate(date: ISODate) { return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); }
function pathForDestination(view: AppView, id?: string) { if (view === "dashboard") return "/"; if (view === "routineDetail") return `/routines/${id ?? ""}`; if (view === "taskDetail") return `/tasks/${id ?? ""}`; return `/${view}`; }
function destinationFromPath(path: string): { view: AppView; id?: string } { const parts = path.split("/").filter(Boolean); if (!parts.length) return { view: "dashboard" }; if (parts[0] === "routines" && parts[1]) return { view: "routineDetail", id: decodeURIComponent(parts[1]) }; if (parts[0] === "tasks" && parts[1]) return { view: "taskDetail", id: decodeURIComponent(parts[1]) }; if (["routines", "tasks", "journal", "settings"].includes(parts[0])) return { view: parts[0] as AppView }; return { view: "dashboard" }; }
function downloadFile(content: string, filename: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
