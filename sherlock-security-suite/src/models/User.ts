// src/models/User.ts
export type Role =
  | "Admin"
  | "ProjectDirector"
  | "SecurityTechHead"
  | "ReleaseEngineer"
  | "User";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
