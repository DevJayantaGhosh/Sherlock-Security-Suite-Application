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
  licenseActivatedBy?: string;
  licenseActivatedOn?: string;
  licenseExpiredOn?: string;
  isInternal?: boolean;
  createdAt: string;
  lastModifiedAt?: string;
  modifiedBy?: string;
  licenseValid?: boolean;
}


export type UserWithLicense = AppUser & { licenseValid: boolean };

export interface StoreUser extends UserWithLicense {
  token: string;
}

//  AUTH DTOs
export interface AuthRequest { email: string; password: string; }
export interface RegisterRequest { name: string; email: string; password: string; }
export interface ForgotPasswordRequest { email: string; }
export interface VerifyOtpRequest { email: string; otp: string; }
export interface ResetPasswordRequest { email: string; newPassword: string; }
export interface LoginResponse { token: string; user: AppUser; }

// Update DTO 
export interface UpdateUserRequest {
  name: string;
  role: UserRole;
  isInternal?: boolean;
  licenseActivatedBy?: string;
  licenseActivatedOn?: string;
  licenseExpiredOn?: string;
  modifiedBy?: string;
}


