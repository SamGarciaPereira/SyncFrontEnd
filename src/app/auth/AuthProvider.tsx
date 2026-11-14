import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { isAxiosError } from "axios";
import { api } from "../../services/api";
import { authService, type SignUpInput, type User } from "../../services/auth";
import { disablePush } from "../../services/push";
import { AuthContext, type AuthContextValue } from "./authContext";

/** Keeps the logged-in user for the whole app (read from the session cookie). */
export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = still asking the API who is logged in
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let ignore = false;
    authService
      .getCurrentUser()
      .then((current) => {
        if (!ignore) setUser(current);
      })
      .catch(() => {
        if (!ignore) setUser(null);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Session expired while using the app: any 401 logs the user out.
  useEffect(() => {
    const interceptor = api.interceptors.response.use(undefined, (error: unknown) => {
      const isLoginAttempt = isAxiosError(error) && error.config?.url === "/sessions";
      if (isAxiosError(error) && error.response?.status === 401 && !isLoginAttempt) {
        setUser(null);
      }
      return Promise.reject(error);
    });
    return () => api.interceptors.response.eject(interceptor);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const loggedIn = await authService.signIn(email, password);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const signUp = useCallback(
    async (data: SignUpInput) => {
      await authService.signUp(data);
      return signIn(data.email, data.password);
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    try {
      // Para de notificar este aparelho enquanto a sessão ainda é válida.
      await disablePush().catch(() => {});
      await authService.signOut();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      status: user === undefined ? "checking" : user ? "authenticated" : "guest",
      signIn,
      signUp,
      signOut,
    }),
    [user, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
