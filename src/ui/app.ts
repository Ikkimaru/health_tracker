import type { DataRepository } from "../application/store";
import {
  decideSync,
  fingerprint,
  formatCooldownRemaining,
  formatSyncDate,
  parseConflictChoice,
  SYNC_COOLDOWN_MS,
  type SyncMetadata
} from "../application/sync";
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
  private snackbarTimer?: number;

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
    await this.syncOnRefresh();
    this.applyTheme();
    await this.ensureToday();
    this.render();
  }

  private syncStorageKey(): string {
    return `health-quest-sync:${this.cloud.accountId}`;
  }

  private syncMetadata(): SyncMetadata {
    if (!this.cloud.accountId) return {};
    try {
      return JSON.parse(localStorage.getItem(this.syncStorageKey()) ?? "{}") as SyncMetadata;
    } catch {
      return {};
    }
  }

  private saveSyncMetadata(metadata: SyncMetadata): void {
    if (!this.cloud.accountId) return;
    try {
      localStorage.setItem(this.syncStorageKey(), JSON.stringify(metadata));
    } catch {
      // Sync still works for this page load when browser storage is unavailable.
    }
  }

  private async recordBackup(summary: { id: string; createdAt: string }): Promise<void> {
    const metadata = this.syncMetadata();
    this.saveSyncMetadata({
      ...metadata,
      snapshotId: summary.id,
      localHash: await fingerprint(this.data),
      lastBackupAt: summary.createdAt
    });
  }

  private async syncOnRefresh(): Promise<void> {
    if (!this.cloud.signedIn) return;
    const metadata = this.syncMetadata();
    const now = Date.now();
    if (metadata.lastQueryAt && now - new Date(metadata.lastQueryAt).getTime() < SYNC_COOLDOWN_MS) {
      const elapsed = now - new Date(metadata.lastQueryAt).getTime();
      const remaining = formatCooldownRemaining(SYNC_COOLDOWN_MS - elapsed);
      this.message = `Please wait ${remaining} before the next refresh backup or restore can occur.`;
      return;
    }
    const queriedAt = new Date(now).toISOString();
    this.saveSyncMetadata({ ...metadata, lastQueryAt: queriedAt });
    try {
      const latest = await this.cloud.queryLatest();
      if (!latest) {
        const summary = await this.cloud.upload(this.data);
        await this.recordBackup(summary);
        this.message = "Local data backed up to Supabase on refresh.";
        return;
      }
      validateAppData(latest.data);
      const cloudData = structuredClone(latest.data);
      const localHash = await fingerprint(this.data);
      const cloudHash = await fingerprint(cloudData);
      const decision = decideSync(metadata, localHash, cloudHash, latest.summary.id);
      this.saveSyncMetadata({
        ...this.syncMetadata(),
        lastBackupAt: latest.summary.createdAt
      });
      if (decision === "none") {
        this.saveSyncMetadata({
          ...this.syncMetadata(),
          snapshotId: latest.summary.id,
          localHash
        });
        return;
      }
      let useCloud = decision === "restore";
      if (decision === "conflict") {
        const answer = parseConflictChoice(
          prompt(
            "Local and Supabase data both changed. Type LOCAL to keep and upload this device's data, type SUPABASE to restore cloud data, or select Cancel to do nothing."
          )
        );
        if (answer !== "local" && answer !== "supabase") {
          this.message = "Conflict resolution cancelled. No data was changed.";
          return;
        }
        useCloud = answer === "supabase";
      }
      if (useCloud) {
        await this.repository.replace(cloudData);
        this.data = cloudData;
        this.saveSyncMetadata({
          ...this.syncMetadata(),
          snapshotId: latest.summary.id,
          localHash: cloudHash,
          lastRestoreAt: new Date().toISOString()
        });
        this.message = "Latest Supabase data restored on refresh.";
      } else {
        const summary = await this.cloud.upload(this.data);
        await this.recordBackup(summary);
        this.message =
          decision === "conflict"
            ? "Local data kept and backed up to Supabase."
            : "Local changes backed up to Supabase on refresh.";
      }
    } catch (error) {
      this.message = error instanceof Error ? error.message : "Refresh sync failed.";
    }
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
      ? `<div class="snackbar" role="status" aria-live="polite">${escapeHtml(this.message)}</div>`
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
    window.clearTimeout(this.snackbarTimer);
    this.root.innerHTML = this.layout(renderView(this.view, this.data));
    this.addSupabasePanel();
    this.bindEvents();
    if (this.message) {
      const renderedMessage = this.message;
      this.snackbarTimer = window.setTimeout(() => {
        if (this.message !== renderedMessage) return;
        this.message = "";
        this.root.querySelector(".snackbar")?.remove();
      }, 5_000);
    }
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
    const sync = this.syncMetadata();
    const syncStatus = this.cloud.signedIn
      ? `<dl class="sync-status"><div><dt>Last backup</dt><dd>${escapeHtml(formatSyncDate(sync.lastBackupAt))}</dd></div><div><dt>Latest query</dt><dd>${escapeHtml(formatSyncDate(sync.lastQueryAt))}</dd></div></dl>`
      : "";
    const configurationNote = this.cloud.configured
      ? ""
      : "<small>Supabase requires deployment URL and publishable-key configuration. See the README.</small>";
    transfer?.insertAdjacentHTML(
      "beforebegin",
      `<div class="panel"><h3>Supabase backup</h3><p>${accountStatus} The newest five snapshots are retained.</p>${syncStatus}${controls}${configurationNote}</div>`
    );
    if (this.cloud.role === "developer") {
      transfer?.insertAdjacentHTML(
        "beforebegin",
        '<div class="panel"><p class="eyebrow">DEVELOPER</p><h3>Registered users</h3><div id="registered-users" aria-live="polite">Loading users…</div></div>'
      );
      void this.loadRegisteredUsers();
    }
  }

  private async loadRegisteredUsers(): Promise<void> {
    const container = this.root.querySelector<HTMLElement>("#registered-users");
    if (!container) return;
    try {
      const users = await this.cloud.listRegisteredUsers();
      if (!container.isConnected) return;
      container.innerHTML = users.length
        ? `<div class="user-list">${users
            .map(
              (user) =>
                `<article><div><strong>${escapeHtml(user.email || "No email")}</strong><small>Joined ${escapeHtml(new Date(user.registeredAt).toLocaleDateString())}</small></div><span class="role-badge">${user.role === "developer" ? "Developer" : "User"}</span></article>`
            )
            .join("")}</div>`
        : '<p class="empty">No registered users.</p>';
    } catch (error) {
      if (!container.isConnected) return;
      container.textContent =
        error instanceof Error ? error.message : "Registered users could not be loaded.";
    }
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
      const summary = await this.cloud.upload(this.data);
      await this.recordBackup(summary);
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
      const summary = await this.cloud.upload(this.data);
      await this.recordBackup(summary);
      this.message =
        "Backup saved to Supabase. Later changes will back up automatically while this app remains open.";
    } catch (error) {
      this.message = error instanceof Error ? error.message : "Supabase backup failed.";
    }
    this.render();
  }

  private async restoreFromSupabase(): Promise<void> {
    try {
      const sync = this.syncMetadata();
      if (
        sync.lastRestoreAt &&
        Date.now() - new Date(sync.lastRestoreAt).getTime() < SYNC_COOLDOWN_MS
      ) {
        this.message = "Restore is available one minute after the previous restore.";
        this.render();
        return;
      }
      this.saveSyncMetadata({ ...sync, lastQueryAt: new Date().toISOString() });
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
      this.saveSyncMetadata({
        ...this.syncMetadata(),
        snapshotId: summary.id,
        localHash: await fingerprint(restored),
        lastBackupAt: summary.createdAt,
        lastRestoreAt: new Date().toISOString()
      });
      this.message = `Supabase backup restored: ${counts}.`;
    } catch (error) {
      this.message = error instanceof Error ? error.message : "Supabase restore failed.";
    }
    this.render();
  }
}
