import { api } from "./api";

export interface User {
  id: number;
  name: string;
  email: string;
  birthDate: string | null;
  phone: string | null;
  activatedAt: string | null;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  birthDate: string; // "AAAA-MM-DD"
  phone: string;
}

/** Calls to the API's /users, /sessions and /user routes. */
export const authService = {
  async signUp(data: SignUpInput) {
    const res = await api.post<User>("/users", data);
    return res.data;
  },

  /** Login: the API answers with the user and sets the session cookie. */
  async signIn(email: string, password: string) {
    const res = await api.post<User>("/sessions", { email, password });
    return res.data;
  },

  async signOut() {
    await api.delete("/sessions");
  },

  /** Who is logged in (401 when nobody is). */
  async getCurrentUser() {
    const res = await api.get<User>("/user");
    return res.data;
  },
};
