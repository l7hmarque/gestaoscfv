import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveAs } from "file-saver";
import { Download, Package, FileCode2, Loader2, AlertTriangle, CheckCircle2, Wrench, Ban } from "lucide-react";
import { toast } from "sonner";
import { buildDespesaTxt, validarDespesaSitDetalhado, type SitConfig } from "@/lib/sitExport";
import { gerarPacoteSit, validarLote } from "@/lib/sitZipPackage";
import { Link as RouterLink } from "react-router-dom";
import RegularizarSitDialog from "@/components/financeiro/RegularizarSitDialog";

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
  const [regularizar, setRegularizar] = useState<any | null>(null);

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

  const cfgOk = !!(cfg && cfg.cnpj_concedente && cfg.numero_instrumento_padrao);
  const validacao = cfg ? validarLote(despesas, cfg as SitConfig) : { ok: [], bloqueadas: [] };
  const semComprovante = despesas.filter(d => !d.comprovante_url && !d.nota_url && !d.boleto_url);
  const podeExportar = cfgOk && validacao.ok.length > 0 && validacao.bloqueadas.length === 0;
  const motivoBloqueio = !cfgOk
    ? "Configure os dados do SIT antes de exportar"
    : validacao.bloqueadas.length > 0
      ? `${validacao.bloqueadas.length} despesa(s) com pendências — regularize todas antes de gerar o arquivo`
      : validacao.ok.length === 0
        ? "Nenhuma despesa válida no período"
        : "";

  async function gerarTxt() {
    if (!podeExportar) {
      toast.error(motivoBloqueio || "Não é possível exportar");
      return;
    }
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
    if (!podeExportar) {
      toast.error(motivoBloqueio || "Não é possível exportar");
      return;
    }
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
              <Alert className="border-rose-500/40 bg-rose-500/5">
                <Ban className="h-4 w-4 text-rose-600" />
                <AlertDescription className="text-xs">
                  <div className="font-semibold text-rose-700 mb-1">
                    Exportação bloqueada — {validacao.bloqueadas.length} despesa(s) com campos faltando
                  </div>
                  <details open={validacao.bloqueadas.length <= 5}>
                    <summary className="cursor-pointer text-rose-700 underline text-[11px]">
                      Ver detalhes por despesa
                    </summary>
                    <ul className="mt-2 space-y-2 max-h-72 overflow-auto pr-1">
                      {validacao.bloqueadas.slice(0, 50).map(({ d, erros }) => (
                        <li key={d.id} className="bg-background border rounded p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-[11px] truncate">
                                {d.codigo_lancamento ? `[${d.codigo_lancamento}] ` : ""}
                                {d.descricao || "(sem descrição)"}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                R$ {Number(d.valor || 0).toFixed(2)} · {d.fornecedor || "—"} · {d.data_lancamento || "sem data"}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] gap-1 shrink-0"
                              onClick={() => setRegularizar(d)}
                            >
                              <Wrench className="h-3 w-3" /> Regularizar
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {erros.map((er, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-[9px] px-1 py-0 bg-rose-500/10 text-rose-700 border-rose-500/30"
                                title={er.mensagem}
                              >
                                {er.rotulo}
                              </Badge>
                            ))}
                          </div>
                        </li>
                      ))}
                      {validacao.bloqueadas.length > 50 && (
                        <li className="text-[11px] text-muted-foreground italic text-center">
                          ... e mais {validacao.bloqueadas.length - 50} despesa(s)
                        </li>
                      )}
                    </ul>
                  </details>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={gerarTxt}
                disabled={!podeExportar}
                className="gap-1"
                title={motivoBloqueio || "Gerar arquivo Despesa.txt"}
              >
                <Download className="h-3 w-3" /> Despesa.txt
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={gerarZip}
                disabled={!podeExportar || gerandoZip}
                className="gap-1 bg-blue-600 hover:bg-blue-700"
                title={motivoBloqueio || "Gerar pacote ZIP completo"}
              >
                {gerandoZip ? <Loader2 className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />}
                Pacote ZIP completo
              </Button>
              {podeExportar && validacao.ok.length === despesas.length && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Mês completo
                </Badge>
              )}
              {!podeExportar && motivoBloqueio && (
                <span className="text-[11px] text-rose-700 self-center">
                  ⛔ {motivoBloqueio}
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
      <RegularizarSitDialog
        open={!!regularizar}
        onOpenChange={(v) => { if (!v) setRegularizar(null); }}
        despesa={regularizar}
        onSaved={() => { setRegularizar(null); load(); }}
      />
    </Card>
  );
}