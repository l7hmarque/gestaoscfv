import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/AppLayout";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const ParticipantesPage = lazy(() => import("./pages/participantes/ParticipantesPage"));
const ParticipanteNovoPage = lazy(() => import("./pages/participantes/ParticipanteNovoPage"));
const ParticipanteImportarPage = lazy(() => import("./pages/participantes/ParticipanteImportarPage"));
const ParticipantePerfilPage = lazy(() => import("./pages/participantes/ParticipantePerfilPage"));
const TurmasPage = lazy(() => import("./pages/turmas/TurmasPage"));
const TurmaNovaPage = lazy(() => import("./pages/turmas/TurmaNovaPage"));
const TurmaDetalhePage = lazy(() => import("./pages/turmas/TurmaDetalhePage"));
const PresencaPage = lazy(() => import("./pages/presenca/PresencaPage"));
const PresencaExportarPage = lazy(() => import("./pages/presenca/PresencaExportarPage"));
const PlanejamentosPage = lazy(() => import("./pages/planejamentos/PlanejamentosPage"));
const PlanejamentoNovoPage = lazy(() => import("./pages/planejamentos/PlanejamentoNovoPage"));
const PlanejamentoDetalhePage = lazy(() => import("./pages/planejamentos/PlanejamentoDetalhePage"));
const RelatoriosPage = lazy(() => import("./pages/relatorios/RelatoriosPage"));
const RelatorioNovoPage = lazy(() => import("./pages/relatorios/RelatorioNovoPage"));
const RelatorioDetalhePage = lazy(() => import("./pages/relatorios/RelatorioDetalhePage"));
const ExportarRelatoriosPage = lazy(() => import("./pages/relatorios/ExportarRelatoriosPage"));
const BancoDadosPage = lazy(() => import("./pages/banco-dados/BancoDadosPage"));
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const ProfissionalPerfilPage = lazy(() => import("./pages/profissional/ProfissionalPerfilPage"));
const DevPage = lazy(() => import("./pages/dev/DevPage"));
const MatriculaPublicaPage = lazy(() => import("./pages/matricula/MatriculaPublicaPage"));
const PainelDesligamentoPage = lazy(() => import("./pages/participantes/PainelDesligamentoPage"));
const FamiliaLoginPage = lazy(() => import("./pages/familia/FamiliaLoginPage"));
const FamiliaDashboardPage = lazy(() => import("./pages/familia/FamiliaDashboardPage"));
const FormularioRespostaPage = lazy(() => import("./pages/familia/FormularioRespostaPage"));
const FeedPage = lazy(() => import("./pages/feed/FeedPage"));
const EquipeTecnicaPage = lazy(() => import("./pages/equipe-tecnica/EquipeTecnicaPage"));
const RoteiroNovoPage = lazy(() => import("./pages/equipe-tecnica/roteiros/RoteiroNovoPage"));
const RoteiroDetalhePage = lazy(() => import("./pages/equipe-tecnica/roteiros/RoteiroDetalhePage"));
const FinanceiroPage = lazy(() => import("./pages/financeiro/FinanceiroPage"));
const ArquivosFinanceirosPage = lazy(() => import("./pages/financeiro/ArquivosFinanceirosPage"));
const SiteLayout = lazy(() => import("./components/SiteLayout"));
const SiteHomePage = lazy(() => import("./pages/site/SiteHomePage"));
const SiteIndicadoresPage = lazy(() => import("./pages/site/SiteIndicadoresPage"));
const SiteNoticiasPage = lazy(() => import("./pages/site/SiteNoticiasPage"));
const SiteConteudosPage = lazy(() => import("./pages/site/SiteConteudosPage"));
const SiteContatoPage = lazy(() => import("./pages/site/SiteContatoPage"));
const SiteAdminPage = lazy(() => import("./pages/site-admin/SiteAdminPage"));
const ConfiguracoesPage = lazy(() => import("./pages/configuracoes/ConfiguracoesPage"));
const MuralPage = lazy(() => import("./pages/mural/MuralPage"));
const CronogramaPage = lazy(() => import("./pages/cronograma/CronogramaPage"));
const DesignPreviewPage = lazy(() => import("./pages/preview/DesignPreviewPage"));
const IntegridadePage = lazy(() => import("./pages/integridade/IntegridadePage"));
const CoordenacaoPage = lazy(() => import("./pages/coordenacao/CoordenacaoPage"));
const CozinhaPage = lazy(() => import("./pages/cozinha/CozinhaPage"));
const TransportePage = lazy(() => import("./pages/transporte/TransportePage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
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
                  <Route path="/presenca/exportar" element={<PresencaExportarPage />} />
                  <Route path="/planejamentos" element={<PlanejamentosPage />} />
                  <Route path="/planejamentos/novo" element={<PlanejamentoNovoPage />} />
                  <Route path="/planejamentos/:id" element={<PlanejamentoDetalhePage />} />
                  <Route path="/relatorios" element={<RelatoriosPage />} />
                  <Route path="/relatorios/novo" element={<RelatorioNovoPage />} />
                  <Route path="/relatorios/:id" element={<RelatorioDetalhePage />} />
                  <Route path="/relatorios/exportar" element={<ExportarRelatoriosPage />} />
                  <Route path="/profissional/:id" element={<ProfissionalPerfilPage />} />
                  <Route path="/mural" element={<MuralPage />} />
                  <Route path="/feed" element={<FeedPage />} />
                  <Route path="/equipe-tecnica" element={<EquipeTecnicaPage />} />
                  <Route path="/equipe-tecnica/roteiros/novo" element={<RoteiroNovoPage />} />
                  <Route path="/equipe-tecnica/roteiros/:id" element={<RoteiroDetalhePage />} />
                  <Route path="/financeiro" element={<FinanceiroPage />} />
                  <Route path="/financeiro/arquivos" element={<ArquivosFinanceirosPage />} />
                  <Route path="/site-admin" element={<SiteAdminPage />} />
                  <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                  <Route path="/desligamento-admin" element={<PainelDesligamentoPage />} />
                  <Route path="/cronograma" element={<CronogramaPage />} />
                  <Route path="/preview-design" element={<DesignPreviewPage />} />
                  <Route path="/integridade" element={<IntegridadePage />} />
                  <Route path="/coordenacao" element={<CoordenacaoPage />} />
                  <Route path="/cozinha" element={<CozinhaPage />} />
                  <Route path="/transporte" element={<TransportePage />} />
                  <Route path="/dev" element={<DevPage />} />
                </Route>
                <Route path="/matricula" element={<MatriculaPublicaPage />} />
                <Route path="/familia" element={<FamiliaLoginPage />} />
                <Route path="/familia/painel" element={<FamiliaDashboardPage />} />
                <Route path="/familia/formulario/:id" element={<FormularioRespostaPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
