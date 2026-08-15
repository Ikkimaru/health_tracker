export type MeasurementKind = "reps" | "duration" | "distance";

export interface Prescription {
  id: string;
  target: number;
  completed: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  kind: MeasurementKind;
  sets: number;
  target: number;
  weightKg?: number;
  notes?: string;
  archived: boolean;
  createdAt: string;
}

export interface RoutineItem {
  id: string;
  exerciseId: string;
  required: boolean;
  sets?: number;
  target?: number;
  weightKg?: number;
}

export interface RoutineSchedule {
  weekdays: number[];
  dates: string[];
}

export interface Routine {
  id: string;
  name: string;
  items: RoutineItem[];
  schedule: RoutineSchedule;
  archived: boolean;
  createdAt: string;
}

export interface SessionExercise {
  id: string;
  sourceExerciseId: string;
  name: string;
  kind: MeasurementKind;
  required: boolean;
  weightKg?: number;
  notes?: string;
  prescriptions: Prescription[];
  completedAt?: string;
}

export interface DailySession {
  id: string;
  date: string;
  routineIds: string[];
  exercises: SessionExercise[];
  createdAt: string;
}

export interface AppSettings {
  displayName: string;
  theme: "system" | "light" | "dark" | "custom";
  customTheme?: ThemeColors;
  goalWeightKg?: number;
  goalWeightDeadline?: string;
  weightTrendMethod?: WeightTrendMethod;
  weightCalendarWeekStart?: "sunday" | "monday";
}

export type WeightTrendMethod = "linear" | "weighted" | "theil-sen";

export interface WeightEntry {
  date: string;
  weightKg: number;
}

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  accent: string;
  accentText: string;
  border: string;
  hero: string;
  heroText: string;
  success: string;
  noticeBackground: string;
  noticeText: string;
}

export interface AppData {
  schemaVersion: 1;
  exercises: Exercise[];
  routines: Routine[];
  sessions: DailySession[];
  weights: WeightEntry[];
  settings: AppSettings;
}

export interface Progress {
  xp: number;
  level: number;
  completedExercises: number;
  completedDays: number;
  currentStreak: number;
  longestStreak: number;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export interface BackupEnvelope {
  format: "healthtracker-backup";
  schemaVersion: 1;
  createdAt: string;
  encryption: {
    algorithm: "AES-GCM";
    derivation: "PBKDF2-SHA-256";
    iterations: number;
    salt: string;
    iv: string;
  };
  ciphertext: string;
}
