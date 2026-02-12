import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inscriptions from "./pages/Inscriptions";
import Familles from "./pages/Familles";
import Eleves from "./pages/Eleves";
import Notes from "./pages/Notes";
import Bulletins from "./pages/Bulletins";
import Orientation from "./pages/Orientation";
import Paiements from "./pages/Paiements";
import Depenses from "./pages/Depenses";
import Finances from "./pages/Finances";
import Cantine from "./pages/Cantine";
import Transport from "./pages/Transport";
import Bibliotheque from "./pages/Bibliotheque";
import Notifications from "./pages/Notifications";
import Reinscription from "./pages/Reinscription";
import Configuration from "./pages/Configuration";
import NotFound from "./pages/NotFound";
import ElevePublic from "./pages/ElevePublic";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/eleve/:matricule" element={<ElevePublic />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inscriptions" element={<ProtectedRoute><Inscriptions /></ProtectedRoute>} />
            <Route path="/familles" element={<ProtectedRoute><Familles /></ProtectedRoute>} />
            <Route path="/eleves" element={<ProtectedRoute><Eleves /></ProtectedRoute>} />
            <Route path="/reinscription" element={<ProtectedRoute><Reinscription /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
            <Route path="/bulletins" element={<ProtectedRoute><Bulletins /></ProtectedRoute>} />
            <Route path="/orientation" element={<ProtectedRoute><Orientation /></ProtectedRoute>} />
            <Route path="/paiements" element={<ProtectedRoute><Paiements /></ProtectedRoute>} />
            <Route path="/depenses" element={<ProtectedRoute><Depenses /></ProtectedRoute>} />
            <Route path="/finances" element={<ProtectedRoute><Finances /></ProtectedRoute>} />
            <Route path="/cantine" element={<ProtectedRoute><Cantine /></ProtectedRoute>} />
            <Route path="/transport" element={<ProtectedRoute><Transport /></ProtectedRoute>} />
            <Route path="/bibliotheque" element={<ProtectedRoute><Bibliotheque /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/configuration" element={<ProtectedRoute><Configuration /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
