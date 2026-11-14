import { createContext, useContext } from "react";

export interface AlarmContextValue {
  /** Dispara o popup de alarme com a próxima dose, para demonstração/teste. */
  testAlarm: () => void;
}

export const AlarmContext = createContext<AlarmContextValue | null>(null);

export function useAlarm(): AlarmContextValue {
  const value = useContext(AlarmContext);
  if (!value) {
    throw new Error("useAlarm precisa estar dentro de <AlarmProvider>.");
  }
  return value;
}
