export const API_URLS = {
  BASE: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api",

  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    LOGOUT: "/auth/logout",
    FORGOT_PASSWORD: "/auth/forgot-password",
    VERIFY_OTP: "/auth/verify-otp",
    RESET_PASSWORD: "/auth/reset-password",
  },

  USERS: {
    // READ - Any authenticated user
    LIST: "/users",                           // GET /api/users
    LIST_INTERNAL: "/users/internal",         // GET /api/users/internal
    
    // WRITE - Admin only
    UPDATE: (userId: string) => `/users/${userId}`,     // PUT /api/users/{id}
    DELETE: (userId: string) => `/users/${userId}`,     // DELETE /api/users/{id}
    BULK_DELETE: "/users/bulk",                         // DELETE /api/users/bulk

  },
} as const;
