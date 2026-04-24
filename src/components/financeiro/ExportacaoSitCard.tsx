import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveAs } from "file-saver";
import { Download, Package, FileCode2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { buildDespesaTxt, validarDespesaSit, type SitConfig } from "@/lib/sitExport";
import { gerarPacoteSit, validarLote } from "@/lib/sitZipPackage";
import { Link as RouterLink } from "react-router-dom";

function mesAtualStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ExportacaoSitCard() {
  const [mesRef, setMesRef] = useState(mesAtualStr());
  const [cfg, setCfg] = useState<SitConfig | null>(null);
  const [despesas, setDespesas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerandoZip, setGerandoZip] = useState(false);

  useEffect(() => { load(); }, [mesRef]);

  async function load() {
    setLoading(true);
    const [{ data: cfgData }, { data: despData }] = await Promise.all([
      supabase.from("sit_configuracao" as any).select("*").maybeSingle(),
      supabase.from("despesas").select("*").eq("mes_referencia", mesRef).order("data_lancamento"),
    ]);
    setCfg(cfgData as any);
    setDespesas(despData || []);
    setLoading(false);
  }

  const cfgOk = cfg && cfg.cnpj_concedente && cfg.numero_instrumento_padrao;
  const validacao = cfg ? validarLote(despesas, cfg as SitConfig) : { ok: [], bloqueadas: [] };
  const semComprovante = despesas.filter(d => !d.comprovante_url && !d.nota_url && !d.boleto_url);

  async function gerarTxt() {
    if (!cfgOk) { toast.error("Configure SIT em /configuracoes → aba SIT primeiro"); return; }
    if (validacao.ok.length === 0) { toast.error("Nenhuma despesa válida no período"); return; }
    const txt = buildDespesaTxt(validacao.ok, cfg as SitConfig);
    saveAs(new Blob([txt], { type: "text/plain;charset=utf-8" }), `Despesa_${mesRef}.txt`);
    await supabase.from("audit_log").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id || "00000000-0000-0000-0000-000000000000",
      acao: "sit_export_txt",
      tabela: "despesas",
      detalhes: `Mês ${mesRef} · ${validacao.ok.length} despesas`,
    } as any);
    toast.success(`Despesa.txt gerado (${validacao.ok.length} linhas)`);
  }

  async function gerarZip() {
    if (!cfgOk) { toast.error("Configure SIT em /configuracoes → aba SIT primeiro"); return; }
    if (validacao.ok.length === 0) { toast.error("Nenhuma despesa válida no período"); return; }
    setGerandoZip(true);
    try {
      const [ano, mes] = mesRef.split("-");
      const result = await gerarPacoteSit(validacao.ok, cfg as SitConfig, { mes, ano });
      await supabase.from("audit_log").insert({
        user_id: (await supabase.auth.getUser()).data.user?.id || "00000000-0000-0000-0000-000000000000",
        acao: "sit_export_zip",
        tabela: "despesas",
        detalhes: `Mês ${mesRef} · ${result.txtCount} despesas · ${result.comprovantesIncluidos} comprovantes`,
      } as any);
      toast.success(`Pacote ZIP gerado (${result.comprovantesIncluidos} comprovantes)${result.comprovantesFaltantes.length ? ` — ${result.comprovantesFaltantes.length} pendentes` : ""}`);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setGerandoZip(false);
    }
  }

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-blue-600" />
              Exportação SIT / TCE-PR
            </CardTitle>
            <CardDescription className="text-xs">
              Gera Despesa.txt e pacote ZIP completo para upload no portal SIT-Concedente.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Competência</Label>
            <Input
              type="month"
              value={mesRef}
              onChange={e => setMesRef(e.target.value)}
              className="h-8 text-xs w-40"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <>
            {!cfgOk && (
              <Alert className="border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs">
                  Configure os dados do SIT em{" "}
                  <RouterLink to="/configuracoes" className="underline font-medium">/configuracoes → aba SIT</RouterLink> antes de exportar.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
              <div className="bg-muted/50 rounded p-2">
                <div className="text-[10px] text-muted-foreground uppercase">Total no mês</div>
                <div className="text-lg font-bold">{despesas.length}</div>
              </div>
              <div className="bg-emerald-500/10 rounded p-2">
                <div className="text-[10px] text-emerald-700 uppercase">Prontas p/ SIT</div>
                <div className="text-lg font-bold text-emerald-700">{validacao.ok.length}</div>
              </div>
              <div className="bg-amber-500/10 rounded p-2">
                <div className="text-[10px] text-amber-700 uppercase">Bloqueadas</div>
                <div className="text-lg font-bold text-amber-700">{validacao.bloqueadas.length}</div>
              </div>
              <div className="bg-rose-500/10 rounded p-2">
                <div className="text-[10px] text-rose-700 uppercase">Sem comprovante</div>
                <div className="text-lg font-bold text-rose-700">{semComprovante.length}</div>
              </div>
            </div>

            {validacao.bloqueadas.length > 0 && (
              <details className="text-xs bg-amber-500/5 border border-amber-500/20 rounded p-2">
                <summary className="cursor-pointer font-medium text-amber-700">
                  Ver despesas bloqueadas ({validacao.bloqueadas.length})
                </summary>
                <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
                  {validacao.bloqueadas.slice(0, 20).map(({ d, erros }) => (
                    <li key={d.id} className="text-[11px]">
                      <span className="font-medium">{d.descricao || "(sem descrição)"}</span>{" "}
                      <span className="text-muted-foreground">— {erros.join(", ")}</span>
                    </li>
                  ))}
                  {validacao.bloqueadas.length > 20 && (
                    <li className="text-[11px] text-muted-foreground italic">... e mais {validacao.bloqueadas.length - 20}</li>
                  )}
                </ul>
              </details>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={gerarTxt}
                disabled={!cfgOk || validacao.ok.length === 0}
                className="gap-1"
              >
                <Download className="h-3 w-3" /> Despesa.txt
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={gerarZip}
                disabled={!cfgOk || validacao.ok.length === 0 || gerandoZip}
                className="gap-1 bg-blue-600 hover:bg-blue-700"
              >
                {gerandoZip ? <Loader2 className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />}
                Pacote ZIP completo
              </Button>
              {cfgOk && validacao.ok.length === despesas.length && despesas.length > 0 && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Mês completo
                </Badge>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}