import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/AppLayout";
import { ModuleRoute } from "@/components/ModuleRoute";

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
const TurmasForaFaixaPage = lazy(() => import("./pages/turmas/TurmasForaFaixaPage"));
const PresencaPage = lazy(() => import("./pages/presenca/PresencaPage"));
const PlanejamentosPage = lazy(() => import("./pages/planejamentos/PlanejamentosPage"));
const PlanejamentoNovoPage = lazy(() => import("./pages/planejamentos/PlanejamentoNovoPage"));
const PlanejamentoDetalhePage = lazy(() => import("./pages/planejamentos/PlanejamentoDetalhePage"));
const RelatoriosPage = lazy(() => import("./pages/relatorios/RelatoriosPage"));
const RelatorioNovoPage = lazy(() => import("./pages/relatorios/RelatorioNovoPage"));
const RelatorioDetalhePage = lazy(() => import("./pages/relatorios/RelatorioDetalhePage"));
const DocumentosPage = lazy(() => import("./pages/documentos/DocumentosPage"));
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
const SiteLayout = lazy(() => import("./components/SiteLayout"));
const SiteHomePage = lazy(() => import("./pages/site/SiteHomePage"));
const SiteIndicadoresPage = lazy(() => import("./pages/site/SiteIndicadoresPage"));
const SiteNoticiasPage = lazy(() => import("./pages/site/SiteNoticiasPage"));
const SiteConteudosPage = lazy(() => import("./pages/site/SiteConteudosPage"));
const SiteContatoPage = lazy(() => import("./pages/site/SiteContatoPage"));
const SiteAdminPage = lazy(() => import("./pages/site-admin/SiteAdminPage"));
const ConfiguracoesPage = lazy(() => import("./pages/configuracoes/ConfiguracoesPage"));
const CronogramaPage = lazy(() => import("./pages/cronograma/CronogramaPage"));
const IntegridadePage = lazy(() => import("./pages/integridade/IntegridadePage"));
const CoordenacaoPage = lazy(() => import("./pages/coordenacao/CoordenacaoPage"));
const AuditoriaPresencasPage = lazy(() => import("./pages/coordenacao/AuditoriaPresencasPage"));
const AuditoriaDatasPage = lazy(() => import("./pages/coordenacao/AuditoriaDatasPage"));
const CozinhaPage = lazy(() => import("./pages/cozinha/CozinhaPage"));
const TransportePage = lazy(() => import("./pages/transporte/TransportePage"));
const RegistrosFotograficosPage = lazy(() => import("./pages/registros-fotograficos/RegistrosFotograficosPage"));

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
                  <Route path="/dashboard" element={<ModuleRoute module="dashboard"><DashboardPage /></ModuleRoute>} />
                  <Route path="/banco-de-dados" element={<ModuleRoute module="banco_dados" level="admin"><BancoDadosPage /></ModuleRoute>} />
                  <Route path="/participantes" element={<ModuleRoute module="participantes"><ParticipantesPage /></ModuleRoute>} />
                  <Route path="/participantes/novo" element={<ModuleRoute module="participantes" level="write"><ParticipanteNovoPage /></ModuleRoute>} />
                  <Route path="/participantes/importar" element={<ModuleRoute module="participantes" level="admin"><ParticipanteImportarPage /></ModuleRoute>} />
                  <Route path="/participantes/:id" element={<ModuleRoute module="participantes"><ParticipantePerfilPage /></ModuleRoute>} />
                  <Route path="/turmas" element={<ModuleRoute module="turmas"><TurmasPage /></ModuleRoute>} />
                  <Route path="/turmas/nova" element={<ModuleRoute module="turmas" level="write"><TurmaNovaPage /></ModuleRoute>} />
                  <Route path="/turmas/fora-faixa" element={<ModuleRoute module="turmas" level="write"><TurmasForaFaixaPage /></ModuleRoute>} />
                  <Route path="/turmas/:id" element={<ModuleRoute module="turmas"><TurmaDetalhePage /></ModuleRoute>} />
                  <Route path="/presenca" element={<ModuleRoute module="presenca"><PresencaPage /></ModuleRoute>} />
                  <Route path="/presenca/exportar" element={<Navigate to="/documentos?tab=presenca" replace />} />
                  <Route path="/planejamentos" element={<ModuleRoute module="planejamentos"><PlanejamentosPage /></ModuleRoute>} />
                  <Route path="/planejamentos/novo" element={<ModuleRoute module="planejamentos" level="write"><PlanejamentoNovoPage /></ModuleRoute>} />
                  <Route path="/planejamentos/:id" element={<ModuleRoute module="planejamentos"><PlanejamentoDetalhePage /></ModuleRoute>} />
                  <Route path="/relatorios" element={<ModuleRoute module="relatorios"><RelatoriosPage /></ModuleRoute>} />
                  <Route path="/relatorios/novo" element={<ModuleRoute module="relatorios" level="write"><RelatorioNovoPage /></ModuleRoute>} />
                  <Route path="/relatorios/:id" element={<ModuleRoute module="relatorios"><RelatorioDetalhePage /></ModuleRoute>} />
                  <Route path="/relatorios/exportar" element={<Navigate to="/documentos?tab=atividades" replace />} />
                  <Route path="/relatorios/hub" element={<Navigate to="/documentos" replace />} />
                  <Route path="/documentos" element={<ModuleRoute module="relatorios"><DocumentosPage /></ModuleRoute>} />
                  <Route path="/profissional/:id" element={<ProfissionalPerfilPage />} />
                  <Route path="/mural" element={<Navigate to="/feed" replace />} />
                  <Route path="/feed" element={<ModuleRoute module="feed"><FeedPage /></ModuleRoute>} />
                  <Route path="/equipe-tecnica" element={<ModuleRoute module="equipe_tecnica"><EquipeTecnicaPage /></ModuleRoute>} />
                  <Route path="/equipe-tecnica/roteiros/novo" element={<ModuleRoute module="equipe_tecnica" level="write"><RoteiroNovoPage /></ModuleRoute>} />
                  <Route path="/equipe-tecnica/roteiros/:id" element={<ModuleRoute module="equipe_tecnica"><RoteiroDetalhePage /></ModuleRoute>} />
                  <Route path="/site-admin" element={<ModuleRoute module="site_publico" level="admin"><SiteAdminPage /></ModuleRoute>} />
                  <Route path="/configuracoes" element={<ModuleRoute module="configuracoes" level="admin"><ConfiguracoesPage /></ModuleRoute>} />
                  <Route path="/desligamento-admin" element={<ModuleRoute module="coordenacao" level="admin"><PainelDesligamentoPage /></ModuleRoute>} />
                  <Route path="/cronograma" element={<ModuleRoute module="cronograma"><CronogramaPage /></ModuleRoute>} />
                  <Route path="/integridade" element={<ModuleRoute module="integridade"><IntegridadePage /></ModuleRoute>} />
                  <Route path="/coordenacao" element={<ModuleRoute module="coordenacao" level="admin"><CoordenacaoPage /></ModuleRoute>} />
                  <Route path="/coordenacao/auditoria-presencas" element={<ModuleRoute module="coordenacao" level="admin"><AuditoriaPresencasPage /></ModuleRoute>} />
                  <Route path="/coordenacao/auditoria-datas" element={<ModuleRoute module="coordenacao" level="admin"><AuditoriaDatasPage /></ModuleRoute>} />
                  <Route path="/cozinha" element={<ModuleRoute module="cozinha"><CozinhaPage /></ModuleRoute>} />
                  <Route path="/transporte" element={<ModuleRoute module="transporte"><TransportePage /></ModuleRoute>} />
                  <Route path="/registros-fotograficos" element={<ModuleRoute module="registros_fotograficos"><RegistrosFotograficosPage /></ModuleRoute>} />
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
