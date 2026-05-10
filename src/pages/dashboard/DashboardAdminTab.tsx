import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  const [driveResult, setDriveResult] = useState<any>(null);
  const [driveRootUrl, setDriveRootUrl] = useState<string | null>(null);
  const hoje = new Date();
  const [syncMes, setSyncMes] = useState<number>(hoje.getMonth() + 1);
  const [syncAno, setSyncAno] = useState<number>(hoje.getFullYear());
  const [syncTipos, setSyncTipos] = useState<Record<string, boolean>>({
    mensal: true, listas: true, relatorios: true, planejamentos: true, equipe_tecnica: true, reo: true,
  });
  const toggleTipo = (k: string) => setSyncTipos((s) => ({ ...s, [k]: !s[k] }));

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("drive_folder_cache" as any)
        .select("folder_id")
        .eq("chave", "root")
        .maybeSingle();
      const fid = (data as any)?.folder_id;
      if (fid) setDriveRootUrl(`https://drive.google.com/drive/folders/${fid}`);
    })();
  }, []);

  const sincronizarDrive = async () => {
    setSyncingDrive(true);
    setDriveResult(null);
    try {
      const tipos = Object.entries(syncTipos).filter(([, v]) => v).map(([k]) => k);
      if (tipos.length === 0) { toast.error("Selecione ao menos um tipo de documento"); setSyncingDrive(false); return; }
      const { data, error } = await supabase.functions.invoke("sync-drive-modelos", {
        body: { mes: syncMes, ano: syncAno, tipos, modo: "versionar" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao sincronizar");
      setDriveResult(data);
      const totErr = (data.erros || []).length;
      if (totErr > 0) toast.warning(`Sincronizado com ${totErr} aviso(s) — verifique o resultado abaixo.`);
      else toast.success("Documentos enviados ao Google Drive");
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
            Sincroniza os documentos institucionais do mês selecionado para <code>SYSCFV / {`{MÊS} - {ANO}`}</code> no
            Google Drive, usando os templates cadastrados em <strong>drive_modelos</strong>. Versões antigas viram <code>_v2</code>, <code>_v3</code>...
          </p>

          {driveRootUrl && (
            <Button asChild size="sm" variant="secondary" className="w-full sm:w-auto">
              <a href={driveRootUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir pasta SYSCFV no Drive
              </a>
            </Button>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px]">Mês</Label>
              <Select value={String(syncMes)} onValueChange={(v) => setSyncMes(Number(v))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Ano</Label>
              <Select value={String(syncAno)} onValueChange={(v) => setSyncAno(Number(v))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2 border rounded-md p-3">
            {[
              { k: "mensal", label: "Relatório Mensal (Google Sheets)" },
              { k: "listas", label: "Listas de Presença por turma" },
              { k: "relatorios", label: "Relatórios de Atividade do mês" },
              { k: "planejamentos", label: "Planejamentos do mês" },
              { k: "equipe_tecnica", label: "Equipe Técnica (atendimentos + relatos)" },
              { k: "reo", label: "REO — Relatório de Execução do Objeto" },
            ].map((opt) => (
              <label key={opt.k} className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={!!syncTipos[opt.k]} onCheckedChange={() => toggleTipo(opt.k)} />
                {opt.label}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" onClick={sincronizarDrive} disabled={syncingDrive}>
              {syncingDrive ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FolderSync className="h-3.5 w-3.5 mr-1" />}
              Sincronizar mês ao Drive
            </Button>
            {driveResult?.root?.url && (
              <Button asChild size="sm" variant="outline">
                <a href={driveResult.root.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir pasta raiz
                </a>
              </Button>
            )}
          </div>

          {driveResult?.sincronizados && (
            <div className="text-[11px] space-y-1 border-t pt-2">
              <p className="font-medium text-foreground">Resultado:</p>
              {driveResult.sincronizados.mensal && (
                <p>📊 Relatório Mensal: <span className="text-muted-foreground">{driveResult.sincronizados.mensal.nome}{driveResult.sincronizados.mensal.skipped ? " (pulado)" : ""}</span></p>
              )}
              {driveResult.sincronizados.listas?.length > 0 && (
                <p>📋 Listas de Presença: <span className="text-muted-foreground">{driveResult.sincronizados.listas.length} turma(s)</span></p>
              )}
              {driveResult.sincronizados.relatorios?.length > 0 && (
                <p>📝 Relatórios de Atividade: <span className="text-muted-foreground">{driveResult.sincronizados.relatorios.length} arquivo(s)</span></p>
              )}
              {driveResult.sincronizados.planejamentos?.length > 0 && (
                <p>🗒 Planejamentos: <span className="text-muted-foreground">{driveResult.sincronizados.planejamentos.length} arquivo(s)</span></p>
              )}
              {driveResult.sincronizados.equipe_tecnica && (
                <p>👥 Equipe Técnica: <span className="text-muted-foreground">{driveResult.sincronizados.equipe_tecnica.nome}{driveResult.sincronizados.equipe_tecnica.skipped ? " (pulado)" : ` · ${driveResult.sincronizados.equipe_tecnica.atendimentos || 0} atendimentos, ${driveResult.sincronizados.equipe_tecnica.relatos || 0} relatos`}</span></p>
              )}
              {driveResult.erros?.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-amber-700 dark:text-amber-400">⚠ {driveResult.erros.length} aviso(s)</summary>
                  <ul className="ml-4 mt-1 space-y-0.5">
                    {driveResult.erros.map((e: any, i: number) => (
                      <li key={i} className="text-muted-foreground"><strong>{e.tipo}:</strong> {e.msg}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
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
