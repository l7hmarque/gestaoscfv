import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ShieldCheck, ArrowRight } from "lucide-react";

const TABELAS = ["todas","participantes","turmas","turma_participantes","relatorios_atividade","relatorio_presenca","presenca","planejamentos","profiles","user_roles","participante_transferencias","bairros","configuracoes_gerais"];
const ACOES = ["todas","INSERT","UPDATE","DELETE"];

export function AuditoriaTab() {
  const [tabela, setTabela] = useState("todas");
  const [acao, setAcao] = useState("todas");
  const [busca, setBusca] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["auditoria", tabela, acao],
    queryFn: async () => {
      let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (tabela !== "todas") q = q.eq("tabela", tabela);
      if (acao !== "todas") q = q.ilike("acao", `${acao}_%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtrados = (data ?? []).filter((r: any) =>
    !busca || (r.user_nome || "").toLowerCase().includes(busca.toLowerCase()) || (r.acao || "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-semibold">Auditoria de Presenças</div>
              <div className="text-xs text-muted-foreground">Detecta relatórios duplicados, presenças faltantes/órfãs e relatórios incompletos.</div>
            </div>
          </div>
          <Button asChild size="sm">
            <Link to="/coordenacao/auditoria-presencas">Abrir auditoria <ArrowRight className="h-4 w-4 ml-2" /></Link>
          </Button>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={tabela} onValueChange={setTabela}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>{TABELAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={acao} onValueChange={setAcao}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>{ACOES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Buscar por usuário ou ação..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
        <Button size="sm" variant="outline" onClick={() => refetch()}>Atualizar</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimos 200 eventos</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-1">
              {filtrados.map((r: any) => (
                <div key={r.id} className="border rounded text-xs">
                  <button
                    className="w-full flex items-center gap-2 p-2 hover:bg-accent/40 text-left"
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  >
                    {expanded === r.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="font-mono text-[10px] text-muted-foreground w-32">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                    <span className="font-medium w-40 truncate">{r.user_nome}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted">{r.acao}</span>
                    <span className="text-muted-foreground">{r.tabela}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[200px]">{r.registro_id}</span>
                  </button>
                  {expanded === r.id && (
                    <pre className="p-2 bg-muted/40 border-t text-[10px] overflow-x-auto max-h-96">
                      {(() => {
                        try { return JSON.stringify(JSON.parse(r.detalhes || "{}"), null, 2); }
                        catch { return r.detalhes || ""; }
                      })()}
                    </pre>
                  )}
                </div>
              ))}
              {filtrados.length === 0 && <p className="text-center text-muted-foreground py-6">Nenhum evento encontrado.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}