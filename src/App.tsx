import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/auth/LoginPage";
import ParticipantesPage from "./pages/participantes/ParticipantesPage";
import ParticipanteNovoPage from "./pages/participantes/ParticipanteNovoPage";
import ParticipanteImportarPage from "./pages/participantes/ParticipanteImportarPage";
import ParticipantePerfilPage from "./pages/participantes/ParticipantePerfilPage";
import TurmasPage from "./pages/turmas/TurmasPage";
import TurmaNovaPage from "./pages/turmas/TurmaNovaPage";
import TurmaDetalhePage from "./pages/turmas/TurmaDetalhePage";
import PresencaPage from "./pages/presenca/PresencaPage";
import PresencaHistoricoPage from "./pages/presenca/PresencaHistoricoPage";
import PresencaExportarPage from "./pages/presenca/PresencaExportarPage";
import PlanejamentosPage from "./pages/planejamentos/PlanejamentosPage";
import PlanejamentoNovoPage from "./pages/planejamentos/PlanejamentoNovoPage";
import PlanejamentoDetalhePage from "./pages/planejamentos/PlanejamentoDetalhePage";
import RelatoriosPage from "./pages/relatorios/RelatoriosPage";
import RelatorioNovoPage from "./pages/relatorios/RelatorioNovoPage";
import RelatorioDetalhePage from "./pages/relatorios/RelatorioDetalhePage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Index />} />
              <Route path="/participantes" element={<ParticipantesPage />} />
              <Route path="/participantes/novo" element={<ParticipanteNovoPage />} />
              <Route path="/participantes/importar" element={<ParticipanteImportarPage />} />
              <Route path="/participantes/:id" element={<ParticipantePerfilPage />} />
              <Route path="/turmas" element={<TurmasPage />} />
              <Route path="/turmas/nova" element={<TurmaNovaPage />} />
              <Route path="/turmas/:id" element={<TurmaDetalhePage />} />
              <Route path="/presenca" element={<PresencaPage />} />
              <Route path="/presenca/historico" element={<PresencaHistoricoPage />} />
              <Route path="/presenca/exportar" element={<PresencaExportarPage />} />
              <Route path="/planejamentos" element={<PlanejamentosPage />} />
              <Route path="/planejamentos/novo" element={<PlanejamentoNovoPage />} />
              <Route path="/planejamentos/:id" element={<PlanejamentoDetalhePage />} />
              <Route path="/relatorios" element={<RelatoriosPage />} />
              <Route path="/relatorios/novo" element={<RelatorioNovoPage />} />
              <Route path="/relatorios/:id" element={<RelatorioDetalhePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
