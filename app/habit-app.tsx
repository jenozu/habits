"use client";

import { useEffect, useState } from "react";

type Tab = "today" | "progress" | "journal" | "settings";
type Task = { id: string; label: string; detail: string; done: boolean };
type ReviewRecord = { id?: number; reviewDate: string; followedPlan: boolean; tradeCount: number; pnl: number; tags: string[]; notes: string };
type ReviewDraft = Omit<ReviewRecord, "id" | "reviewDate">;

const starterTasks: Task[] = [
  { id: "priorities", label: "Review today’s priorities", detail: "Morning routine · 2 min", done: false },
  { id: "supplements", label: "Take supplements", detail: "Morning routine", done: false },
  { id: "review-day", label: "Review the day", detail: "Evening routine · after 8:00 PM", done: false },
  { id: "plan-tomorrow", label: "Plan tomorrow", detail: "Evening routine · after 8:00 PM", done: false },
];

const week = [
  { day: "M", value: 100 }, { day: "T", value: 75 }, { day: "W", value: 100 },
  { day: "T", value: 50 }, { day: "F", value: 0 }, { day: "S", value: 0 }, { day: "S", value: 0 },
];

const STORAGE_KEY = "habit-tracker-v1";

export default function HabitApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [tasks, setTasks] = useState(starterTasks);
  const [tradePrompt, setTradePrompt] = useState(false);
  const [tradeReview, setTradeReview] = useState(false);
  const [tradedToday, setTradedToday] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("");
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [today, setToday] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const complete = tasks.filter((task) => task.done).length;
  const percent = Math.round((complete / tasks.length) * 100);
  const dateLabel = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Toronto" }).format(new Date());

  useEffect(() => {
    const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    setToday(currentDate);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { date?: string; tasks?: Task[]; reviews?: ReviewRecord[]; tradedToday?: boolean | null } | null;
      if (saved?.date === currentDate && saved.tasks) setTasks(saved.tasks);
      if (saved?.reviews) setReviews(saved.reviews);
      if (saved?.date === currentDate) setTradedToday(saved.tradedToday ?? null);
    } catch { localStorage.removeItem(STORAGE_KEY); }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !today) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, tasks, reviews, tradedToday }));
  }, [hydrated, today, tasks, reviews, tradedToday]);

  function toggleTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    const completed = !task?.done;
    setTasks((current) => current.map((item) => item.id === id ? { ...item, done: completed } : item));
    setNotice("Progress saved");
    window.setTimeout(() => setNotice(""), 1600);
  }

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
          {tab === "today" && <TodayView dateLabel={dateLabel} tasks={tasks} complete={complete} percent={percent} tradedToday={tradedToday} onToggle={toggleTask} onTradePrompt={() => setTradePrompt(true)} onReview={() => setTradeReview(true)} />}
          {tab === "progress" && <ProgressView reviews={reviews} />}
          {tab === "journal" && <JournalView reviews={reviews} onReview={() => setTradeReview(true)} />}
          {tab === "settings" && <SettingsView tasks={tasks} reviews={reviews} />}
        </section>
        <nav className="bottom-nav" aria-label="Primary navigation">
          <NavButton active={tab === "today"} icon="✓" label="Today" onClick={() => setTab("today")} />
          <NavButton active={tab === "progress"} icon="↗" label="Progress" onClick={() => setTab("progress")} />
          <NavButton active={tab === "journal"} icon="≡" label="Journal" onClick={() => setTab("journal")} />
          <NavButton active={tab === "settings"} icon="⚙" label="Settings" onClick={() => setTab("settings")} />
        </nav>
      </div>
      {tradePrompt && <Modal title="Did you trade today?" subtitle="Your answer keeps the evening check-in accurate." onClose={() => setTradePrompt(false)}>
        <button className="primary-button" onClick={() => { setTradedToday(true); setTradePrompt(false); setTradeReview(true); }}>Yes, open my review</button>
        <button className="secondary-button" onClick={() => { setTradedToday(true); setTradePrompt(false); }}>Yes, I’ll review later</button>
        <button className="text-button" onClick={() => { setTradedToday(false); setTradePrompt(false); }}>No trades today</button>
      </Modal>}
      {tradeReview && <TradeReview onClose={() => setTradeReview(false)} onSave={(draft) => {
        const reviewDate = today || new Date().toISOString().slice(0, 10);
        const next = { ...draft, reviewDate };
        setReviews((current) => [next, ...current.filter((item) => item.reviewDate !== reviewDate)]);
        setTradedToday(true); setTradeReview(false); setNotice("Trading review saved");
      }} />}
      {notice && <div className="toast">✓ {notice}</div>}
    </main>
  );
}

function TodayView({ dateLabel, tasks, complete, percent, tradedToday, onToggle, onTradePrompt, onReview }: { dateLabel: string; tasks: Task[]; complete: number; percent: number; tradedToday: boolean | null; onToggle: (id: string) => void; onTradePrompt: () => void; onReview: () => void }) {
  return <>
    <div className="greeting-row"><div><p className="date-label">{dateLabel}</p><h1>Keep the promise<br />you made to yourself.</h1></div><div className="streak-pill"><span>🔥</span><strong>8</strong><small>day streak</small></div></div>
    <article className="hero-card"><div className="ring" style={{ "--progress": `${percent * 3.6}deg` } as React.CSSProperties}><div><strong>{percent}%</strong><span>complete</span></div></div><div className="hero-copy"><span className="eyebrow light">TODAY’S MOMENTUM</span><h2>{complete} of {tasks.length} habits complete</h2><p>{percent === 100 ? "Perfect day. Your streak is safe." : "Finish your evening routine to protect your streak."}</p></div></article>
    <div className="section-heading"><div><span className="eyebrow">DAILY ROUTINES</span><h2>Your checklist</h2></div><button className="mini-link">Edit</button></div>
    <div className="task-list">{tasks.map((task) => <button key={task.id} className={`task-row ${task.done ? "done" : ""}`} onClick={() => onToggle(task.id)}><span className="checkmark">{task.done ? "✓" : ""}</span><span className="task-copy"><strong>{task.label}</strong><small>{task.detail}</small></span><span className="chevron">›</span></button>)}</div>
    <article className="trade-card"><div className="trade-icon">$</div><div className="trade-copy"><span className="eyebrow">TRADING DISCIPLINE</span><h3>{tradedToday === null ? "Did you trade today?" : tradedToday ? "Review due today" : "No trades recorded"}</h3><p>{tradedToday === true ? "Complete your end-of-session review." : "A 30-second check keeps your journal honest."}</p></div><button className="compact-button" onClick={tradedToday ? onReview : onTradePrompt}>{tradedToday ? "Review" : "Check in"}</button></article>
    <div className="section-heading weekly-heading"><div><span className="eyebrow">THIS WEEK</span><h2>Weekly progress</h2></div><span className="score-chip">81% on track</span></div>
    <article className="week-card"><div className="week-bars">{week.map((item, index) => <div className="day-bar" key={`${item.day}-${index}`}><div className="bar-track"><i style={{ height: `${Math.max(item.value, 8)}%` }} /></div><span>{item.day}</span></div>)}</div><div className="week-insight"><span>◆</span><p><strong>Strongest day: Wednesday</strong><br />Your morning routine is 100% this week.</p></div></article>
  </>;
}

function ProgressView({ reviews }: { reviews: ReviewRecord[] }) {
  const pnl = reviews.slice(0, 7).reduce((sum, review) => sum + review.pnl, 0);
  const disciplined = reviews.length ? Math.round((reviews.filter((review) => review.followedPlan).length / reviews.length) * 100) : 0;
  const tagCounts = reviews.flatMap((review) => review.tags).reduce<Record<string, number>>((counts, tag) => ({ ...counts, [tag]: (counts[tag] ?? 0) + 1 }), {});
  const repeated = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return <>
  <div className="page-intro"><span className="eyebrow">WEEKLY REPORT</span><h1>Discipline compounds.</h1><p>Your patterns matter more than any single day.</p></div>
  <div className="metric-grid"><article><span>Completion</span><strong>81%</strong><small>Current week</small></article><article><span>Overall streak</span><strong>8 days</strong><small>Personal best: 14</small></article><article><span>Trading discipline</span><strong>{disciplined}%</strong><small>{reviews.length} saved reviews</small></article><article><span>Recent P/L</span><strong className={pnl >= 0 ? "positive" : "negative"}>{formatMoney(pnl)}</strong><small>Latest seven reviews</small></article></div>
  <article className="report-card"><div className="section-heading"><div><span className="eyebrow">DISCIPLINE VS. RESULTS</span><h2>Following the plan pays</h2></div></div><div className="comparison"><div><span>Plan followed</span><strong className="positive">+$203 avg.</strong><i style={{ width: "82%" }} /></div><div><span>Plan broken</span><strong className="negative">−$190 avg.</strong><i className="negative-bar" style={{ width: "44%" }} /></div></div></article>
  <article className="report-card"><span className="eyebrow">REPEATED MISTAKES</span><div className="tag-row">{repeated.length ? repeated.map(([tag, count]) => <span key={tag}>{tag} · {count}</span>) : <span>No repeated mistakes yet</span>}</div><p className="report-note">Your best days come from following the process—not chasing the result.</p></article>
  <div className="badges"><div>🏅<strong>Seven Strong</strong><small>7-day streak</small></div><div>📓<strong>Honest Review</strong><small>3 journals</small></div><div className="locked">🔒<strong>Plan Keeper</strong><small>2 days away</small></div></div>
  </>; }

function JournalView({ reviews, onReview }: { reviews: ReviewRecord[]; onReview: () => void }) { return <><div className="page-intro"><span className="eyebrow">TRADING JOURNAL</span><h1>Review the process.</h1><p>Results are recorded in dollars. Discipline is recorded honestly.</p></div><button className="primary-button wide" onClick={onReview}>+ Add today’s review</button><div className="journal-list">{reviews.length ? reviews.map((review) => <JournalEntry key={review.reviewDate} review={review} />) : <div className="empty-state"><strong>No reviews yet</strong><p>After your next trading session, record the process—not just the P/L.</p></div>}</div></>; }
function JournalEntry({ review }: { review: ReviewRecord }) { const date = new Date(`${review.reviewDate}T12:00:00`); return <article><div className="journal-date"><strong>{date.getDate()}</strong><span>{date.toLocaleString("en", { month: "short" }).toUpperCase()}</span></div><div><h3>Plan {review.followedPlan ? "followed" : "not followed"}</h3><p>{review.tradeCount} {review.tradeCount === 1 ? "trade" : "trades"}{review.notes ? ` · ${review.notes}` : ""}</p>{review.tags.length > 0 && <div className="tag-row">{review.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}</div><strong className={review.pnl >= 0 ? "positive" : "negative"}>{formatMoney(review.pnl)}</strong></article>; }

function SettingsView({ tasks, reviews }: { tasks: Task[]; reviews: ReviewRecord[] }) {
  function exportCsv() { const rows = [["type", "date", "name", "completed", "plan_followed", "trades", "pnl", "tags", "notes"], ...tasks.map((task) => ["habit", new Date().toISOString().slice(0, 10), task.label, String(task.done), "", "", "", "", ""]), ...reviews.map((review) => ["trade_review", review.reviewDate, "End-of-session review", "true", String(review.followedPlan), String(review.tradeCount), String(review.pnl), review.tags.join("|"), review.notes])]; const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n"); downloadFile(csv, "habit-tracker-export.csv", "text/csv"); }
  function requestNotifications() { if ("Notification" in window) window.Notification.requestPermission(); }
  return <><div className="page-intro"><span className="eyebrow">PREFERENCES</span><h1>Make it yours.</h1><p>Every routine can have its own schedule, scoring rule, and grace period.</p></div><div className="settings-group"><h2>Routine settings</h2><SettingRow title="Morning routine" detail="Daily · Window set during setup" /><SettingRow title="Evening routine" detail="Daily · Ask whether you traded" /><SettingRow title="Successful day rule" detail="Choose the daily completion threshold" /></div><div className="settings-group"><h2>Progress & reports</h2><SettingRow title="Week starts on" detail="Monday" /><SettingRow title="Automatic weekly report" detail="Available inside the app" /><SettingRow title="Badges & milestones" detail="Enabled" /></div><div className="settings-group"><h2>Your data</h2><SettingRow title="Export as CSV" detail="Download habits and trade reviews" onClick={exportCsv} /><SettingRow title="Generate PDF report" detail="Open a print-ready report" onClick={() => window.print()} /><SettingRow title="Notification permission" detail="Enable browser push reminders" onClick={requestNotifications} /></div></>; }
function SettingRow({ title, detail, onClick }: { title: string; detail: string; onClick?: () => void }) { return <button className="setting-row" onClick={onClick}><span><strong>{title}</strong><small>{detail}</small></span><b>›</b></button>; }
function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) { return <button className={active ? "active" : ""} onClick={onClick}><span>{icon}</span><small>{label}</small></button>; }

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close">×</button><div className="modal-symbol">↗</div><h2 id="modal-title">{title}</h2><p>{subtitle}</p><div className="modal-actions">{children}</div></section></div>; }

function TradeReview({ onClose, onSave }: { onClose: () => void; onSave: (draft: ReviewDraft) => void }) {
  const [followed, setFollowed] = useState<boolean | null>(null); const [tags, setTags] = useState<string[]>([]); const [tradeCount, setTradeCount] = useState(0); const [pnl, setPnl] = useState(0); const [notes, setNotes] = useState("");
  const toggleTag = (tag: string) => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  return <div className="modal-backdrop review-backdrop"><section className="modal review-modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose} aria-label="Close">×</button><span className="eyebrow">END-OF-SESSION REVIEW</span><h2>How did you trade today?</h2><div className="field"><label>Did you follow your plan?</label><div className="segmented"><button className={followed === true ? "selected" : ""} onClick={() => setFollowed(true)}>✓ Yes</button><button className={followed === false ? "selected danger" : ""} onClick={() => setFollowed(false)}>× No</button></div></div><div className="field split"><label>Number of trades<input type="number" min="0" value={tradeCount} onChange={(event) => setTradeCount(Number(event.target.value))} /></label><label>Daily P/L ($)<input type="number" step="0.01" value={pnl} onChange={(event) => setPnl(Number(event.target.value))} /></label></div><div className="field"><label>Mistake tags</label><div className="select-tags">{["Early entry", "Overtrading", "Moved stop", "FOMO", "Revenge trade"].map((tag) => <button key={tag} className={tags.includes(tag) ? "selected" : ""} onClick={() => toggleTag(tag)}>{tag}</button>)}</div></div><div className="field"><label>Lessons and notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What will you repeat or change next session?" /></label></div><button className="primary-button wide" disabled={followed === null} onClick={() => followed !== null && onSave({ followedPlan: followed, tradeCount, pnl, tags, notes })}>Save trading review</button></section></div>;
}

function formatMoney(value: number) { return `${value >= 0 ? "+" : "−"}$${Math.abs(value).toLocaleString("en-CA", { maximumFractionDigits: 2 })}`; }
function downloadFile(content: string, filename: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
