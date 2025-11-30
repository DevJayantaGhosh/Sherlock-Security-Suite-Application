// src/store/userStore.ts
import { create } from "zustand";
import { AppUser } from "../models/User";

interface UserState {
  user: AppUser | null;
  setUser: (u: AppUser | null) => void;
  clearUser: () => void;
  isRole: (role: string) => boolean;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  setUser: (u) => set({ user: u }),
  clearUser: () => set({ user: null }),
  isRole: (role) => {
    const cur = get().user;
    return !!cur && cur.role === role;
  },
}));
