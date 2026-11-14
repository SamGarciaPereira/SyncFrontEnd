/**
 * Alarme sonoro do app em primeiro plano, sintetizado com a Web Audio API
 * (sem arquivo de áudio). Toca um padrão de bipes em loop até `stopAlarm()`.
 *
 * Observação: navegadores só tocam som depois de um gesto do usuário. Chame
 * `unlockAudio()` dentro de um clique/toque (ex.: "Ativar lembretes" / "Testar
 * alarme" / primeiro toque na página) para liberar o áudio.
 */

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let loopId: ReturnType<typeof setInterval> | null = null;
let playing = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** Agenda um bipe curto com envelope (evita estalos). */
function scheduleBeep(c: AudioContext, freq: number, start: number, dur: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
  gain.gain.setValueAtTime(0.35, start + dur - 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Dois bipes por ciclo — padrão clássico de alarme. */
function playCycle() {
  const c = ctx;
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = c.currentTime;
  scheduleBeep(c, 880, now, 0.18);
  scheduleBeep(c, 988, now + 0.26, 0.18);
}

/** Libera o áudio. DEVE ser chamado dentro de um gesto do usuário. */
export async function unlockAudio(): Promise<void> {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") await c.resume();
    // "ping" quase inaudível, só para destravar (necessário no iOS).
    const osc = c.createOscillator();
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.02);
  } catch {
    // ignora: se não liberar agora, tenta de novo quando o alarme tocar
  }
}

/** Começa o alarme em loop (toca até `stopAlarm()`). */
export function startAlarm(): void {
  const c = getCtx();
  if (!c || playing) return;
  playing = true;
  playCycle();
  loopId = setInterval(playCycle, 1400);
}

/** Para o alarme. */
export function stopAlarm(): void {
  playing = false;
  if (loopId !== null) {
    clearInterval(loopId);
    loopId = null;
  }
}

export function isAlarmPlaying(): boolean {
  return playing;
}
