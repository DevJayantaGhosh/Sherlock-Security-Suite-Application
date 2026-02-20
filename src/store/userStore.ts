import { create } from "zustand";
import { AppUser } from "../models/User";

interface UserState {
  user: (AppUser & { licenseValid?: boolean; token?: string }) | null;
  setUser: (u: AppUser & { licenseValid?: boolean; token?: string } | null) => void;
  clearUser: () => void;
  isRole: (role: string) => boolean;
  isLicenseValid: boolean;
  getToken: () => string | null;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  setUser: (u) => set({ 
    user: u, 
    isLicenseValid: !!(u?.licenseValid) 
  }),
  clearUser: () => set({ user: null, isLicenseValid: false }),
  isRole: (role) => {
    const cur = get().user;
    return !!cur && cur.role === role; 
  },
  isLicenseValid: false,
  getToken: () => get().user?.token || null, 
}));
