import { api } from "./api";

export interface DoseEvent {
  id: number;
  medicationId: number;
  userId: number;
  scheduledTime: string | null; // "HH:mm"
  status: "TAKEN" | "SKIPPED";
  takenAt: string;
}

/** Calls to the API's /doses routes (dose check-in / "Tomei"). */
export const doseService = {
  /** Doses the logged-in user already confirmed today. */
  async takenToday() {
    const res = await api.get<DoseEvent[]>("/doses");
    return res.data;
  },

  /** Confirms a dose was taken. */
  async confirm(medicationId: number, scheduledTime?: string) {
    const res = await api.post<DoseEvent>("/doses", {
      medicationId,
      scheduledTime,
    });
    return res.data;
  },
};
