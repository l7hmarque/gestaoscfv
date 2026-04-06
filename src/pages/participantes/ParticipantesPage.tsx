import { useState, useEffect } from "react";
import { Plus, Upload, Search, Filter, Eye, Bell, Check, X, AlertTriangle, Merge, ChevronDown, ChevronUp } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { BAIRROS_SCFV, calcFaixaFromDate } from "@/lib/constants";
import { displayPhone } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";

const statusLabel: Record<string, string> = { ativo: "Ativo", desligado: "Desligado", incompleto: "Incompleto", pendente: "Pendente" };
const statusColor: Record<string, string> = { ativo: "bg-green-100 text-green-800", desligado: "bg-red-100 text-red-800", incompleto: "bg-yellow-100 text-yellow-800", pendente: "bg-blue-100 text-blue-800" };
const periodoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };

interface DuplicatePair {
  id1: string;
  nome1: string;
  status1: string;
  id2: string;
  nome2: string;
  status2: string;
  data_nascimento: string;
  similaridade: number;
}

const ParticipantesPage = () => {
  const navigate = useNavigate();
  const [participantes, setParticipantes] = useState<Tables<"participantes">[]>([]);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [periodoFilter, setPeriodoFilter] = useState<string>("");
  const [bairroFilter, setBairroFilter] = useState<string>("");
  const [duplicatas, setDuplicatas] = useState<DuplicatePair[]>([]);
  const [showDuplicatas, setShowDuplicatas] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    fetchDuplicatas();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [p, { data: b }] = await Promise.all([
      fetchAllRows("participantes", { select: "*", order: { column: "nome_completo" } }),
      supabase.from("bairros").select("*").order("nome"),
    ]);
    setParticipantes(p || []);
    setBairros(b || []);
    setLoading(false);
  };

  const fetchDuplicatas = async () => {
    try {
      const { data } = await supabase.rpc("find_similar_participants" as any);
      setDuplicatas((data as DuplicatePair[] | null) || []);
    } catch {
      // pg_trgm not available or function not found
    }
  };

  const handleMerge = async (keepId: string, removeId: string) => {
    if (guardDemo(isDemo)) return;
    setMerging(removeId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/merge-participantes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ keep_id: keepId, remove_id: removeId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.message || "Participantes mesclados!");
      fetchData();
      fetchDuplicatas();
    } catch (err: any) {
      toast.error("Erro ao mesclar: " + (err.message || "Tente novamente"));
    }
    setMerging(null);
  };

  const hasFilters = statusFilter || periodoFilter || bairroFilter;

  const filtered = participantes.filter((p) => {
    if (search && !p.nome_completo.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (periodoFilter && p.periodo !== periodoFilter) return false;
    if (bairroFilter && p.bairro_id !== bairroFilter) return false;
    return true;
  });

  const calcAge = (d: string | null) => {
    if (!d) return "—";
    const diff = Date.now() - new Date(d).getTime();
    return Math.floor(diff / 31557600000) + " anos";
  };

  const isDemo = useIsDemo();

  const handleAprovar = async (p: Tables<"participantes">) => {
    if (guardDemo(isDemo)) return;
    const { error } = await supabase.from("participantes").update({ status: "ativo" } as any).eq("id", p.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    const faixa = calcFaixaFromDate(p.data_nascimento);
    if (p.bairro_id && p.periodo && faixa) {
      let query = supabase.from("turmas").select("id").eq("ativa", true).eq("bairro_id", p.bairro_id).eq("faixa_etaria", faixa as any);
      if (p.periodo !== "integral") query = query.eq("periodo", p.periodo as any);
      const { data: turmasCompativeis } = await query;
      if (turmasCompativeis && turmasCompativeis.length > 0) {
        const links = turmasCompativeis.map(t => ({ turma_id: t.id, participante_id: p.id }));
        await supabase.from("turma_participantes").upsert(links, { onConflict: "turma_id,participante_id", ignoreDuplicates: true });
        toast.info(`Vinculado a ${turmasCompativeis.length} turma(s)`);
      }
    }
    toast.success("Matrícula aprovada!");
    fetchData();
  };

  const pendentes = participantes.filter((p) => (p as any).status === "pendente");
  const pendentesNaoVistos = pendentes.filter((p) => !(p as any).visualizado_em);

  const clearFilters = () => {
    setStatusFilter("");
    setPeriodoFilter("");
    setBairroFilter("");
  };

  return (
    <div className="space-y-4">
      {pendentes.length > 0 && (
        <button
          type="button"
          onClick={() => setStatusFilter("pendente")}
          className="w-full flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-left hover:bg-blue-100 transition-colors"
        >
          <div className="relative">
            <Bell className="h-5 w-5 text-blue-600" />
            {pendentesNaoVistos.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {pendentesNaoVistos.length}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-blue-800">{pendentes.length} matrícula{pendentes.length !== 1 ? "s" : ""} online aguardando aprovação</p>
            {pendentesNaoVistos.length > 0 && (
              <p className="text-xs text-blue-600">{pendentesNaoVistos.length} ainda não visualizada{pendentesNaoVistos.length !== 1 ? "s" : ""}</p>
            )}
          </div>
        </button>
      )}

      {/* Duplicatas banner */}
      {duplicatas.length > 0 && (
        <div className="border border-yellow-300 bg-yellow-50 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDuplicatas(!showDuplicatas)}
            className="w-full flex items-center gap-3 p-3 text-left hover:bg-yellow-100 transition-colors"
          >
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                {duplicatas.length} possível(is) duplicata(s) encontrada(s)
              </p>
              <p className="text-xs text-yellow-600">Nomes similares com mesma data de nascimento</p>
            </div>
            {showDuplicatas ? <ChevronUp className="h-4 w-4 text-yellow-600" /> : <ChevronDown className="h-4 w-4 text-yellow-600" />}
          </button>

          {showDuplicatas && (
            <div className="border-t border-yellow-200 p-3 space-y-3">
              {duplicatas.map((d, i) => (
                <div key={i} className="bg-white rounded-md border border-yellow-200 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {Math.round(d.similaridade * 100)}% similar
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Nascimento: {new Date(d.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-center">
                    <div className="text-sm">
                      <p className="font-medium">{d.nome1}</p>
                      <Badge variant="secondary" className={`text-[10px] mt-1 ${statusColor[d.status1]}`}>
                        {statusLabel[d.status1]}
                      </Badge>
                    </div>
                    <div className="flex gap-1 justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        disabled={merging === d.id2}
                        onClick={() => handleMerge(d.id1, d.id2)}
                      >
                        <Merge className="h-3 w-3" />
                        ← Manter
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        disabled={merging === d.id1}
                        onClick={() => handleMerge(d.id2, d.id1)}
                      >
                        Manter →
                        <Merge className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-sm text-right">
                      <p className="font-medium">{d.nome2}</p>
                      <Badge variant="secondary" className={`text-[10px] mt-1 ${statusColor[d.status2]}`}>
                        {statusLabel[d.status2]}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Participantes</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} participante{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/participantes/importar"><Upload className="h-4 w-4 mr-1" />Importar</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/participantes/novo"><Plus className="h-4 w-4 mr-1" />Novo</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-9 text-sm"><Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="desligado">Desligado</SelectItem>
            <SelectItem value="incompleto">Incompleto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
          <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manha">Manhã</SelectItem>
            <SelectItem value="tarde">Tarde</SelectItem>
            <SelectItem value="integral">Integral</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bairroFilter} onValueChange={setBairroFilter}>
          <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="Bairro CAIA" /></SelectTrigger>
          <SelectContent>
            {bairros.filter((b) => BAIRROS_SCFV.includes(b.nome)).map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-muted-foreground">
            <X className="h-3 w-3 mr-1" />Limpar
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          {participantes.length === 0 ? "Nenhum participante cadastrado. Comece importando ou cadastrando manualmente." : "Nenhum resultado para os filtros aplicados."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-medium">Nome</TableHead>
                <TableHead className="text-xs font-medium">Idade</TableHead>
                <TableHead className="text-xs font-medium">Bairro CAIA</TableHead>
                <TableHead className="text-xs font-medium">Período</TableHead>
                <TableHead className="text-xs font-medium">Status</TableHead>
                <TableHead className="text-xs font-medium">Responsável</TableHead>
                <TableHead className="text-xs font-medium">Telefone</TableHead>
                <TableHead className="text-xs font-medium w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const bairroNome = bairros.find((b) => b.id === p.bairro_id)?.nome;
                return (
                  <TableRow
                    key={p.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/participantes/${p.id}`)}
                  >
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={p.foto_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{p.nome_completo?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span>{p.nome_completo}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{calcAge(p.data_nascimento)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{bairroNome && BAIRROS_SCFV.includes(bairroNome) ? bairroNome : "—"}</TableCell>
                    <TableCell className="text-sm">{p.periodo ? periodoLabel[p.periodo] || p.periodo : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${statusColor[p.status || "ativo"]}`}>
                        {statusLabel[p.status || "ativo"]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.responsavel1_nome || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{displayPhone(p.responsavel1_whatsapp)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-0.5">
                        {p.status === "pendente" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" title="Aprovar" onClick={() => handleAprovar(p)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link to={`/participantes/${p.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ParticipantesPage;
