import { AlarmClock, BellOff, Check, Clock, Pill } from "lucide-react";
import { Button } from "./Button";

interface DoseAlarmModalProps {
  name: string;
  time: string;
  dosageLabel: string;
  /** Alarme de teste: os botões só fecham, sem gravar a dose. */
  isTest?: boolean;
  onConfirm: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
}

/**
 * Popup de alarme em tela cheia — aparece com o app aberto quando chega a hora
 * de uma dose. Visual grande e botões largos (foco no idoso).
 */
export function DoseAlarmModal({
  name,
  time,
  dosageLabel,
  isTest,
  onConfirm,
  onSnooze,
  onDismiss,
}: DoseAlarmModalProps) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Hora do remédio"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-forest-dark/50 p-4 backdrop-blur-sm"
    >
      <div className="relative flex w-full max-w-md flex-col items-center rounded-card border border-surface-border bg-surface p-6 text-center shadow-card sm:p-8">
        {isTest && (
          <span className="absolute left-4 top-4 rounded-full bg-sage px-3 py-1 text-xs font-semibold text-sage-icon">
            Teste
          </span>
        )}

        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sage ring-8 ring-sage/40 motion-safe:animate-pulse">
          <Pill className="text-sage-icon" size={40} aria-hidden="true" />
        </div>

        <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-forest">
          Hora do remédio
        </p>
        <h2 className="mt-1 text-3xl font-bold text-heading">{name}</h2>
        <p className="mt-2 text-lg text-muted">{dosageLabel}</p>

        <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-sage px-4 py-2 text-xl font-bold text-heading">
          <Clock size={22} className="text-sage-icon" aria-hidden="true" /> {time}
        </p>

        <div className="mt-8 w-full space-y-3">
          <Button
            size="lg"
            fullWidth
            autoFocus
            onClick={onConfirm}
            leftIcon={<Check size={22} aria-hidden="true" />}
          >
            Tomei
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onSnooze}
              leftIcon={<AlarmClock size={20} aria-hidden="true" />}
            >
              Adiar 5 min
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              onClick={onDismiss}
              leftIcon={<BellOff size={20} aria-hidden="true" />}
            >
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
