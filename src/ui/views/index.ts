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

export type View = "today" | "exercises" | "routines" | "history" | "achievements" | "settings";
export const labels: Record<View, string> = {
  today: "Today",
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

export function todayView(data: AppData): string {
  const session = data.sessions.find(({ date }) => date === todayKey());
  const progress = calculateProgress(data.sessions);
  if (!session)
    return `<section class="hero"><p class="eyebrow">${todayKey()}</p><h2>Rest day</h2><p>No routine is scheduled. Build one in Routines and assign today’s weekday.</p><button data-nav="routines" class="primary">Create a routine</button></section>`;
  const completed = session.exercises.filter(exerciseComplete).length;
  return `<section class="hero"><p class="eyebrow">TODAY'S QUEST</p><h2>${dayComplete(session) ? "Quest complete!" : `${completed} of ${session.exercises.length} exercises`}</h2><p>🔥 ${progress.currentStreak} day streak</p></section><section class="stack">${session.exercises.map((exercise) => `<article class="card ${exerciseComplete(exercise) ? "done" : ""}"><div class="row"><div><h3>${escapeHtml(exercise.name)}</h3><p>${exercise.required ? "Required" : "Optional"} · ${exercise.kind}${exercise.weightKg ? ` · ${exercise.weightKg} kg` : ""}</p></div><strong>${exerciseComplete(exercise) ? "+10 XP" : ""}</strong></div><div class="sets">${exercise.prescriptions.map((set, index) => `<label><input type="checkbox" data-set="${session.id}|${exercise.id}|${set.id}" ${set.completed ? "checked" : ""}/><span>Set ${index + 1}: ${set.target} ${exercise.kind === "reps" ? "reps" : exercise.kind === "duration" ? "min" : "km"}</span></label>`).join("")}</div>${exercise.notes ? `<p class="note">${escapeHtml(exercise.notes)}</p>` : ""}</article>`).join("")}</section>`;
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

export function renderView(view: View, data: AppData): string {
  return {
    today: todayView,
    exercises: exercisesView,
    routines: routinesView,
    history: historyView,
    achievements: achievementsView,
    settings: settingsView
  }[view](data);
}
