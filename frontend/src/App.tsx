import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { getSocket, disconnectSocket } from "./lib/socket";
import { useAuthStore } from "./lib/authStore";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import SetPassword from "./pages/SetPassword";
import Dashboard from "./pages/Dashboard";
import SalesOverview from "./pages/SalesOverview";
import Operations from "./pages/Operations";
import OperationsSubmit from "./pages/OperationsSubmit";
import TeamLeaders from "./pages/TeamLeaders";
import TeamLeaderDetail from "./pages/TeamLeaderDetail";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Campaigns from "./pages/Campaigns";
import Tasks from "./pages/Tasks";
import Performance from "./pages/Performance";
import Reports from "./pages/Reports";
import Investments from "./pages/Investments";
import RolesPermissions from "./pages/settings/RolesPermissions";
import UserManagement from "./pages/settings/Users";
import KPIWeights from "./pages/settings/KPIWeights";
import DataSync from "./pages/settings/DataSync";
import CurrencySettings from "./pages/settings/Currency";
import InstagramForms from "./pages/settings/InstagramForms";
import AIProviders from "./pages/settings/AIProviders";
import InstagramDashboard from "./pages/instagram/InstagramDashboard";
import InstagramSetup from "./pages/instagram/InstagramSetup";
import Conversations from "./pages/instagram/Conversations";
import CommentRules from "./pages/instagram/CommentRules";
import FormSubmissions from "./pages/instagram/FormSubmissions";
import HostedForm from "./pages/instagram/HostedForm";

function SocketProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    if (token) getSocket();
    return () => disconnectSocket();
  }, [token]);
  return <>{children}</>;
}

export default function App() {
  return (
    <SocketProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/set-password/:token" element={<SetPassword />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sales-overview" element={<SalesOverview />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/operations/submit" element={<OperationsSubmit />} />
          <Route path="/team-leaders" element={<TeamLeaders />} />
          <Route path="/team-leaders/:id" element={<TeamLeaderDetail />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/investments" element={<Investments />} />
          <Route path="/instagram" element={<InstagramDashboard />} />
          <Route path="/instagram/setup" element={<InstagramSetup />} />
          <Route path="/instagram/conversations" element={<Conversations />} />
          <Route path="/instagram/rules" element={<CommentRules />} />
          <Route path="/instagram/submissions" element={<FormSubmissions />} />
          <Route path="/settings/roles" element={<RolesPermissions />} />
          <Route path="/settings/users" element={<UserManagement />} />
          <Route path="/settings/kpi-weights" element={<KPIWeights />} />
          <Route path="/settings/data-sync" element={<DataSync />} />
          <Route path="/settings/currency" element={<CurrencySettings />} />
          <Route path="/settings/instagram-forms" element={<InstagramForms />} />
          <Route path="/settings/ai-providers" element={<AIProviders />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="/ig-form/:formId/:submissionId" element={<HostedForm />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </SocketProvider>
  );
}
