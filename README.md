# Habit Tracker

A phone-first tracker for active routines, tasks, next steps, progress, and daily reflection.

## Trustworthy foundation features

- Versioned V3 storage with separate routine definitions and dated check-ins
- Recoverable, idempotent migration from `habit-tracker-v2`
- Daily, weekday, times-per-week, interval, specific-date, and manually activated schedules
- Configurable Toronto-aware date boundaries, week start, success rules, and routine grace periods
- Editable historical check-ins with due-based progress and overall streak recalculation
- Morning and evening routine checklists
- Active routine progress and clear next steps
- General daily journal with photos, voice-to-text, and voice memos
- Weekly consistency, overall streaks, and progress by routine
- Versioned JSON data export and print-to-PDF reports
- Automatic light and dark appearance
- No login required

Trading is included only as an optional, manually activated example routine and can be treated like any other life area. The app stores data and media in the browser on the current device. A hosted database and account system can be added before opening the app to public users or syncing across devices.

### V2 migration safety

On first launch, a valid `habit-tracker-v2` payload is converted to V3. The original V2 JSON remains untouched and is also copied to `habit-tracker-v2-recovery` before the V3 save is verified. Corrupt or unmigratable data is never deleted automatically; the app offers a raw recovery download and requires an explicit reset.

## Deploy with Vercel

1. Import `jenozu/habits` into Vercel.
2. Keep the detected framework as **Next.js**.
3. Leave the root directory as the repository root.
4. Deploy. No environment variables are required for version 1.

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
