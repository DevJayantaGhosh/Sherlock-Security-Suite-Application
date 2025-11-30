// src/services/userService.ts
import { AppUser, UserRole } from "../models/User";
import { useUserStore } from "../store/userStore";

/**
 * ---------------------------
 * IN-MEMORY USER DATABASE
 * ---------------------------
 */

let demoUsers: AppUser[] = [
  { id: "u1", name: "Admin", email: "admin@gmail.com", role: "Admin" },
  { id: "u2", name: "Director", email: "director@gmail.com", role: "ProjectDirector" },
  { id: "u3", name: "SecHead", email: "security@gmail.com", role: "SecurityHead" },
  { id: "u4", name: "Eng", email: "engineer@gmail.com", role: "ReleaseEngineer" },
  { id: "u5", name: "Normal", email: "user@gmail.com", role: "User" },
];

/* ======================================================
   BACKEND API (COMMENTED FOR FUTURE REAL INTEGRATION)
========================================================

const API="/api/users";

export async function apiGetUsers() {
  return fetch(API).then(r=>r.json());
}

export async function apiCreateUser(payload) {
  return fetch(API,{
     method:"POST",
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify(payload)
  }).then(r=>r.json());
}

export async function apiUpdateUser(id,payload) {
  return fetch(`${API}/${id}`,{
     method:"PUT",
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify(payload)
  }).then(r=>r.json());
}

export async function apiDeleteUser(id){
  return fetch(`${API}/${id}`,{method:'DELETE'});
}

====================================================== */

/**
 * ---------------------------
 * LOCAL (IN-MEMORY) CRUD
 * ---------------------------
 */

export function getUsers(): AppUser[] {
  return [...demoUsers];
}

export function createUser(
  name: string,
  email: string,
  role: UserRole
): AppUser {
  if (demoUsers.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("User already exists");
  }

  const user: AppUser = {
    id: crypto.randomUUID(),
    name,
    email,
    role,
  };

  demoUsers.push(user);
  return user;
}

export function updateUser(id: string, patch: Partial<AppUser>) {
  const index = demoUsers.findIndex(u => u.id === id);
  if (index === -1) throw new Error("User not found");

  demoUsers[index] = {
    ...demoUsers[index],
    ...patch,
  };

  return demoUsers[index];
}

export function deleteUser(id: string) {
  demoUsers = demoUsers.filter(u => u.id !== id);
}

/**
 * ---------------------------
 * AUTH
 * ---------------------------
 */

export function loginLocal(email: string) {
  const found = demoUsers.find(
    u => u.email.toLowerCase() === email.toLowerCase()
  );

  if (!found) throw new Error("User not found");

  useUserStore.getState().setUser(found);
  return found;
}

export function logoutLocal() {
  useUserStore.getState().clearUser();
}
