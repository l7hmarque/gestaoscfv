import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import BancoDadosPage from "./pages/banco-dados/BancoDadosPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import ProfissionalPerfilPage from "./pages/profissional/ProfissionalPerfilPage";
import DevPage from "./pages/dev/DevPage";
import MatriculaPublicaPage from "./pages/matricula/MatriculaPublicaPage";
import MuralPage from "./pages/mural/MuralPage";
import FeedPage from "./pages/feed/FeedPage";
import EquipeTecnicaPage from "./pages/equipe-tecnica/EquipeTecnicaPage";
import FinanceiroPage from "./pages/financeiro/FinanceiroPage";
import SiteLayout from "./components/SiteLayout";
import SiteHomePage from "./pages/site/SiteHomePage";
import SiteIndicadoresPage from "./pages/site/SiteIndicadoresPage";
import SiteNoticiasPage from "./pages/site/SiteNoticiasPage";
import SiteConteudosPage from "./pages/site/SiteConteudosPage";
import SiteContatoPage from "./pages/site/SiteContatoPage";
import SiteAdminPage from "./pages/site-admin/SiteAdminPage";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              {/* Site público */}
              <Route path="/site" element={<SiteLayout />}>
                <Route index element={<SiteHomePage />} />
                <Route path="indicadores" element={<SiteIndicadoresPage />} />
                <Route path="noticias" element={<SiteNoticiasPage />} />
                <Route path="conteudos" element={<SiteConteudosPage />} />
                <Route path="contato" element={<SiteContatoPage />} />
              </Route>
              {/* Sistema interno */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/banco-de-dados" element={<BancoDadosPage />} />
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
                <Route path="/profissional/:id" element={<ProfissionalPerfilPage />} />
                <Route path="/mural" element={<MuralPage />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/equipe-tecnica" element={<EquipeTecnicaPage />} />
                <Route path="/financeiro" element={<FinanceiroPage />} />
                <Route path="/site-admin" element={<SiteAdminPage />} />
              </Route>
              <Route path="/dev" element={<DevPage />} />
              <Route path="/matricula" element={<MatriculaPublicaPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
