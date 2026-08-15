import type { DataRepository } from "../application/store";
import {
  applyThemeVariables,
  darkTheme,
  defaultCustomTheme,
  lightTheme,
  resolveTheme,
  themeLabels,
  themeVariables
} from "../application/theme";
import { calculateProgress, createSession, exerciseComplete, todayKey } from "../domain/rules";
import type { AppData, Exercise, MeasurementKind, Routine, ThemeColors } from "../domain/types";
import { createBackup, openBackup, validateAppData } from "../infrastructure/backup";
import { SupabaseBackups } from "../infrastructure/supabaseBackups";
import { labels, renderView, type View } from "./views";
const escapeHtml = (value: unknown) => {
  let text = "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    text = String(value);
  }
  return text.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!
  );
};
const id = () => crypto.randomUUID();
const textValue = (values: FormData, key: string): string => {
  const value = values.get(key);
  return typeof value === "string" ? value : "";
};
const textValues = (values: FormData, key: string): string[] =>
  values.getAll(key).filter((value): value is string => typeof value === "string");

// cspell:ignore healthtracker supabase topbar

export class HealthQuestApp {
  private data!: AppData;
  private view: View = "today";
  private message = "";
  private readonly cloud = new SupabaseBackups(
    import.meta.env.VITE_SUPABASE_URL ?? "",
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ""
  );
  private cloudBackupTimer?: number;

  constructor(
    private readonly root: HTMLElement,
    private readonly repository: DataRepository
  ) {}

  async start(): Promise<void> {
    try {
      await this.cloud.initialize();
    } catch {
      this.message = "The saved Supabase session could not be restored.";
    }
    this.data = await this.repository.load();
    this.data.settings.customTheme ??= defaultCustomTheme();
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
        await this.persist();
      }
    }
  }

  private applyTheme(): void {
    document.documentElement.dataset.theme = this.data.settings.theme;
    for (const variable of Object.values(themeVariables)) {
      document.documentElement.style.removeProperty(variable);
    }
    if (this.data.settings.theme === "custom") {
      applyThemeVariables(
        document.documentElement,
        this.data.settings.customTheme ?? defaultCustomTheme()
      );
    }
  }

  private layout(content: string): string {
    const progress = calculateProgress(this.data.sessions);
    const notice = this.message
      ? `<div class="notice" role="status">${escapeHtml(this.message)}</div>`
      : "";
    const navigation = (Object.keys(labels) as View[])
      .map((view) => {
        const activeClass = this.view === view ? "active" : "";
        return `<button data-nav="${view}" class="${activeClass}">${labels[view]}</button>`;
      })
      .join("");

    return `<header class="topbar"><div><p class="eyebrow">LOCAL • PRIVATE • YOURS</p><h1>Health Quest</h1></div><div class="level"><span>Level ${progress.level}</span><strong>${progress.xp} XP</strong><div class="xp"><i style="width:${progress.xp % 100}%"></i></div></div></header>
      ${notice}
      <main>${content}</main>
      <nav class="nav" aria-label="Primary">${navigation}</nav>`;
  }

  private render(): void {
    this.root.innerHTML = this.layout(renderView(this.view, this.data));
    this.addSupabasePanel();
    this.bindEvents();
  }

  private addSupabasePanel(): void {
    if (this.view !== "settings") return;
    const transfer = [...this.root.querySelectorAll<HTMLElement>(".panel")].find((panel) =>
      panel.querySelector("h3")?.textContent?.includes("Local transfer")
    );
    const accountStatus = this.cloud.signedIn
      ? `Signed in as ${escapeHtml(this.cloud.email)}.`
      : "Create an account or sign in to keep cloud backups.";
    const signedInControls =
      '<div class="actions"><button id="supabase-backup" class="primary">Back up now</button><button id="supabase-restore" class="button">Restore latest</button><button id="supabase-signout" class="quiet">Sign out</button></div>';
    const authenticationForm =
      '<form id="supabase-auth" class="form-grid"><label class="wide">Email<input name="email" type="email" autocomplete="email" required/></label><label class="wide">Account password<input name="accountPassword" type="password" autocomplete="current-password" minlength="8" required/></label><div class="actions wide"><button name="action" value="signin" class="primary">Sign in</button><button name="action" value="signup" class="button">Create account</button></div></form>';
    const controls = this.cloud.signedIn ? signedInControls : authenticationForm;
    const configurationNote = this.cloud.configured
      ? ""
      : "<small>Supabase requires deployment URL and publishable-key configuration. See the README.</small>";
    transfer?.insertAdjacentHTML(
      "beforebegin",
      `<div class="panel"><h3>Supabase backup</h3><p>${accountStatus} The newest five snapshots are retained.</p>${controls}${configurationNote}</div>`
    );
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
          await this.persist();
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
      .querySelector<HTMLFormElement>("#profile-form")
      ?.addEventListener("submit", (event) => void this.saveProfile(event));
    this.root
      .querySelector<HTMLFormElement>("#theme-form")
      ?.addEventListener("submit", (event) => void this.saveTheme(event));
    this.bindThemeEditor();
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
    this.root
      .querySelector<HTMLFormElement>("#supabase-auth")
      ?.addEventListener("submit", (event) => void this.authenticateSupabase(event));
    this.root
      .querySelector<HTMLButtonElement>("#supabase-backup")
      ?.addEventListener("click", () => void this.backupToSupabase());
    this.root
      .querySelector<HTMLButtonElement>("#supabase-restore")
      ?.addEventListener("click", () => void this.restoreFromSupabase());
    this.root
      .querySelector<HTMLButtonElement>("#supabase-signout")
      ?.addEventListener("click", () => void this.signOutSupabase());
  }

  private async addExercise(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const values = new FormData(event.currentTarget as HTMLFormElement);
    const exercise: Exercise = {
      id: id(),
      name: textValue(values, "name"),
      kind: textValue(values, "kind") as MeasurementKind,
      sets: Number(textValue(values, "sets")),
      target: Number(textValue(values, "target")),
      weightKg: textValue(values, "weight") ? Number(textValue(values, "weight")) : undefined,
      notes: textValue(values, "notes") || undefined,
      archived: false,
      createdAt: new Date().toISOString()
    };
    this.data.exercises.push(exercise);
    await this.persist();
    this.message = `${exercise.name} added.`;
    this.render();
  }

  private async addRoutine(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const values = new FormData(event.currentTarget as HTMLFormElement);
    const routine: Routine = {
      id: id(),
      name: textValue(values, "name"),
      items: textValues(values, "exercise").map((exerciseId) => ({
        id: id(),
        exerciseId,
        required: textValue(values, `optional-${exerciseId}`) !== "on"
      })),
      schedule: {
        weekdays: textValues(values, "weekday").map(Number),
        dates: textValue(values, "date") ? [textValue(values, "date")] : []
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
    await this.persist();
    await this.ensureToday();
    this.message = `${routine.name} scheduled.`;
    this.render();
  }

  private async saveProfile(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const values = new FormData(event.currentTarget as HTMLFormElement);
    this.data.settings.displayName = textValue(values, "displayName") || "Adventurer";
    await this.persist();
    this.message = "Profile saved.";
    this.render();
  }

  private bindThemeEditor(): void {
    const form = this.root.querySelector<HTMLFormElement>("#theme-form");
    const preview = this.root.querySelector<HTMLElement>("#theme-preview");
    if (!form || !preview) return;
    const update = () => {
      const values = new FormData(form);
      const mode = textValue(values, "theme") as AppData["settings"]["theme"];
      const custom = Object.fromEntries(
        (Object.keys(themeLabels) as (keyof ThemeColors)[]).map((key) => [
          key,
          textValue(values, key)
        ])
      ) as unknown as ThemeColors;
      const colors = resolveTheme(
        { ...this.data.settings, theme: mode, customTheme: custom },
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
      applyThemeVariables(preview, colors);
      form.querySelectorAll<HTMLInputElement>('input[type="color"]').forEach((input) => {
        const output = input.parentElement?.querySelector("output");
        if (output) output.textContent = input.value.toUpperCase();
      });
    };
    form
      .querySelectorAll<HTMLInputElement>('input[name="theme"]')
      .forEach((input) => input.addEventListener("change", update));
    form.querySelectorAll<HTMLInputElement>('input[type="color"]').forEach((input) =>
      input.addEventListener("input", () => {
        const customMode = form.querySelector<HTMLInputElement>('input[value="custom"]');
        if (customMode) customMode.checked = true;
        update();
      })
    );
    form.querySelectorAll<HTMLButtonElement>("[data-theme-preset]").forEach((button) =>
      button.addEventListener("click", () => {
        const preset = button.dataset.themePreset === "dark" ? darkTheme : lightTheme;
        for (const key of Object.keys(themeLabels) as (keyof ThemeColors)[]) {
          const input = form.elements.namedItem(key) as HTMLInputElement;
          input.value = preset[key];
        }
        const customMode = form.querySelector<HTMLInputElement>('input[value="custom"]');
        if (customMode) customMode.checked = true;
        update();
      })
    );
  }

  private async saveTheme(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const values = new FormData(event.currentTarget as HTMLFormElement);
    const customTheme = Object.fromEntries(
      (Object.keys(themeLabels) as (keyof ThemeColors)[]).map((key) => [
        key,
        textValue(values, key)
      ])
    ) as unknown as ThemeColors;
    if (Object.values(customTheme).some((color) => !/^#[0-9a-f]{6}$/i.test(color))) {
      this.message = "Every custom theme value must be a valid color.";
      this.render();
      return;
    }
    this.data.settings.theme = textValue(values, "theme") as AppData["settings"]["theme"];
    this.data.settings.customTheme = customTheme;
    await this.persist();
    this.applyTheme();
    this.message = "Theme saved.";
    this.render();
  }

  private async archive(kind: "exercise" | "routine", targetId: string): Promise<void> {
    let target: Exercise | Routine | undefined;
    if (kind === "exercise") {
      target = this.data.exercises.find(({ id }) => id === targetId);
    } else {
      target = this.data.routines.find(({ id }) => id === targetId);
    }
    if (target) {
      target.archived = true;
      await this.persist();
      this.message = "Archived. Existing history was preserved.";
      this.render();
    }
  }

  private async persist(): Promise<void> {
    await this.repository.save(this.data);
    if (!this.cloud.signedIn) return;
    window.clearTimeout(this.cloudBackupTimer);
    this.cloudBackupTimer = window.setTimeout(() => void this.automaticSupabaseBackup(), 1_500);
  }

  private async automaticSupabaseBackup(): Promise<void> {
    try {
      await this.cloud.upload(this.data);
      this.message = "Changes saved locally and backed up to Supabase.";
    } catch (error) {
      this.message =
        error instanceof Error ? error.message : "The automatic Supabase backup failed.";
    }
    this.render();
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

  private async authenticateSupabase(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    try {
      const values = new FormData(event.currentTarget as HTMLFormElement);
      const email = textValue(values, "email");
      const password = textValue(values, "accountPassword");
      const action = (event.submitter as HTMLButtonElement | null)?.value;
      if (action === "signup") {
        const signedIn = await this.cloud.signUp(email, password);
        this.message = signedIn
          ? "Supabase account created and signed in."
          : "Account created. Confirm the email, then sign in.";
      } else {
        await this.cloud.signIn(email, password);
        this.message = "Signed in to Supabase.";
      }
    } catch (error) {
      this.message = error instanceof Error ? error.message : "Supabase authentication failed.";
    }
    this.render();
  }

  private async signOutSupabase(): Promise<void> {
    try {
      await this.cloud.signOut();
      this.message = "Signed out of Supabase.";
    } catch (error) {
      this.message = error instanceof Error ? error.message : "Supabase sign-out failed.";
    }
    this.render();
  }

  private async backupToSupabase(): Promise<void> {
    try {
      await this.cloud.upload(this.data);
      this.message =
        "Backup saved to Supabase. Later changes will back up automatically while this app remains open.";
    } catch (error) {
      this.message = error instanceof Error ? error.message : "Supabase backup failed.";
    }
    this.render();
  }

  private async restoreFromSupabase(): Promise<void> {
    try {
      const { summary, data } = await this.cloud.downloadLatest();
      validateAppData(data);
      const restored = structuredClone(data);
      const counts = `${restored.exercises.length} exercises, ${restored.routines.length} routines, ${restored.sessions.length} sessions`;
      const date = new Date(summary.createdAt).toLocaleString();
      if (
        !confirm(
          `Replace this device's data with the Supabase backup from ${date} (${counts})? This cannot be undone.`
        )
      )
        return;
      await this.repository.replace(restored);
      this.data = restored;
      this.applyTheme();
      this.message = `Supabase backup restored: ${counts}.`;
    } catch (error) {
      this.message = error instanceof Error ? error.message : "Supabase restore failed.";
    }
    this.render();
  }
}
