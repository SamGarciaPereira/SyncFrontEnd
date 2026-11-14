import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { medicationService, type Medication } from "../../services/medications";
import { doseService } from "../../services/doses";
import { startAlarm, stopAlarm, unlockAudio } from "../../services/alarmSound";
import {
  dosesForDay,
  findNextDose,
  toMinutes,
} from "../lib/medicationOptions";
import { DoseAlarmModal } from "../components/DoseAlarmModal";
import { AlarmContext, type AlarmContextValue } from "./alarmContext";

interface ActiveAlarm {
  medicationId: number;
  name: string;
  time: string;
  dosageLabel: string;
  /** Alarme de teste: não grava a dose ao confirmar. */
  test?: boolean;
}

interface SnoozedAlarm {
  key: string;
  fireAt: number;
  occ: ActiveAlarm;
}

const RELOAD_MS = 3 * 60 * 1000; // recarrega as doses a cada 3 min
const TICK_MS = 15 * 1000; // verifica os horários a cada 15 s
const SNOOZE_MS = 5 * 60 * 1000; // "Adiar" = 5 min
const VIBRATE_PATTERN = [500, 250, 500, 250, 500];

function takenKeyOf(medicationId: number, time: string) {
  return `${medicationId}@${time}`;
}

function dateKeyOf(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Observa as doses do usuário logado e, com o app aberto, dispara um popup com
 * som em loop quando chega a hora de uma dose. Complementa a notificação push
 * (que cobre o caso de tela apagada / app fechado).
 */
export function AlarmProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveAlarm | null>(null);

  const medsRef = useRef<Medication[]>([]);
  const takenRef = useRef<Set<string>>(new Set());
  const alarmedRef = useRef<Set<string>>(new Set());
  const snoozedRef = useRef<SnoozedAlarm[]>([]);
  const activeRef = useRef<ActiveAlarm | null>(null);
  const vibrateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- dados (doses de hoje + o que já foi tomado) ---
  const loadData = useCallback(async () => {
    try {
      const [meds, taken] = await Promise.all([
        medicationService.list(),
        doseService.takenToday(),
      ]);
      medsRef.current = meds;
      takenRef.current = new Set(
        taken.map((t) => takenKeyOf(t.medicationId, t.scheduledTime ?? "")),
      );
    } catch {
      // melhor esforço: tenta de novo no próximo ciclo
    }
  }, []);

  useEffect(() => {
    loadData();
    const reload = setInterval(loadData, RELOAD_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") loadData();
    };
    window.addEventListener("focus", loadData);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(reload);
      window.removeEventListener("focus", loadData);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadData]);

  // --- libera o áudio no primeiro gesto do usuário ---
  useEffect(() => {
    const onGesture = () => {
      unlockAudio();
    };
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []);

  const stopVibration = useCallback(() => {
    if (vibrateRef.current !== null) {
      clearInterval(vibrateRef.current);
      vibrateRef.current = null;
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(0);
    }
  }, []);

  const triggerAlarm = useCallback(
    (occ: ActiveAlarm) => {
      activeRef.current = occ;
      setActive(occ);
      startAlarm();
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(VIBRATE_PATTERN);
        stopVibration();
        vibrateRef.current = setInterval(
          () => navigator.vibrate(VIBRATE_PATTERN),
          2200,
        );
      }
    },
    [stopVibration],
  );

  const stopActive = useCallback(() => {
    stopAlarm();
    stopVibration();
    activeRef.current = null;
    setActive(null);
  }, [stopVibration]);

  // --- para o alarme se o provider desmontar (ex.: logout) ---
  useEffect(() => stopActive, [stopActive]);

  // --- verifica os horários ---
  const tick = useCallback(() => {
    if (activeRef.current) return; // já tem um alarme na tela
    const meds = medsRef.current;
    if (meds.length === 0) return;

    const now = new Date();
    const nowMs = Date.now();

    // 1) sonecas vencidas
    const snoozed = snoozedRef.current;
    for (let i = 0; i < snoozed.length; i++) {
      const s = snoozed[i];
      if (takenRef.current.has(takenKeyOf(s.occ.medicationId, s.occ.time))) {
        snoozed.splice(i, 1);
        i--;
        continue;
      }
      if (s.fireAt <= nowMs) {
        snoozed.splice(i, 1);
        triggerAlarm(s.occ);
        return;
      }
    }

    // 2) doses no minuto atual (janela curta: agora ou 1 min atrasado)
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const dateKey = dateKeyOf(now);
    for (const occ of dosesForDay(meds, now)) {
      const diff = nowMin - toMinutes(occ.time);
      if (diff < 0 || diff > 1) continue;
      if (takenRef.current.has(takenKeyOf(occ.medicationId, occ.time))) continue;
      const key = `${occ.medicationId}@${occ.time}@${dateKey}`;
      if (alarmedRef.current.has(key)) continue;
      alarmedRef.current.add(key);
      triggerAlarm({
        medicationId: occ.medicationId,
        name: occ.name,
        time: occ.time,
        dosageLabel: occ.dosageLabel,
      });
      return;
    }
  }, [triggerAlarm]);

  useEffect(() => {
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [tick]);

  // --- ações do popup ---
  const confirm = useCallback(async () => {
    const current = activeRef.current;
    stopActive();
    if (!current || current.test) return;
    try {
      await doseService.confirm(current.medicationId, current.time);
      takenRef.current.add(takenKeyOf(current.medicationId, current.time));
    } catch {
      // melhor esforço: a dose segue na lista para confirmar depois
    }
  }, [stopActive]);

  const snooze = useCallback(() => {
    const current = activeRef.current;
    stopActive();
    if (!current || current.test) return;
    snoozedRef.current.push({
      key: `${current.medicationId}@${current.time}@${dateKeyOf(new Date())}`,
      fireAt: Date.now() + SNOOZE_MS,
      occ: current,
    });
  }, [stopActive]);

  const dismiss = useCallback(() => {
    stopActive();
  }, [stopActive]);

  const testAlarm = useCallback(() => {
    unlockAudio();
    const next = findNextDose(medsRef.current);
    triggerAlarm({
      medicationId: -1,
      name: next ? next.name : "Remédio de exemplo",
      time: next ? next.time : "08:00",
      dosageLabel: "Dose de teste",
      test: true,
    });
  }, [triggerAlarm]);

  const value = useMemo<AlarmContextValue>(() => ({ testAlarm }), [testAlarm]);

  return (
    <AlarmContext.Provider value={value}>
      {children}
      {active && (
        <DoseAlarmModal
          name={active.name}
          time={active.time}
          dosageLabel={active.dosageLabel}
          isTest={active.test}
          onConfirm={confirm}
          onSnooze={snooze}
          onDismiss={dismiss}
        />
      )}
    </AlarmContext.Provider>
  );
}
