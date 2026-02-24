import axios, { AxiosError } from "axios";
import { 
  AppUser, StoreUser, UserRole,
  AuthRequest, RegisterRequest, ForgotPasswordRequest, VerifyOtpRequest, 
  ResetPasswordRequest, LoginResponse, UpdateUserRequest,
} from "../models/User";
import { useUserStore } from "../store/userStore";
import { API_URLS } from "../config/userManagementApiUrls";

export interface ApiError {
  message: string;
  code?: string;
  field?: string;
  status?: number;
}

const USE_BACKEND = false;
const api = axios.create({
  baseURL: API_URLS.BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// JWT Interceptor
api.interceptors.request.use((config) => {
  if (USE_BACKEND) {
    const token = useUserStore.getState().getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 Auto-logout
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) useUserStore.getState().clearUser();
    return Promise.reject(error);
  }
);

const createApiError = (error: AxiosError, defaultMessage: string): ApiError => {
  let message = defaultMessage;
  if (error.response?.data) message = (error.response.data as any).message || defaultMessage;
  else if (error.code === "ECONNABORTED") message = "Request timeout.";
  else if (!navigator.onLine) message = "No internet connection.";
  else message = error.message || defaultMessage;
  return { message, code: (error.response?.data as any)?.code, status: error.response?.status, field: (error.response?.data as any)?.field };
};

// ===================== IN-MEMORY DATA =====================
let demoUsers: AppUser[] = [
  {
    id: "u1",
    name: "Admin",
    email: "admin@gmail.com",
    role: "Admin",
    isInternal: true,
    createdAt: new Date().toISOString().split('T')[0],
  },
  {
    id: "u2",
    name: "Director",
    email: "director@gmail.com",
    role: "ProjectDirector",
    isInternal: true,
    createdAt: new Date().toISOString().split('T')[0],
  },
  {
    id: "u3",
    name: "SecHead",
    email: "security@gmail.com",
    role: "SecurityHead",
    isInternal: true,
    createdAt: new Date().toISOString().split('T')[0],
  },
  {
    id: "u4",
    name: "Eng",
    email: "engineer@gmail.com",
    role: "ReleaseEngineer",
    isInternal: true,
    createdAt: new Date().toISOString().split('T')[0],
  },
  {
    id: "u5",
    name: "Normal",
    email: "user@gmail.com",
    role: "User",
    createdAt: new Date().toISOString().split('T')[0],
  },
  {
    id: "u6",
    name: "Paid User",
    email: "paiduser@gmail.com",
    role: "User",
    licenseActivatedBy: "u1",
    licenseActivatedOn: "2026-01-21",
    licenseExpiredOn: "2027-01-21",
    createdAt: new Date().toISOString().split('T')[0],
  },
];

//  UTILITIES
export function isLicenseValid(user: AppUser): boolean {
  if (user.isInternal || user.role === "Admin") return true;
  if (!user.licenseExpiredOn) return false;
  return new Date(user.licenseExpiredOn) > new Date();
}

export function getLicenseDaysRemaining(user: AppUser): number {
  if (!user.licenseExpiredOn) return 0;
  const expiry = new Date(user.licenseExpiredOn);
  const diffTime = expiry.getTime() - new Date().getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ===================== AUTHENTICATION =====================
export async function login(email: string, password: string): Promise<{ data: { user: AppUser; licenseValid: boolean }; error: ApiError | null }> {
  if (!USE_BACKEND) {
    const found = demoUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!found) {
      return { data: {} as any, error: { message: "Invalid email or password" } };
    }
    const licenseValid = isLicenseValid(found);
    useUserStore.getState().setUser({ ...found, licenseValid, token: "demo-jwt-token" } as StoreUser);
    return { data: { user: found, licenseValid }, error: null };
  }

  try {
    const request: AuthRequest = { email, password };
    const { data } = await api.post<LoginResponse>(API_URLS.AUTH.LOGIN, request);
    const licenseValid = isLicenseValid(data.user);
    useUserStore.getState().setUser({ ...data.user, licenseValid, token: data.token } as StoreUser);
    return { data: { user: data.user, licenseValid }, error: null };
  } catch (error) {
    return { data: {} as any, error: createApiError(error as AxiosError, "Invalid email or password") };
  }
}

export async function register(name: string, email: string, password: string): Promise<{ data: AppUser; error: ApiError | null }> {
  if (!USE_BACKEND) {
    if (demoUsers.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { data: {} as AppUser, error: { message: "Email already exists" } };
    }
    const user: AppUser = {
      id: crypto.randomUUID(),
      name,
      email,
      role: "User" as UserRole,
      createdAt: new Date().toISOString().split('T')[0],
    };
    demoUsers.push(user);
    return { data: user, error: null };
  }

  try {
    const request: RegisterRequest = { name, email, password };
    const { data } = await api.post<AppUser>(API_URLS.AUTH.REGISTER, request);
    return { data, error: null };
  } catch (error) {
    return { data: {} as AppUser, error: createApiError(error as AxiosError, "Registration failed") };
  }
}

export async function logout(): Promise<{ error: ApiError | null }> {
  if (USE_BACKEND) {
    try {
      await api.post(API_URLS.AUTH.LOGOUT);
    } catch (error) {
      console.warn("Logout API failed:", error);
    }
  }
  useUserStore.getState().clearUser();
  return { error: null };
}

export async function forgotPassword(email: string): Promise<{ data: { message: string }; error: ApiError | null }> {
  if (!USE_BACKEND) {
    console.log(`Demo: OTP sent to ${email}`);
    return { data: { message: "OTP sent to your email!" }, error: null };
  }

  try {
    const request: ForgotPasswordRequest = { email };
    const { data } = await api.post<{ message: string }>(API_URLS.AUTH.FORGOT_PASSWORD, request);
    return { data, error: null };
  } catch (error) {
    return { data: { message: "" }, error: createApiError(error as AxiosError, "Failed to send OTP") };
  }
}

export async function verifyOtp(email: string, otp: string): Promise<{ data: { otpValid: boolean }; error: ApiError | null }> {
  if (!USE_BACKEND) {
    const isValid = /^\d{6}$/.test(otp);
    return { data: { otpValid: isValid }, error: isValid ? null : { message: "Invalid OTP" } };
  }

  try {
    const request: VerifyOtpRequest = { email, otp };
    const { data } = await api.post<{ otpValid: boolean }>(API_URLS.AUTH.VERIFY_OTP, request);
    return { data, error: null };
  } catch (error) {
    return { data: { otpValid: false }, error: createApiError(error as AxiosError, "Invalid OTP") };
  }
}

export async function resetPassword(email: string, newPassword: string): Promise<{ data: { message: string }; error: ApiError | null }> {
  if (!USE_BACKEND) {
    console.log(`Demo: Password reset for ${email}`);
    return { data: { message: "Password reset successfully!" }, error: null };
  }

  try {
    const request: ResetPasswordRequest = { email, newPassword };
    const { data } = await api.post<{ message: string }>(API_URLS.AUTH.RESET_PASSWORD, request);
    return { data, error: null };
  } catch (error) {
    return { data: { message: "" }, error: createApiError(error as AxiosError, "Failed to reset password") };
  }
}

// ===================== USER MANAGEMENT =====================
export async function getUsers(): Promise<{ data: AppUser[]; error: ApiError | null }> {
  if (!USE_BACKEND) {
    return { data: demoUsers.map(user => ({ ...user, licenseValid: isLicenseValid(user) })), error: null };
  }
  try {
    const { data } = await api.get<AppUser[]>(API_URLS.USERS.LIST);
    return { data, error: null };
  } catch (error) {
    return { data: [], error: createApiError(error as AxiosError, "Failed to fetch users") };
  }
}

export async function getInternalUsers(): Promise<{ data: AppUser[]; error: ApiError | null }> {
  if (!USE_BACKEND) {
    const internalUsers = demoUsers.filter((user) => user.isInternal === true).map(user => ({ ...user, licenseValid: isLicenseValid(user) }));
    return { data: internalUsers, error: null };
  }
  try {
    const { data } = await api.get<AppUser[]>(API_URLS.USERS.LIST_INTERNAL);
    return { data, error: null };
  } catch (error) {
    return { data: [], error: createApiError(error as AxiosError, "Failed to fetch internal users") };
  }
}

//  SINGLE UPDATE
export async function updateUser(userId: string, updates: Partial<UpdateUserRequest>): Promise<{ data: AppUser; error: ApiError | null }> {
  if (!USE_BACKEND) {
    const index = demoUsers.findIndex((u) => u.id === userId);
    if (index === -1) {
      return { data: {} as AppUser, error: { message: "User not found" } };
    }

    const currentUser = demoUsers[index];
    demoUsers[index] = {
      ...currentUser,
      name: updates.name || currentUser.name,
      role: updates.role || currentUser.role,
      isInternal: updates.isInternal ?? currentUser.isInternal ?? false,
      licenseActivatedBy: updates.licenseActivatedBy || currentUser.licenseActivatedBy,
      licenseActivatedOn: updates.licenseActivatedOn || currentUser.licenseActivatedOn,
      licenseExpiredOn: updates.licenseExpiredOn || currentUser.licenseExpiredOn,
      lastModifiedAt: new Date().toISOString().split('T')[0],
      modifiedBy: updates.modifiedBy || useUserStore.getState().user?.id || "admin",
    };
    return { data: { ...demoUsers[index], licenseValid: isLicenseValid(demoUsers[index]) }, error: null };
  }

  try {
    const request: UpdateUserRequest = {
      name: updates.name!,
      role: updates.role!,
      isInternal: updates.isInternal,
      licenseActivatedBy: updates.licenseActivatedBy,
      licenseActivatedOn: updates.licenseActivatedOn,
      licenseExpiredOn: updates.licenseExpiredOn,
      modifiedBy: updates.modifiedBy,
    };
    const { data } = await api.put<AppUser>(API_URLS.USERS.UPDATE(userId), request);
    return { data, error: null };
  } catch (error) {
    return { data: {} as AppUser, error: createApiError(error as AxiosError, "Failed to update user") };
  }
}

// DELETE SINGLE
export async function deleteUser(userId: string): Promise<{ success: boolean; error: ApiError | null }> {
  if (!USE_BACKEND) {
    const index = demoUsers.findIndex((u) => u.id === userId);
    if (index === -1) {
      return { success: false, error: { message: "User not found" } };
    }
    demoUsers = demoUsers.filter((u) => u.id !== userId);
    return { success: true, error: null };
  }

  try {
    await api.delete(API_URLS.USERS.DELETE(userId));
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: createApiError(error as AxiosError, "Failed to delete user") };
  }
}

//  BULK DELETE
export async function deleteUsers(userIds: string[]): Promise<{ success: boolean; error: ApiError | null }> {
  if (!USE_BACKEND) {
    const initialCount = demoUsers.length;
    demoUsers = demoUsers.filter((u) => !userIds.includes(u.id));
    console.log(`Demo: Deleted ${initialCount - demoUsers.length}/${userIds.length} users`);
    return { success: true, error: null };
  }

  try {
    await api.delete(API_URLS.USERS.BULK_DELETE, { data: userIds });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: createApiError(error as AxiosError, "Failed to delete users") };
  }
}

// AUTH CHECK
export function isAuthenticated(): boolean {
  return !!useUserStore.getState().getToken();
}
