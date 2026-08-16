import {
  darkTheme,
  defaultCustomTheme,
  lightTheme,
  resolveTheme,
  themeLabels,
  themeVariables
} from "../../application/theme";
import { calculateProgress, dayComplete, exerciseComplete, todayKey } from "../../domain/rules";
import type { AppData, ThemeColors } from "../../domain/types";
import { calculateWeightTrend, projectedGoalDate } from "../../domain/weightTrend";

export type View =
  "today" | "weight" | "exercises" | "routines" | "history" | "achievements" | "settings";
export const labels: Record<View, string> = {
  today: "Today",
  weight: "Weight",
  exercises: "Exercises",
  routines: "Routines",
  history: "History",
  achievements: "Achievements",
  settings: "Settings"
};

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!
  );

function todayContentView(data: AppData): string {
  const session = data.sessions.find(({ date }) => date === todayKey());
  const progress = calculateProgress(data.sessions);
  if (!session)
    return `<section class="hero"><p class="eyebrow">${todayKey()}</p><h2>Rest day</h2><p>No routine is scheduled. Build one in Routines and assign today’s weekday.</p><button data-nav="routines" class="primary">Create a routine</button></section>`;
  const completed = session.exercises.filter(exerciseComplete).length;
  return `<section class="hero"><p class="eyebrow">TODAY'S QUEST</p><h2>${dayComplete(session) ? "Quest complete!" : `${completed} of ${session.exercises.length} exercises`}</h2><p>🔥 ${progress.currentStreak} day streak</p></section><section class="stack">${session.exercises.map((exercise) => `<article class="card ${exerciseComplete(exercise) ? "done" : ""}"><div class="row"><div><h3>${escapeHtml(exercise.name)}</h3><p>${exercise.required ? "Required" : "Optional"} · ${exercise.kind}${exercise.weightKg ? ` · ${exercise.weightKg} kg` : ""}</p></div><strong>${exerciseComplete(exercise) ? "+10 XP" : ""}</strong></div><div class="sets">${exercise.prescriptions.map((set, index) => `<label><input type="checkbox" data-set="${session.id}|${exercise.id}|${set.id}" ${set.completed ? "checked" : ""}/><span>Set ${index + 1}: ${set.target} ${exercise.kind === "reps" ? "reps" : exercise.kind === "duration" ? "min" : "km"}</span></label>`).join("")}</div>${exercise.notes ? `<p class="note">${escapeHtml(exercise.notes)}</p>` : ""}</article>`).join("")}</section>`;
}

export function todayView(data: AppData): string {
  const todayWeight = data.weights.find(({ date }) => date === todayKey());
  const form = todayWeight
    ? ""
    : `<form id="today-weight-form" class="panel today-weight"><label>Today's weight (kg)<input name="weightKg" type="number" min="1" max="1000" step="0.01" inputmode="decimal" required/></label><button class="primary">Store weight</button></form>`;
  return `${form}${todayContentView(data)}`;
}

export function exercisesView(data: AppData): string {
  const active = data.exercises.filter(({ archived }) => !archived);
  return `<section><div class="section-title"><div><p class="eyebrow">LIBRARY</p><h2>Exercises</h2></div></div><form id="exercise-form" class="panel form-grid"><label>Name<input name="name" required maxlength="80" placeholder="Push-ups"/></label><label>Measure<select name="kind"><option value="reps">Repetitions</option><option value="duration">Duration (minutes)</option><option value="distance">Distance (km)</option></select></label><label>Sets<input name="sets" type="number" min="1" max="20" value="3" required/></label><label>Target per set<input name="target" type="number" min="0.1" step="0.1" value="10" required/></label><label>Weight kg (optional)<input name="weight" type="number" min="0" step="0.1"/></label><label class="wide">Notes<textarea name="notes" maxlength="400" placeholder="Form cues or instructions"></textarea></label><button class="primary wide">Add exercise</button></form><div class="stack">${active.length ? active.map((exercise) => `<article class="card row"><div><h3>${escapeHtml(exercise.name)}</h3><p>${exercise.sets} × ${exercise.target} ${exercise.kind}${exercise.weightKg ? ` · ${exercise.weightKg} kg` : ""}</p></div><button class="quiet" data-archive-exercise="${exercise.id}">Archive</button></article>`).join("") : `<div class="empty">No exercises yet.</div>`}</div></section>`;
}

export function routinesView(data: AppData): string {
  const exercises = data.exercises.filter(({ archived }) => !archived);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `<section><p class="eyebrow">PLANNER</p><h2>Routines</h2><form id="routine-form" class="panel form-grid"><label class="wide">Routine name<input name="name" required maxlength="80" placeholder="Monday strength"/></label><fieldset class="wide"><legend>Weekdays</legend><div class="chips">${weekdays.map((day, index) => `<label><input type="checkbox" name="weekday" value="${index}"/><span>${day}</span></label>`).join("")}</div></fieldset><fieldset class="wide"><legend>Exercises</legend><div class="choices">${exercises.map((exercise) => `<div class="routine-choice"><label><input type="checkbox" name="exercise" value="${exercise.id}"/><span>${escapeHtml(exercise.name)}</span></label><label><input type="checkbox" name="optional-${exercise.id}"/><span>Optional</span></label></div>`).join("") || "Create an exercise first."}</div></fieldset><label class="wide">Specific date (optional)<input name="date" type="date"/></label><button class="primary wide" ${exercises.length ? "" : "disabled"}>Create routine</button></form><div class="stack">${
    data.routines
      .filter(({ archived }) => !archived)
      .map(
        (routine) =>
          `<article class="card row"><div><h3>${escapeHtml(routine.name)}</h3><p>${routine.items.length} exercises · ${routine.schedule.weekdays.map((day) => weekdays[day]).join(", ") || routine.schedule.dates.join(", ")}</p></div><button class="quiet" data-archive-routine="${routine.id}">Archive</button></article>`
      )
      .join("") || `<div class="empty">No routines yet.</div>`
  }</div></section>`;
}

export function historyView(data: AppData): string {
  const sessions = [...data.sessions].sort((a, b) => b.date.localeCompare(a.date));
  return `<section><p class="eyebrow">JOURNAL</p><h2>History</h2><p>Correct a past checkbox here; progression recalculates automatically.</p><div class="stack">${sessions.map((session) => `<article class="card"><div class="row"><div><h3>${session.date}</h3><p>${session.exercises.filter(exerciseComplete).length}/${session.exercises.length} exercises</p></div><strong>${dayComplete(session) ? "Complete" : "In progress"}</strong></div>${session.exercises.map((exercise) => `<div class="history-exercise"><span>${escapeHtml(exercise.name)}</span><div class="sets">${exercise.prescriptions.map((set, index) => `<label><input type="checkbox" data-set="${session.id}|${exercise.id}|${set.id}" ${set.completed ? "checked" : ""}/><span>Set ${index + 1}</span></label>`).join("")}</div></div>`).join("")}</article>`).join("") || `<div class="empty">Your completed quests will appear here.</div>`}</div></section>`;
}

export function achievementsView(data: AppData): string {
  const progress = calculateProgress(data.sessions);
  return `<section><p class="eyebrow">TROPHY ROOM</p><h2>Achievements</h2><div class="stats"><div><strong>${progress.xp}</strong><span>XP</span></div><div><strong>${progress.completedDays}</strong><span>Days</span></div><div><strong>${progress.longestStreak}</strong><span>Best streak</span></div></div><div class="achievement-grid">${progress.achievements.map((item) => `<article class="achievement ${item.unlocked ? "unlocked" : "locked"}"><span>${item.unlocked ? "◆" : "◇"}</span><h3>${item.title}</h3><p>${item.description}</p></article>`).join("")}</div></section>`;
}

const weightRanges = { "1": 31, "3": 92, "6": 183, "12": 366, all: Infinity } as const;

export function weightView(
  data: AppData,
  range: keyof typeof weightRanges = "3",
  selectedDate = "",
  dotInterval = "daily",
  calendarMonth = todayKey().slice(0, 7)
): string {
  const all = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const todayDay = Date.parse(`${todayKey()}T00:00:00Z`) / 86_400_000;
  const selectedDays = weightRanges[range];
  const rangeStartDay = Number.isFinite(selectedDays) ? todayDay - selectedDays + 1 : -Infinity;
  const entries = all.filter(
    (entry) => Date.parse(`${entry.date}T00:00:00Z`) / 86_400_000 >= rangeStartDay
  );
  const mondayFirst = (data.settings.weightCalendarWeekStart ?? "monday") === "monday";
  const method = data.settings.weightTrendMethod ?? "linear";
  const trend = calculateWeightTrend(entries, method);
  const goalDate = projectedGoalDate(all, data.settings.goalWeightKg, method);
  const chart = (() => {
    if (entries.length < 2)
      return `<div class="empty">Add at least two weights to see a trend.</div>`;
    const grouped = new Map<string, typeof entries>();
    for (const entry of entries) {
      const date = new Date(`${entry.date}T00:00:00Z`);
      let key = entry.date;
      if (dotInterval === "weekly") {
        const offset = mondayFirst ? (date.getUTCDay() + 6) % 7 : date.getUTCDay();
        date.setUTCDate(date.getUTCDate() - offset);
        key = date.toISOString().slice(0, 10);
      } else if (dotInterval === "monthly") {
        key = `${entry.date.slice(0, 7)}-01`;
      }
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    }
    const displayed = [...grouped.values()].map((group) => ({
      date: new Date(
        group.reduce((sum, entry) => sum + Date.parse(`${entry.date}T00:00:00Z`), 0) / group.length
      )
        .toISOString()
        .slice(0, 10),
      weightKg: group.reduce((sum, entry) => sum + entry.weightKg, 0) / group.length
    }));
    const dates = displayed.map(({ date }) => Date.parse(`${date}T00:00:00Z`) / 86_400_000);
    const weights = displayed.map(({ weightKg }) => weightKg);
    const minX = Number.isFinite(rangeStartDay) ? rangeStartDay : Math.min(...dates);
    const maxX = todayDay;
    const firstObservedX = Math.min(...dates);
    const trendValues = trend ? [trend.valueAt(firstObservedX), trend.valueAt(maxX)] : [];
    const minY = Math.min(...weights, ...trendValues) - 0.5;
    const maxY = Math.max(...weights, ...trendValues) + 0.5;
    const x = (value: number) => 55 + ((value - minX) / (maxX - minX || 1)) * 705;
    const y = (value: number) => 235 - ((value - minY) / (maxY - minY || 1)) * 205;
    const points = displayed
      .map((entry, index) => `${x(dates[index]!)},${y(entry.weightKg)}`)
      .join(" ");
    const trendLine = trend
      ? `<line class="trend-line" x1="${x(firstObservedX)}" y1="${y(trend.valueAt(firstObservedX))}" x2="${x(maxX)}" y2="${y(trend.valueAt(maxX))}"/>`
      : "";
    const showEveryDay = range === "1" && dotInterval === "daily";
    let ticks: number[];
    if (showEveryDay) {
      ticks = Array.from({ length: maxX - minX + 1 }, (_, index) => minX + index);
    } else {
      const startWeekday = mondayFirst ? 1 : 0;
      const firstDate = new Date(minX * 86_400_000);
      let firstTick = minX - ((firstDate.getUTCDay() - startWeekday + 7) % 7);
      if (firstTick < minX) firstTick += 7;
      const totalWeeks = Math.max(1, Math.floor((maxX - firstTick) / 7) + 1);
      const tickStep = Math.max(1, Math.ceil(totalWeeks / 10));
      ticks = Array.from(
        { length: Math.ceil(totalWeeks / tickStep) },
        (_, index) => firstTick + index * tickStep * 7
      ).filter((day) => day <= maxX);
    }
    const tickMarkup = ticks
      .map((day) => {
        const date = new Date(day * 86_400_000);
        const label = showEveryDay
          ? String(date.getUTCDate())
          : date.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              timeZone: "UTC"
            });
        return `<line class="date-tick ${showEveryDay ? "daily" : ""}" x1="${x(day)}" y1="242" x2="${x(day)}" y2="249"/><text class="date-label ${showEveryDay ? "daily" : ""}" x="${x(day)}" y="270">${label}</text>`;
      })
      .join("");
    const pointMarkup = displayed
      .map((entry, index) => {
        const pointX = x(dates[index]!);
        const pointY = y(entry.weightKg);
        const weight = Number(entry.weightKg.toFixed(2));
        return `<g class="chart-point" data-chart-point tabindex="0" role="button" aria-label="${entry.date}: ${weight} kilograms"><line class="crosshair horizontal" x1="55" y1="${pointY}" x2="760" y2="${pointY}"/><line class="crosshair vertical" x1="${pointX}" y1="30" x2="${pointX}" y2="242"/><circle cx="${pointX}" cy="${pointY}" r="5"><title>${entry.date}: ${weight} kg</title></circle><text class="weight-value-label" x="${pointX}" y="${pointY - 11}">${weight} kg</text></g>`;
      })
      .join("");
    return `<svg class="weight-chart" viewBox="0 0 800 285" role="img" aria-label="Weight history and trend"><polyline points="${points}"/>${trendLine}${pointMarkup}${tickMarkup}</svg>`;
  })();
  const visibleMonth = /^\d{4}-\d{2}$/.test(calendarMonth) ? calendarMonth : todayKey().slice(0, 7);
  const weekdayLabels = mondayFirst
    ? ["M", "T", "W", "T", "F", "S", "S"]
    : ["S", "M", "T", "W", "T", "F", "S"];
  const calendar = (() => {
    const month = visibleMonth;
    const first = new Date(`${month}-01T00:00:00Z`);
    const days = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const leadingDays = mondayFirst ? (first.getUTCDay() + 6) % 7 : first.getUTCDay();
    const cells = Array.from({ length: leadingDays }, () => `<span></span>`).concat(
      Array.from({ length: days }, (_, index) => {
        const date = `${month}-${String(index + 1).padStart(2, "0")}`;
        const entry = all.find((item) => item.date === date);
        const future = date > todayKey();
        return `<button type="button" data-weight-date="${date}" class="${entry ? "has-weight" : ""}" ${future ? "disabled" : ""} aria-label="${entry ? `Edit ${entry.weightKg} kilograms for` : "Add weight for"} ${date}"><b>${index + 1}</b>${entry ? `<small>${entry.weightKg} kg</small>` : ""}</button>`;
      })
    );
    return `<article class="weight-month"><div class="calendar-month-nav"><button type="button" class="quiet" data-calendar-month="${new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1)).toISOString().slice(0, 7)}" aria-label="Previous month">‹</button><h3>${first.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}</h3><button type="button" class="quiet" data-calendar-month="${new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)).toISOString().slice(0, 7)}" aria-label="Next month" ${month >= todayKey().slice(0, 7) ? "disabled" : ""}>›</button></div><div class="calendar-head">${weekdayLabels.map((day) => `<b>${day}</b>`).join("")}</div><div class="weight-calendar">${cells.join("")}</div></article>`;
  })();
  const weeklyChange = trend ? trend.slopePerDay * 7 : undefined;
  const deadlineNote = data.settings.goalWeightDeadline
    ? goalDate
      ? goalDate <= data.settings.goalWeightDeadline
        ? ` That is on or before the ${data.settings.goalWeightDeadline} deadline.`
        : ` That is after the ${data.settings.goalWeightDeadline} deadline.`
      : ` A comparison with the ${data.settings.goalWeightDeadline} deadline needs a usable goal projection.`
    : "";
  const analysis = !trend
    ? "Record weights on at least two different dates to calculate a trend."
    : `${weeklyChange! < 0 ? "Weight is trending down" : weeklyChange! > 0 ? "Weight is trending up" : "Weight is broadly stable"} at about ${Math.abs(weeklyChange!).toFixed(2)} kg per week. ${goalDate ? `If this trend continues, the projected goal date is ${goalDate}.` : "There is not yet a credible future goal-date projection in the selected direction."}${deadlineNote}`;
  const selectedEntry = all.find(({ date }) => date === selectedDate);
  const editor = selectedDate
    ? `<dialog class="weight-editor" aria-labelledby="weight-editor-title"><form id="weight-entry-form" class="form-grid"><div class="wide"><p class="eyebrow">${selectedDate}</p><h3 id="weight-editor-title">${selectedEntry ? "Edit" : "Add"} weight</h3></div><input name="date" type="hidden" value="${selectedDate}"/><label class="wide">Weight (kg)<input id="calendar-weight-input" name="weightKg" type="number" min="1" max="1000" step="0.01" inputmode="decimal" value="${selectedEntry?.weightKg ?? ""}" required/></label><div class="actions wide"><button class="primary">Save weight</button><button id="cancel-weight-edit" type="button" class="quiet">Cancel</button>${selectedEntry ? `<button type="button" class="danger" data-delete-weight="${selectedDate}">Delete record</button>` : ""}</div></form></dialog>`
    : "";
  const dotControls = `<div class="dot-controls" aria-label="Chart dot frequency"><span>Show dots</span>${[
    ["daily", "Daily"],
    ["weekly", "Weekly"],
    ["monthly", "Monthly"]
  ]
    .map(
      ([value, label]) =>
        `<button data-dot-interval="${value}" class="${dotInterval === value ? "active" : "quiet"}" ${range === "1" && value === "monthly" ? 'disabled title="Monthly dots require a range longer than one month"' : ""}>${label}</button>`
    )
    .join("")}</div>`;
  const firstMonth = all[0]?.date.slice(0, 7) ?? todayKey().slice(0, 7);
  const lastMonth = all.at(-1)?.date.slice(0, 7) ?? todayKey().slice(0, 7);
  const exportPanel = `<form id="weight-export-form" class="panel form-grid weight-export"><div class="wide"><p class="eyebrow">EXPORT</p><h3>Download weight records</h3><p>Select whole months. Only recorded dates in that inclusive range are exported.</p></div><label>From month<input name="fromMonth" type="month" value="${firstMonth}" max="${todayKey().slice(0, 7)}" required/></label><label>To month<input name="toMonth" type="month" value="${lastMonth}" max="${todayKey().slice(0, 7)}" required/></label><label class="wide">File format<select name="format"><option value="excel">Excel-compatible CSV</option><option value="notepad">Notepad text</option><option value="pdf">PDF document</option></select></label><button class="primary wide">Download weights</button></form>`;
  return `<section><p class="eyebrow">PROGRESS</p><h2>Weight</h2><div class="panel"><div class="range-buttons">${Object.keys(
    weightRanges
  )
    .map(
      (value) =>
        `<button data-weight-range="${value}" class="${range === value ? "active" : "quiet"}">${value === "12" ? "1 year" : value === "all" ? "All time" : `${value} month${value === "1" ? "" : "s"}`}</button>`
    )
    .join(
      ""
    )}</div>${dotControls}${chart}</div><article class="panel trend-analysis"><p class="eyebrow">TREND ANALYSIS</p><h3>${method === "linear" ? "Linear regression" : method === "weighted" ? "Recent-weighted regression" : "Theil–Sen robust trend"}</h3><p>${analysis}</p><small>This is a mathematical projection, not medical advice. Daily weight naturally fluctuates; do not change treatment or nutrition based on this estimate alone.</small></article><section><h2>Calendar</h2><p>Select a date to add or edit its weight.</p><div class="weight-months">${calendar}</div></section>${exportPanel}${editor}</section>`;
}

function weightSettingsView(data: AppData): string {
  return `<form id="weight-settings-form" class="panel form-grid"><div class="wide"><p class="eyebrow">WEIGHT GOAL</p><h3>Goal and forecast</h3></div><label>Goal weight (kg)<input name="goalWeightKg" type="number" min="1" max="1000" step="0.01" value="${data.settings.goalWeightKg ?? ""}"/></label><label>Goal deadline<input name="goalWeightDeadline" type="date" value="${data.settings.goalWeightDeadline ?? ""}"/></label><label class="wide">Trend calculation<select name="weightTrendMethod"><option value="linear" ${data.settings.weightTrendMethod === "linear" ? "selected" : ""}>Linear regression — balanced overall trend</option><option value="weighted" ${data.settings.weightTrendMethod === "weighted" ? "selected" : ""}>Recent-weighted regression — responds faster</option><option value="theil-sen" ${data.settings.weightTrendMethod === "theil-sen" ? "selected" : ""}>Theil–Sen — resists unusual readings</option></select><small>Linear uses all points equally; weighted halves influence every 30 days; Theil–Sen uses the median pairwise slope.</small></label><button class="primary wide">Save weight settings</button></form>`;
}

function calendarSettingsView(data: AppData): string {
  const start = data.settings.weightCalendarWeekStart ?? "monday";
  return `<form id="calendar-settings-form" class="panel form-grid"><div class="wide"><p class="eyebrow">CALENDAR</p><h3>Week layout</h3></div><label class="wide">Start of week<select name="weightCalendarWeekStart"><option value="monday" ${start === "monday" ? "selected" : ""}>Monday</option><option value="sunday" ${start === "sunday" ? "selected" : ""}>Sunday</option></select></label><button class="primary wide">Save calendar settings</button></form>`;
}

export function settingsView(data: AppData): string {
  const custom = data.settings.customTheme ?? defaultCustomTheme();
  const preview = resolveTheme(
    data.settings,
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const previewStyle = Object.entries(themeVariables)
    .map(([key, variable]) => `${variable}:${preview[key as keyof ThemeColors]}`)
    .join(";");
  const modes = (["system", "light", "dark", "custom"] as const)
    .map(
      (mode) =>
        `<label class="theme-mode"><input type="radio" name="theme" value="${mode}" ${data.settings.theme === mode ? "checked" : ""}/><span><strong>${mode[0]!.toUpperCase() + mode.slice(1)}</strong><small>${mode === "system" ? "Follow this device" : mode === "custom" ? "Use your palette" : `${mode[0]!.toUpperCase() + mode.slice(1)} preset`}</small></span></label>`
    )
    .join("");
  const controls = (Object.keys(themeLabels) as (keyof ThemeColors)[])
    .map(
      (key) =>
        `<label class="color-control"><span>${themeLabels[key]}</span><div><input type="color" name="${key}" value="${custom[key]}" aria-label="${themeLabels[key]} color"/><output>${custom[key]}</output></div></label>`
    )
    .join("");
  return `<section><p class="eyebrow">CONTROL ROOM</p><h2>Settings</h2><form id="profile-form" class="panel form-grid"><label class="wide">Display name<input name="displayName" maxlength="60" value="${escapeHtml(data.settings.displayName)}"/></label><button class="primary wide">Save profile</button></form><form id="theme-form" class="panel theme-editor"><div><p class="eyebrow">APPEARANCE</p><h3>Theme</h3><p>Choose a clear preset or build a palette. Changes appear in the preview before you save.</p></div><fieldset><legend>Theme mode</legend><div class="theme-modes">${modes}</div></fieldset><div class="theme-workspace"><fieldset class="palette"><legend>Custom colors</legend><div class="color-grid">${controls}</div><div class="actions"><button type="button" class="quiet" data-theme-preset="light">Start from light</button><button type="button" class="quiet" data-theme-preset="dark">Start from dark</button></div></fieldset><div><span class="preview-label">Live preview</span><article id="theme-preview" class="theme-preview" style="${previewStyle}"><div class="preview-hero"><p>YOUR DAILY QUEST</p><h3>Build momentum</h3><span>Two exercises remaining</span></div><div class="preview-card"><h3>Morning strength</h3><p>This is secondary text for helpful details.</p><label>Example field<input value="10 repetitions" readonly/></label><div class="preview-actions"><button type="button" class="preview-primary">Complete set</button><button type="button" class="preview-secondary">Skip</button></div><div class="preview-progress"><i></i></div><div class="preview-success">✓ Exercise completed</div><div class="preview-notice">Your changes have not been saved yet.</div></div></article></div></div><button class="primary save-theme">Save theme</button></form><div class="panel"><h3>Encrypted backup</h3><p>Use at least eight characters. The password cannot be recovered.</p><label>Backup password<input id="backup-password" type="password" autocomplete="new-password" minlength="8"/></label><div class="actions"><button id="export" class="primary">Export backup</button><label class="button">Import backup<input id="import" type="file" accept=".healthtracker,application/json" hidden/></label></div></div><div class="panel"><h3>Local transfer</h3><p>Run <code>npm run transfer</code> on your computer, then scan its QR code. Only encrypted backup files are transferred.</p></div></section>`;
}

export function renderView(
  view: View,
  data: AppData,
  weightRange = "3",
  selectedWeightDate = "",
  weightDotInterval = "daily",
  weightCalendarMonth = todayKey().slice(0, 7)
): string {
  return {
    today: todayView,
    weight: (value: AppData) =>
      weightView(
        value,
        weightRange as keyof typeof weightRanges,
        selectedWeightDate,
        weightDotInterval,
        weightCalendarMonth
      ),
    exercises: exercisesView,
    routines: routinesView,
    history: historyView,
    achievements: achievementsView,
    settings: (value: AppData) =>
      weightSettingsView(value) + calendarSettingsView(value) + settingsView(value)
  }[view](data);
}
