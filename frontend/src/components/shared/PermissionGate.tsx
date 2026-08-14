import { ReactNode } from "react";
import { useAuthStore } from "@/lib/authStore";

interface PermissionGateProps {
  resource: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ resource, action, children, fallback = null }: PermissionGateProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (!hasPermission(resource, action)) return <>{fallback}</>;
  return <>{children}</>;
}
