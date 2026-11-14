import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  AlertTriangle,
  BellOff,
  BellRing,
  Check,
  Clock,
  Loader2,
  Pill,
  Smartphone,
} from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { IconBadge } from "../components/IconBadge";
import { medicationService, type Medication } from "../../services/medications";
import { doseService } from "../../services/doses";
import {
  dosesForDay,
  findNextDose,
  toMinutes,
  WEEK_DAYS,
  type DoseOccurrence,
} from "../lib/medicationOptions";
import { SelectField } from "../components/SelectField";
import { cn } from "../lib/cn";
import { getApiErrorMessage } from "../../services/errors";
import {
  disablePush,
  enablePush,
  getPushState,
  type PushState,
} from "../../services/push";
import { useAlarm } from "../alarm/alarmContext";

/** Key that identifies a dose occurrence (medication + scheduled time). */
function doseKey(medicationId: number, time: string | null) {
  return `${medicationId}@${time ?? ""}`;
}

/** Quantos dias o seletor mostra: hoje + próximos 7. */
const DAY_OPTIONS = 8;

/** Data (meia-noite) daqui a `offset` dias a partir de hoje. */
function dateForOffset(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/** Rótulo do dia: "Hoje · 14/11", "Amanhã · 15/11" ou "Sáb · 16/11". */
function dayOptionLabel(offset: number): string {
  const d = dateForOffset(offset);
  const dm = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  if (offset === 0) return `Hoje · ${dm}`;
  if (offset === 1) return `Amanhã · ${dm}`;
  const weekday = WEEK_DAYS.find((w) => w.value === d.getDay())?.label ?? "";
  return `${weekday} · ${dm}`;
}

export function Lembretes() {
  const [medications, setMedications] = useState<Medication[] | null>(null);
  const [takenKeys, setTakenKeys] = useState<Set<string>>(new Set());
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedOffset, setSelectedOffset] = useState(0);
  const defaultedRef = useRef(false);

  const load = useCallback(() => {
    Promise.all([medicationService.list(), doseService.takenToday()])
      .then(([meds, taken]) => {
        setMedications(meds);
        setTakenKeys(
          new Set(taken.map((t) => doseKey(t.medicationId, t.scheduledTime))),
        );
        // Abre no próximo dia com dose pendente (rollover): se os horários de
        // hoje já passaram, cai em amanhã. Só na primeira carga.
        if (!defaultedRef.current) {
          defaultedRef.current = true;
          const next = findNextDose(meds);
          if (next && next.dayOffset > 0 && next.dayOffset < DAY_OPTIONS) {
            setSelectedOffset(next.dayOffset);
          }
        }
      })
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(load, [load]);

  const selectedDate = useMemo(
    () => dateForOffset(selectedOffset),
    [selectedOffset],
  );
  const doses = medications ? dosesForDay(medications, selectedDate) : [];

  const isToday = selectedOffset === 0;
  const isFuture = selectedOffset > 0;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const confirmDose = async (occ: DoseOccurrence) => {
    const key = doseKey(occ.medicationId, occ.time);
    setTakenKeys((prev) => new Set(prev).add(key)); // otimista
    try {
      await doseService.confirm(occ.medicationId, occ.time);
    } catch {
      setTakenKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
          Lembretes
        </h1>
        <p className="mt-1.5 text-muted">
          Avise na hora certa de cada dose — mesmo com a tela do celular apagada.
        </p>
      </header>

      <NotificationsCard />

      <AlarmTestCard />

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-heading">Doses</h2>
          <SelectField
            aria-label="Escolher o dia"
            value={selectedOffset}
            onChange={(e) => setSelectedOffset(Number(e.target.value))}
            containerClassName="w-full sm:w-52"
          >
            {Array.from({ length: DAY_OPTIONS }, (_, i) => (
              <option key={i} value={i}>
                {dayOptionLabel(i)}
              </option>
            ))}
          </SelectField>
        </div>

        {loadFailed ? (
          <Card>
            <p className="text-sm text-muted">
              Não foi possível carregar as doses.
            </p>
          </Card>
        ) : !medications ? (
          <Card>
            <p className="text-sm text-muted">Carregando...</p>
          </Card>
        ) : doses.length === 0 ? (
          <div className="flex flex-col items-center rounded-card border border-dashed border-surface-border bg-surface/60 p-10 text-center">
            <IconBadge icon={Pill} size="lg" />
            <p className="mt-4 font-semibold text-heading">
              Nenhuma dose para este dia
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Cadastre um medicamento com horários para ver os lembretes aqui.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {doses.map((occ) => {
              const taken =
                isToday && takenKeys.has(doseKey(occ.medicationId, occ.time));
              const past = isToday && toMinutes(occ.time) < nowMinutes;
              return (
                <li
                  key={`${occ.medicationId}-${occ.time}`}
                  className={cn(
                    "flex items-center gap-4 rounded-card border border-surface-border bg-surface p-4 shadow-card",
                    past && !taken && "opacity-60",
                  )}
                >
                  <div className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-sage">
                    <Clock size={16} className="text-sage-icon" aria-hidden="true" />
                    <span className="mt-0.5 text-base font-bold text-heading">
                      {occ.time}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-heading">
                      {occ.name}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {occ.dosageLabel}
                    </p>
                  </div>
                  {taken ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-sage px-3 py-2 text-sm font-semibold text-sage-icon">
                      <Check size={18} aria-hidden="true" /> Tomada
                    </span>
                  ) : isFuture ? (
                    <span className="shrink-0 text-sm font-medium text-muted">
                      Agendada
                    </span>
                  ) : (
                    <Button
                      onClick={() => confirmDose(occ)}
                      leftIcon={<Check size={18} aria-hidden="true" />}
                    >
                      Tomei
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Lets the user preview the in-app alarm popup (and unlocks audio). */
function AlarmTestCard() {
  const { testAlarm } = useAlarm();
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-heading">Testar o alarme</p>
          <p className="text-sm text-muted">
            Veja como o aviso aparece na tela, com som — sem esperar o horário.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={testAlarm}
          leftIcon={<AlarmClock size={18} aria-hidden="true" />}
        >
          Testar alarme
        </Button>
      </div>
    </Card>
  );
}

/** Card that turns the device's medication reminders on/off. */
function NotificationsCard() {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await enablePush();
      setState("enabled");
      setMessage("Pronto! Este aparelho vai avisar na hora de cada dose.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : getApiErrorMessage(err));
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await disablePush();
      setState("default");
      setMessage("Lembretes desativados neste aparelho.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return (
      <Card>
        <p className="text-sm text-muted">Verificando as notificações...</p>
      </Card>
    );
  }

  if (state === "enabled") {
    return (
      <Card icon={BellRing} title="Lembretes ativados neste aparelho">
        <p className="text-sm text-muted">
          Você vai receber uma notificação com som na hora de cada dose, mesmo
          com a tela apagada.
        </p>
        {message && <p className="mt-3 text-sm text-forest">{message}</p>}
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={handleDisable}
            disabled={busy}
            leftIcon={
              busy ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <BellOff size={18} />
              )
            }
          >
            Desativar neste aparelho
          </Button>
        </div>
      </Card>
    );
  }

  if (state === "unsupported" || state === "unconfigured") {
    const text =
      state === "unsupported"
        ? "Este navegador não suporta lembretes por notificação. No Android, use o Chrome; no iPhone, toque em Compartilhar e em “Adicionar à Tela de Início”, depois abra por lá."
        : "Os lembretes ainda não estão configurados neste ambiente.";
    return (
      <Card icon={Smartphone} title="Lembretes por notificação">
        <p className="text-sm text-muted">{text}</p>
      </Card>
    );
  }

  // "default" ou "denied"
  const denied = state === "denied";
  return (
    <Card icon={BellRing} title="Receber lembretes neste aparelho">
      <p className="text-sm text-muted">
        Ative para receber um aviso com som na hora de cada dose — mesmo com a
        tela apagada ou o app fechado.
      </p>

      {denied && (
        <p className="mt-3 flex items-start gap-2 text-sm text-danger">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          As notificações estão bloqueadas. Libere-as para este site nas
          configurações do navegador e tente de novo.
        </p>
      )}

      {message && !denied && (
        <p className="mt-3 text-sm text-danger">{message}</p>
      )}

      <div className="mt-4">
        <Button
          size="lg"
          onClick={handleEnable}
          disabled={busy || denied}
          leftIcon={
            busy ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <BellRing size={20} />
            )
          }
        >
          {busy ? "Ativando..." : "Ativar lembretes"}
        </Button>
      </div>
    </Card>
  );
}
