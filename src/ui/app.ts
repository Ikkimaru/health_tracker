import type { DataRepository } from "../application/store";
import {
  calculateProgress,
  createSession,
  dayComplete,
  exerciseComplete,
  todayKey
} from "../domain/rules";
import type { AppData, Exercise, MeasurementKind, Routine } from "../domain/types";
import { createBackup, openBackup } from "../infrastructure/backup";

type View = "today" | "exercises" | "routines" | "history" | "achievements" | "settings";
const labels: Record<View, string> = {
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
const id = () => crypto.randomUUID();

export class HealthQuestApp {
  private data!: AppData;
  private view: View = "today";
  private message = "";

  constructor(
    private readonly root: HTMLElement,
    private readonly repository: DataRepository
  ) {}

  async start(): Promise<void> {
    this.data = await this.repository.load();
    this.applyTheme();
    await this.ensureToday();
    this.render();
  }

  private async ensureToday(): Promise<void> {
    const date = todayKey();
    if (!this.data.sessions.some((session) => session.date === date)) {
      const session = createSession(date, this.data.routines, this.data.exercises);
      if (session) {
        this.data.sessions.push(session);
        await this.repository.save(this.data);
      }
    }
  }

  private applyTheme(): void {
    document.documentElement.dataset.theme = this.data.settings.theme;
  }

  private layout(content: string): string {
    const progress = calculateProgress(this.data.sessions);
    return `<header class="topbar"><div><p class="eyebrow">LOCAL • PRIVATE • YOURS</p><h1>Health Quest</h1></div><div class="level"><span>Level ${progress.level}</span><strong>${progress.xp} XP</strong><div class="xp"><i style="width:${progress.xp % 100}%"></i></div></div></header>
      ${this.message ? `<div class="notice" role="status">${escapeHtml(this.message)}</div>` : ""}
      <main>${content}</main>
      <nav class="nav" aria-label="Primary">${(Object.keys(labels) as View[]).map((view) => `<button data-nav="${view}" class="${this.view === view ? "active" : ""}">${labels[view]}</button>`).join("")}</nav>`;
  }

  private render(): void {
    const renderers: Record<View, () => string> = {
      today: () => this.todayView(),
      exercises: () => this.exercisesView(),
      routines: () => this.routinesView(),
      history: () => this.historyView(),
      achievements: () => this.achievementsView(),
      settings: () => this.settingsView()
    };
    this.root.innerHTML = this.layout(renderers[this.view]());
    this.bindEvents();
  }

  private todayView(): string {
    const session = this.data.sessions.find(({ date }) => date === todayKey());
    const progress = calculateProgress(this.data.sessions);
    if (!session)
      return `<section class="hero"><p class="eyebrow">${todayKey()}</p><h2>Rest day</h2><p>No routine is scheduled. Build one in Routines and assign today’s weekday.</p><button data-nav="routines" class="primary">Create a routine</button></section>`;
    const completed = session.exercises.filter(exerciseComplete).length;
    return `<section class="hero"><p class="eyebrow">TODAY'S QUEST</p><h2>${dayComplete(session) ? "Quest complete!" : `${completed} of ${session.exercises.length} exercises`}</h2><p>🔥 ${progress.currentStreak} day streak</p></section>
      <section class="stack">${session.exercises.map((exercise) => `<article class="card ${exerciseComplete(exercise) ? "done" : ""}"><div class="row"><div><h3>${escapeHtml(exercise.name)}</h3><p>${exercise.required ? "Required" : "Optional"} · ${exercise.kind}${exercise.weightKg ? ` · ${exercise.weightKg} kg` : ""}</p></div><strong>${exerciseComplete(exercise) ? "+10 XP" : ""}</strong></div><div class="sets">${exercise.prescriptions.map((set, index) => `<label><input type="checkbox" data-set="${session.id}|${exercise.id}|${set.id}" ${set.completed ? "checked" : ""}/><span>Set ${index + 1}: ${set.target} ${exercise.kind === "reps" ? "reps" : exercise.kind === "duration" ? "min" : "km"}</span></label>`).join("")}</div>${exercise.notes ? `<p class="note">${escapeHtml(exercise.notes)}</p>` : ""}</article>`).join("")}</section>`;
  }

  private exercisesView(): string {
    const active = this.data.exercises.filter(({ archived }) => !archived);
    return `<section><div class="section-title"><div><p class="eyebrow">LIBRARY</p><h2>Exercises</h2></div></div><form id="exercise-form" class="panel form-grid"><label>Name<input name="name" required maxlength="80" placeholder="Push-ups"/></label><label>Measure<select name="kind"><option value="reps">Repetitions</option><option value="duration">Duration (minutes)</option><option value="distance">Distance (km)</option></select></label><label>Sets<input name="sets" type="number" min="1" max="20" value="3" required/></label><label>Target per set<input name="target" type="number" min="0.1" step="0.1" value="10" required/></label><label>Weight kg (optional)<input name="weight" type="number" min="0" step="0.1"/></label><label class="wide">Notes<textarea name="notes" maxlength="400" placeholder="Form cues or instructions"></textarea></label><button class="primary wide">Add exercise</button></form>
      <div class="stack">${active.length ? active.map((exercise) => `<article class="card row"><div><h3>${escapeHtml(exercise.name)}</h3><p>${exercise.sets} × ${exercise.target} ${exercise.kind}${exercise.weightKg ? ` · ${exercise.weightKg} kg` : ""}</p></div><button class="quiet" data-archive-exercise="${exercise.id}">Archive</button></article>`).join("") : `<div class="empty">No exercises yet.</div>`}</div></section>`;
  }

  private routinesView(): string {
    const exercises = this.data.exercises.filter(({ archived }) => !archived);
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `<section><p class="eyebrow">PLANNER</p><h2>Routines</h2><form id="routine-form" class="panel form-grid"><label class="wide">Routine name<input name="name" required maxlength="80" placeholder="Monday strength"/></label><fieldset class="wide"><legend>Weekdays</legend><div class="chips">${weekdays.map((day, index) => `<label><input type="checkbox" name="weekday" value="${index}"/><span>${day}</span></label>`).join("")}</div></fieldset><fieldset class="wide"><legend>Exercises</legend><div class="choices">${exercises.map((exercise) => `<div class="routine-choice"><label><input type="checkbox" name="exercise" value="${exercise.id}"/><span>${escapeHtml(exercise.name)}</span></label><label><input type="checkbox" name="optional-${exercise.id}"/><span>Optional</span></label></div>`).join("") || "Create an exercise first."}</div></fieldset><label class="wide">Specific date (optional)<input name="date" type="date"/></label><button class="primary wide" ${exercises.length ? "" : "disabled"}>Create routine</button></form>
      <div class="stack">${
        this.data.routines
          .filter(({ archived }) => !archived)
          .map(
            (routine) =>
              `<article class="card row"><div><h3>${escapeHtml(routine.name)}</h3><p>${routine.items.length} exercises · ${routine.schedule.weekdays.map((day) => weekdays[day]).join(", ") || routine.schedule.dates.join(", ")}</p></div><button class="quiet" data-archive-routine="${routine.id}">Archive</button></article>`
          )
          .join("") || `<div class="empty">No routines yet.</div>`
      }</div></section>`;
  }

  private historyView(): string {
    const sessions = [...this.data.sessions].sort((a, b) => b.date.localeCompare(a.date));
    return `<section><p class="eyebrow">JOURNAL</p><h2>History</h2><p>Correct a past checkbox here; progression recalculates automatically.</p><div class="stack">${sessions.map((session) => `<article class="card"><div class="row"><div><h3>${session.date}</h3><p>${session.exercises.filter(exerciseComplete).length}/${session.exercises.length} exercises</p></div><strong>${dayComplete(session) ? "Complete" : "In progress"}</strong></div>${session.exercises.map((exercise) => `<div class="history-exercise"><span>${escapeHtml(exercise.name)}</span><div class="sets">${exercise.prescriptions.map((set, index) => `<label><input type="checkbox" data-set="${session.id}|${exercise.id}|${set.id}" ${set.completed ? "checked" : ""}/><span>Set ${index + 1}</span></label>`).join("")}</div></div>`).join("")}</article>`).join("") || `<div class="empty">Your completed quests will appear here.</div>`}</div></section>`;
  }

  private achievementsView(): string {
    const progress = calculateProgress(this.data.sessions);
    return `<section><p class="eyebrow">TROPHY ROOM</p><h2>Achievements</h2><div class="stats"><div><strong>${progress.xp}</strong><span>XP</span></div><div><strong>${progress.completedDays}</strong><span>Days</span></div><div><strong>${progress.longestStreak}</strong><span>Best streak</span></div></div><div class="achievement-grid">${progress.achievements.map((item) => `<article class="achievement ${item.unlocked ? "unlocked" : "locked"}"><span>${item.unlocked ? "◆" : "◇"}</span><h3>${item.title}</h3><p>${item.description}</p></article>`).join("")}</div></section>`;
  }

  private settingsView(): string {
    return `<section><p class="eyebrow">CONTROL ROOM</p><h2>Settings</h2><form id="settings-form" class="panel form-grid"><label>Display name<input name="displayName" maxlength="60" value="${escapeHtml(this.data.settings.displayName)}"/></label><label>Theme<select name="theme"><option value="system" ${this.data.settings.theme === "system" ? "selected" : ""}>System</option><option value="light" ${this.data.settings.theme === "light" ? "selected" : ""}>Light</option><option value="dark" ${this.data.settings.theme === "dark" ? "selected" : ""}>Dark</option></select></label><button class="primary wide">Save settings</button></form><div class="panel"><h3>Encrypted backup</h3><p>Use at least eight characters. The password cannot be recovered.</p><label>Backup password<input id="backup-password" type="password" autocomplete="new-password" minlength="8"/></label><div class="actions"><button id="export" class="primary">Export backup</button><label class="button">Import backup<input id="import" type="file" accept=".healthtracker,application/json" hidden/></label></div></div><div class="panel"><h3>Local transfer</h3><p>Run <code>npm run transfer</code> on your computer, then scan its QR code. Only encrypted backup files are transferred.</p></div></section>`;
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLElement>("[data-nav]").forEach((element) =>
      element.addEventListener("click", () => {
        this.view = element.dataset.nav as View;
        this.message = "";
        this.render();
      })
    );
    this.root.querySelectorAll<HTMLInputElement>("[data-set]").forEach((input) =>
      input.addEventListener("change", async () => {
        const [sessionId, exerciseId, setId] = input.dataset.set!.split("|");
        const exercise = this.data.sessions
          .find(({ id }) => id === sessionId)
          ?.exercises.find(({ id }) => id === exerciseId);
        const prescription = exercise?.prescriptions.find(({ id }) => id === setId);
        if (prescription && exercise) {
          prescription.completed = input.checked;
          exercise.completedAt = exerciseComplete(exercise) ? new Date().toISOString() : undefined;
          await this.repository.save(this.data);
          this.render();
        }
      })
    );
    this.root
      .querySelector<HTMLFormElement>("#exercise-form")
      ?.addEventListener("submit", (event) => void this.addExercise(event));
    this.root
      .querySelector<HTMLFormElement>("#routine-form")
      ?.addEventListener("submit", (event) => void this.addRoutine(event));
    this.root
      .querySelector<HTMLFormElement>("#settings-form")
      ?.addEventListener("submit", (event) => void this.saveSettings(event));
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-archive-exercise]")
      .forEach((button) =>
        button.addEventListener(
          "click",
          () => void this.archive("exercise", button.dataset.archiveExercise!)
        )
      );
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-archive-routine]")
      .forEach((button) =>
        button.addEventListener(
          "click",
          () => void this.archive("routine", button.dataset.archiveRoutine!)
        )
      );
    this.root
      .querySelector<HTMLButtonElement>("#export")
      ?.addEventListener("click", () => void this.exportBackup());
    this.root
      .querySelector<HTMLInputElement>("#import")
      ?.addEventListener("change", (event) => void this.importBackup(event));
  }

  private async addExercise(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const values = new FormData(event.currentTarget as HTMLFormElement);
    const exercise: Exercise = {
      id: id(),
      name: String(values.get("name")),
      kind: String(values.get("kind")) as MeasurementKind,
      sets: Number(values.get("sets")),
      target: Number(values.get("target")),
      weightKg: values.get("weight") ? Number(values.get("weight")) : undefined,
      notes: String(values.get("notes") || "") || undefined,
      archived: false,
      createdAt: new Date().toISOString()
    };
    this.data.exercises.push(exercise);
    await this.repository.save(this.data);
    this.message = `${exercise.name} added.`;
    this.render();
  }

  private async addRoutine(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const values = new FormData(event.currentTarget as HTMLFormElement);
    const routine: Routine = {
      id: id(),
      name: String(values.get("name")),
      items: values.getAll("exercise").map((exerciseId) => ({
        id: id(),
        exerciseId: String(exerciseId),
        required: values.get(`optional-${String(exerciseId)}`) !== "on"
      })),
      schedule: {
        weekdays: values.getAll("weekday").map(Number),
        dates: values.get("date") ? [String(values.get("date"))] : []
      },
      archived: false,
      createdAt: new Date().toISOString()
    };
    if (
      !routine.items.length ||
      (!routine.schedule.weekdays.length && !routine.schedule.dates.length)
    ) {
      this.message = "Choose at least one exercise and schedule day.";
      this.render();
      return;
    }
    this.data.routines.push(routine);
    await this.repository.save(this.data);
    await this.ensureToday();
    this.message = `${routine.name} scheduled.`;
    this.render();
  }

  private async saveSettings(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const values = new FormData(event.currentTarget as HTMLFormElement);
    this.data.settings = {
      displayName: String(values.get("displayName")) || "Adventurer",
      theme: String(values.get("theme")) as AppData["settings"]["theme"]
    };
    await this.repository.save(this.data);
    this.applyTheme();
    this.message = "Settings saved.";
    this.render();
  }

  private async archive(kind: "exercise" | "routine", targetId: string): Promise<void> {
    const target =
      kind === "exercise"
        ? this.data.exercises.find(({ id }) => id === targetId)
        : this.data.routines.find(({ id }) => id === targetId);
    if (target) {
      target.archived = true;
      await this.repository.save(this.data);
      this.message = "Archived. Existing history was preserved.";
      this.render();
    }
  }

  private password(): string {
    return this.root.querySelector<HTMLInputElement>("#backup-password")?.value ?? "";
  }
  private async exportBackup(): Promise<void> {
    try {
      const envelope = await createBackup(this.data, this.password());
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" })
      );
      link.download = `health-quest-${todayKey()}.healthtracker`;
      link.click();
      URL.revokeObjectURL(link.href);
      this.message = "Encrypted backup created.";
      this.render();
    } catch (error) {
      this.message = error instanceof Error ? error.message : "Backup failed.";
      this.render();
    }
  }

  private async importBackup(event: Event): Promise<void> {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const restored = await openBackup(await file.text(), this.password());
      const summary = `${restored.exercises.length} exercises, ${restored.routines.length} routines, ${restored.sessions.length} sessions`;
      if (!confirm(`Replace this device's data with ${summary}? This cannot be undone.`)) return;
      await this.repository.replace(restored);
      this.data = restored;
      this.applyTheme();
      this.message = `Backup restored: ${summary}.`;
      this.render();
    } catch (error) {
      this.message = error instanceof Error ? error.message : "Import failed.";
      this.render();
    }
  }
}
