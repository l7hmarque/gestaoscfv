import { useState, useEffect } from "react";
import { Plus, Upload, Search, Filter, Eye, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { BAIRROS_SCFV } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";

const statusLabel: Record<string, string> = { ativo: "Ativo", desligado: "Desligado", incompleto: "Incompleto", pendente: "Pendente" };
const statusColor: Record<string, string> = { ativo: "bg-green-100 text-green-800", desligado: "bg-red-100 text-red-800", incompleto: "bg-yellow-100 text-yellow-800", pendente: "bg-blue-100 text-blue-800" };
const periodoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };

const ParticipantesPage = () => {
  const [participantes, setParticipantes] = useState<Tables<"participantes">[]>([]);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [periodoFilter, setPeriodoFilter] = useState<string>("todos");
  const [bairroFilter, setBairroFilter] = useState<string>("todos");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: p }, { data: b }] = await Promise.all([
      supabase.from("participantes").select("*").order("nome_completo"),
      supabase.from("bairros").select("*").order("nome"),
    ]);
    setParticipantes(p || []);
    setBairros(b || []);
    setLoading(false);
  };

  const filtered = participantes.filter((p) => {
    if (search && !p.nome_completo.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "todos" && p.status !== statusFilter) return false;
    if (periodoFilter !== "todos" && p.periodo !== periodoFilter) return false;
    if (bairroFilter !== "todos" && p.bairro_id !== bairroFilter) return false;
    return true;
  });

  const calcAge = (d: string | null) => {
    if (!d) return "—";
    const diff = Date.now() - new Date(d).getTime();
    return Math.floor(diff / 31557600000) + " anos";
  };

  const pendentes = participantes.filter((p) => (p as any).status === "pendente");
  const pendentesNaoVistos = pendentes.filter((p) => !(p as any).visualizado_em);

  return (
    <div className="space-y-4">
      {/* Banner de pendentes */}
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

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-9 text-sm"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="desligado">Desligado</SelectItem>
            <SelectItem value="incompleto">Incompleto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
          <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos períodos</SelectItem>
            <SelectItem value="manha">Manhã</SelectItem>
            <SelectItem value="tarde">Tarde</SelectItem>
            <SelectItem value="integral">Integral</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bairroFilter} onValueChange={setBairroFilter}>
          <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos bairros</SelectItem>
            {bairros.filter((b) => BAIRROS_SCFV.includes(b.nome)).map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
          </SelectContent>
        </Select>
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
                <TableHead className="text-xs font-medium">Bairro SCFV</TableHead>
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
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm font-medium">{p.nome_completo}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{calcAge(p.data_nascimento)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{bairroNome && BAIRROS_SCFV.includes(bairroNome) ? bairroNome : "—"}</TableCell>
                    <TableCell className="text-sm">{p.periodo ? periodoLabel[p.periodo] || p.periodo : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${statusColor[p.status || "ativo"]}`}>
                        {statusLabel[p.status || "ativo"]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.responsavel1_nome || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.responsavel1_whatsapp || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <Link to={`/participantes/${p.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                      </Button>
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
