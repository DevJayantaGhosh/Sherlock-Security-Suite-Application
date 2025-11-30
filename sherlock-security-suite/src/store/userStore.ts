// src/store/userStore.ts
import { create } from "zustand";
import { AppUser } from "../models/User";

interface UserState {
  user: AppUser | null;
  setUser: (u: AppUser | null) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
