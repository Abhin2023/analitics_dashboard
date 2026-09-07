import { lazy, Suspense } from "react";
import { useAuthStore } from "@/lib/authStore";
import { TableSkeleton } from "@/components/shared/Skeleton";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const TeamLeaderDashboard = lazy(() => import("@/pages/TeamLeaderDashboard"));
const TelecallerDashboard = lazy(() => import("@/pages/TelecallerDashboard"));

const ADMIN_ROLES = ["SuperAdmin", "Admin", "CEO", "COO", "Regional Manager"];

export default function RoleDashboard() {
  const role = useAuthStore((s) => s.user?.role_name);

  return (
    <Suspense fallback={<div className="p-6"><TableSkeleton /></div>}>
      {role === "Telecaller" && <TelecallerDashboard />}
      {role === "Team Leader" && <TeamLeaderDashboard />}
      {ADMIN_ROLES.includes(role || "") && <Dashboard />}
      {!role && <Dashboard />}
    </Suspense>
  );
}
