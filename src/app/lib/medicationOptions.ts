import type {
  CatalogItem,
  DosageUnit,
  Medication,
  MedicationForm,
  MedicationSchedule,
} from "../../services/medications";

export const FORM_OPTIONS: { value: MedicationForm; label: string }[] = [
  { value: "TABLET", label: "Comprimido" },
  { value: "CAPSULE", label: "Cápsula" },
  { value: "DROPS", label: "Gotas" },
  { value: "LIQUID", label: "Xarope / líquido" },
  { value: "INJECTION", label: "Injeção" },
  { value: "INHALER", label: "Inalador (bombinha)" },
  { value: "TOPICAL", label: "Pomada / creme" },
  { value: "PATCH", label: "Adesivo" },
];

export const FORM_LABELS = Object.fromEntries(
  FORM_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<MedicationForm, string>;

export const UNIT_LABELS: Record<DosageUnit, string> = {
  PILULA: "comprimido(s)",
  MG: "mg",
  ML: "ml",
  GOTAS: "gotas",
  UI: "UI",
  JATO: "jato(s)",
  APLICACAO: "aplicação(ões)",
};

/** Mirrors FORM_CONSTRAINTS in the API (src/models/medication.ts). */
export const ALLOWED_UNITS: Record<MedicationForm, DosageUnit[]> = {
  TABLET: ["PILULA", "MG"],
  CAPSULE: ["PILULA", "MG"],
  DROPS: ["GOTAS", "ML"],
  LIQUID: ["ML", "MG"],
  INJECTION: ["UI", "ML", "MG", "APLICACAO"],
  INHALER: ["JATO", "APLICACAO"],
  TOPICAL: ["APLICACAO", "MG"],
  PATCH: ["APLICACAO", "MG"],
};

/** Mirrors `allowsFraction` in the API: whether half a pill is accepted. */
export const ALLOWS_FRACTION: Record<MedicationForm, boolean> = {
  TABLET: true,
  CAPSULE: false,
  DROPS: false,
  LIQUID: true,
  INJECTION: true,
  INHALER: false,
  TOPICAL: false,
  PATCH: false,
};

/** Unit shown next to the stock quantity. */
export const STOCK_UNIT_LABELS: Record<MedicationForm, string> = {
  TABLET: "comprimidos",
  CAPSULE: "cápsulas",
  DROPS: "ml",
  LIQUID: "ml",
  INJECTION: "ml",
  INHALER: "doses",
  TOPICAL: "unidades",
  PATCH: "adesivos",
};

/** Display order Seg → Dom, with the API value (0 = domingo ... 6 = sábado). */
export const WEEK_DAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function displayName(med: Medication): string {
  return med.nickname || med.customName;
}

export function formatDose(amount: number, unit: DosageUnit): string {
  return `${amount.toLocaleString("pt-BR")} ${UNIT_LABELS[unit]}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Accepts "0,5" or "0.5". Returns NaN for empty/invalid input. */
export function parseDecimal(value: string): number {
  const normalized = value.trim().replace(",", ".");
  return normalized === "" ? NaN : Number(normalized);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** First dose + "every N hours" → all times in one day. 08:00 / 8h → 08:00, 16:00, 00:00. */
export function buildDailyTimes(firstDose: string, everyHours: number): string[] {
  const start = toMinutes(firstDose);
  const step = everyHours * 60;
  const times: string[] = [];
  for (let offset = 0; offset < 24 * 60; offset += step) {
    const total = (start + offset) % (24 * 60);
    times.push(`${pad(Math.floor(total / 60))}:${pad(total % 60)}`);
  }
  return times;
}

export function formatDays(days: number[]): string {
  const unique = new Set(days);
  if (unique.size === 7) return "Todos os dias";
  return WEEK_DAYS.filter((d) => unique.has(d.value))
    .map((d) => d.label)
    .join(", ");
}

export function describeSchedules(schedules: MedicationSchedule[]) {
  const times = [...new Set(schedules.map((s) => s.time))].sort();
  const days = [...new Set(schedules.flatMap((s) => s.daysOfWeek))];
  return { times, perDay: times.length, daysLabel: formatDays(days) };
}

export interface NextDose {
  time: string;
  name: string;
  /** 0 = hoje, 1 = amanhã, ... */
  dayOffset: number;
}

/** Earliest scheduled dose from now, looking up to a week ahead. */
export function findNextDose(meds: Medication[], now = new Date()): NextDose | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const weekday = (now.getDay() + dayOffset) % 7;
    const candidates = meds
      .filter((m) => !m.isConditional)
      .flatMap((m) =>
        m.schedules
          .filter((s) => s.daysOfWeek.includes(weekday))
          .map((s) => ({ time: s.time, name: displayName(m) })),
      )
      .filter((c) => dayOffset > 0 || toMinutes(c.time) >= nowMinutes)
      .sort((a, b) => a.time.localeCompare(b.time));

    if (candidates.length > 0) return { ...candidates[0], dayOffset };
  }
  return null;
}

export interface DoseOccurrence {
  medicationId: number;
  name: string;
  time: string; // "HH:mm"
  dosageLabel: string;
}

/** All scheduled doses for a given day (default: today), ordered by time. */
export function dosesForDay(meds: Medication[], date = new Date()): DoseOccurrence[] {
  const weekday = date.getDay();
  return meds
    .filter((m) => !m.isConditional)
    .flatMap((m) =>
      m.schedules
        .filter((s) => s.daysOfWeek.includes(weekday))
        .map((s) => ({
          medicationId: m.id,
          name: displayName(m),
          time: s.time,
          dosageLabel: formatDose(m.dosageAmount, m.dosageUnit),
        })),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
}

/* ---------- Two-step register flow (Cadastrar → Quando tomar) ---------- */

export interface MedicationDraft {
  /** Set when the medication was picked from the catalog. */
  catalogItem?: CatalogItem;
  name: string;
  form: MedicationForm;
  dosageAmount: number;
  dosageUnit: DosageUnit;
  currentStock?: number;
}

const DRAFT_KEY = "sync:medication-draft";

export function saveDraft(draft: MedicationDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage unavailable: the flow still works within this page load
  }
}

export function loadDraft(): MedicationDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as MedicationDraft) : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
