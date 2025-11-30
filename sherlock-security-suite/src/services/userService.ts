// src/services/userService.ts
import { AppUser } from "../models/User";
import { useUserStore } from "../store/userStore";

/**
 * In-memory demo users — used for login validation during development.
 * Replace / remove in production and use the backend API instead.
 */
const demoUsers: AppUser[] = [
  { id: "1", name: "Admin", email: "admin@gmail.com", role: "Admin" },
  { id: "2", name: "Director", email: "director@gmail.com", role: "ProjectDirector" },
  { id: "3", name: "SecHead", email: "security@gmail.com", role: "SecurityTechHead" },
  { id: "4", name: "Eng", email: "engineer@gmail.com", role: "ReleaseEngineer" },
  { id: "5", name: "Normal", email: "user@gmail.com", role: "User" },
];

/* ============================
  BACKEND API INTEGRATION (COMMENTED)
  When ready, uncomment and replace the in-memory logic.
============================ */
/*
const API_BASE = "/api/auth";

export async function loginApi(email: string, password: string) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return (await res.json()) as AppUser;
}

export async function logoutApi() {
  await fetch(`${API_BASE}/logout`, { method: "POST" });
}
*/

/* ============================
  IN-MEMORY LOGIN (DEV)
============================ */

export function loginLocal(email: string) {
  const found = demoUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!found) throw new Error("User not found");
  // set global store
  useUserStore.getState().setUser(found);
  return found;
}

export function logoutLocal() {
  useUserStore.getState().clearUser();
}
