import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RotateCcw, Percent, TrendingUp, ExternalLink, FolderSync, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function DashboardAdminTab() {
  const [resettingElo, setResettingElo] = useState(false);
  const [resettingFreq, setResettingFreq] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [driveResult, setDriveResult] = useState<{ url: string } | null>(null);

  const sincronizarDrive = async () => {
    setSyncingDrive(true);
    setDriveResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-drive-modelos");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao sincronizar");
      setDriveResult({ url: data.root.url });
      toast.success("Pasta institucional sincronizada no Google Drive");
    } catch (e: any) {
      toast.error("Erro ao sincronizar Drive: " + (e.message || e));
    } finally {
      setSyncingDrive(false);
    }
  };

  const resetElo = async () => {
    setResettingElo(true);
    const { error } = await supabase.from("relatorios_atividade").update({
      score_elo: null, iniciativa: null, autonomia: null,
      colaboracao: null, comunicacao: null, respeito_mutuo: null,
    } as any).neq("id", "00000000-0000-0000-0000-000000000000");
    setResettingElo(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Scores ELO resetados com sucesso");
  };

  const resetFrequencia = async () => {
    setResettingFreq(true);
    const { error } = await supabase.from("relatorios_atividade").update({
      pct_adesao: null, num_participantes: null, num_ausentes: null, num_matriculados: null,
    } as any).neq("id", "00000000-0000-0000-0000-000000000000");
    setResettingFreq(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Dados de frequência resetados com sucesso");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Administração</h2>

      {/* Aviso: gestão de modelos foi movida para Configurações; pipeline ativo é Google Docs/Sheets */}
      <Card className="border-l-4 border-l-muted-foreground/40">
        <CardContent className="pt-4 flex items-start justify-between gap-3 flex-wrap">
          <div className="text-xs text-muted-foreground max-w-xl">
            A gestão de Modelos DOCX foi movida para <strong>Configurações → Documentos</strong>.
            Os pipelines atuais de Relatórios, REO, Lista de Chamada e Planejamento usam <strong>Google Docs / Sheets</strong>.
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/configuracoes">
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir Configurações
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Drive Institucional */}
      <Card className="border-l-4 border-l-blue-600">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderSync className="h-4 w-4" /> Drive Institucional SysCFV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Garante a estrutura de pastas padronizada no Google Drive: <code>SysCFV_Workspace</code> com subpastas
            para Modelos, Relatórios de Atividade, Planejamentos, Listas de Presença, Relatórios Mensais, REO, Roteiros e Cronogramas.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" onClick={sincronizarDrive} disabled={syncingDrive}>
              {syncingDrive ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FolderSync className="h-3.5 w-3.5 mr-1" />}
              Sincronizar pastas no Drive
            </Button>
            {driveResult && (
              <Button asChild size="sm" variant="outline">
                <a href={driveResult.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir pasta no Drive
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reset Section */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <TrendingUp className="h-4 w-4" /> Resetar Scores ELO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Zera todos os scores ELO e competências de todos os relatórios. Esta ação é irreversível.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={resettingElo}>
                  <RotateCcw className="h-4 w-4 mr-1" /> {resettingElo ? "Resetando..." : "Resetar ELO"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Reset de ELO</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os scores ELO e competências serão zerados. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={resetElo}>Confirmar Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <Percent className="h-4 w-4" /> Resetar % Frequência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Zera todos os dados de frequência/adesão de todos os relatórios. Esta ação é irreversível.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={resettingFreq}>
                  <RotateCcw className="h-4 w-4 mr-1" /> {resettingFreq ? "Resetando..." : "Resetar Frequência"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Reset de Frequência</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os dados de adesão e frequência serão zerados. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={resetFrequencia}>Confirmar Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
