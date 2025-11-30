// src/auth/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useUserStore } from "../store/userStore";

interface Props {
  children: JSX.Element;
  allowedRoles?: string[]; // e.g. ["Admin"]
}

/**
 * Wrap a route element with <ProtectedRoute allowedRoles={["Admin"]}>.
 * Redirects to /login when not logged in, to / when role not allowed.
 */
export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const user = useUserStore((s) => s.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // optionally show "not authorized" page — for now redirect home
    return <Navigate to="/" replace />;
  }

  return children;
}
