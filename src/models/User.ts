// src/models/User.ts
export type UserRole =
  | "Admin"
  | "ProjectDirector"
  | "SecurityHead"
  | "ReleaseEngineer"
  | "User";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
