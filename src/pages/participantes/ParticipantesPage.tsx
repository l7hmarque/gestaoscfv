import { useState, useEffect } from "react";
import { Plus, Upload, Search, Filter, Eye, Bell, Check, X, AlertTriangle, Merge, ChevronDown, ChevronUp, FileSpreadsheet } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BAIRROS_SCFV, calcAge, calcFaixaFromDate, displayAge, PERIODO_LABELS, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { exportXLSX } from "@/hooks/useDataExport";
import { displayPhone } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Users } from "lucide-react";

const statusLabel = STATUS_LABELS;
const statusColor = STATUS_COLORS;
const periodoLabel = PERIODO_LABELS;

const MOTIVOS_DESLIGAMENTO = [
  "Mudança de município",
  "Evasão",
  "Desistência",
  "Completou a faixa etária",
  "Transferência para outro serviço",
  "Faltas consecutivas",
  "Outro",
];

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
  const { user } = useAuth();
  const { log: auditLog } = useAuditLog();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [periodoFilter, setPeriodoFilter] = useState<string>("");
  const [bairroFilter, setBairroFilter] = useState<string>("");
  const [generoFilter, setGeneroFilter] = useState<string>("");
  const [idadeMin, setIdadeMin] = useState<string>("");
  const [idadeMax, setIdadeMax] = useState<string>("");
  const [duplicatas, setDuplicatas] = useState<DuplicatePair[]>([]);
  const [showDuplicatas, setShowDuplicatas] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);

  // Desligamento dialog state
  const [desligamentoOpen, setDesligamentoOpen] = useState(false);
  const [desligamentoTarget, setDesligamentoTarget] = useState<Tables<"participantes"> | null>(null);
  const [desligamentoMotivo, setDesligamentoMotivo] = useState("");
  const [desligamentoJustificativa, setDesligamentoJustificativa] = useState("");
  const [desligamentoSaving, setDesligamentoSaving] = useState(false);

  const participantesQuery = useQuery({
    queryKey: ["participantes-list"],
    queryFn: () => fetchAllRows("participantes", { select: "*", order: { column: "nome_completo" } }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const bairrosQuery = useQuery({
    queryKey: ["bairros-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bairros").select("*").order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const participantes: Tables<"participantes">[] = (participantesQuery.data as any) || [];
  const bairros: Tables<"bairros">[] = (bairrosQuery.data as any) || [];
  const loading = participantesQuery.isLoading || bairrosQuery.isLoading;

  useEffect(() => {
    if (participantesQuery.error) {
      toast.error("Erro ao carregar participantes: " + ((participantesQuery.error as any)?.message || "tente novamente"));
    }
  }, [participantesQuery.error]);

  useEffect(() => {
    fetchDuplicatas();
  }, []);

  const fetchData = () => {
    queryClient.invalidateQueries({ queryKey: ["participantes-list"] });
    queryClient.invalidateQueries({ queryKey: ["bairros-list"] });
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

  const hasFilters = statusFilter || periodoFilter || bairroFilter || generoFilter || idadeMin || idadeMax;

  const filtered = participantes.filter((p) => {
    if (search && !p.nome_completo.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (periodoFilter && p.periodo !== periodoFilter) return false;
    if (bairroFilter && p.bairro_id !== bairroFilter) return false;
    if (generoFilter && (p.genero || "") !== generoFilter) return false;
    if (idadeMin || idadeMax) {
      const age = calcAge(p.data_nascimento);
      if (idadeMin && age < Number(idadeMin)) return false;
      if (idadeMax && age > Number(idadeMax)) return false;
    }
    return true;
  });

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

  // Quick period change with automatic turma transfer
  const handlePeriodoChange = async (p: Tables<"participantes">, newPeriodo: string) => {
    if (guardDemo(isDemo)) return;
    const oldPeriodo = p.periodo;

    // Pre-validate: must have at least one compatible destination turma BEFORE unlinking
    const faixa = calcFaixaFromDate(p.data_nascimento);
    if (!p.bairro_id || !faixa) {
      toast.error("Participante sem bairro ou faixa etária — defina antes de transferir");
      return;
    }
    let destQuery = supabase.from("turmas").select("id, nome, educador_id").eq("ativa", true).eq("bairro_id", p.bairro_id).eq("faixa_etaria", faixa as any);
    if (newPeriodo !== "integral") destQuery = destQuery.eq("periodo", newPeriodo as any);
    const { data: destTurmas } = await destQuery;

    if (!destTurmas || destTurmas.length === 0) {
      toast.error(`Nenhuma turma compatível para ${periodoLabel[newPeriodo]} — período NÃO alterado`);
      return;
    }

    const { error } = await supabase.from("participantes").update({ periodo: newPeriodo } as any).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    await auditLog({ acao: "alteração de período", tabela: "participantes", registro_id: p.id, detalhes: `Período: ${periodoLabel[oldPeriodo || ""] || "—"} → ${periodoLabel[newPeriodo]}` });

    if (p.status === "ativo" || p.status === "busca_ativa") {
      try {
        const today = new Date().toISOString().split("T")[0];
        // Get current active turma links — only SCFV turmas with matching faixa (avoid unlinking Karate etc.)
        const { data: currentLinks } = await supabase
          .from("turma_participantes")
          .select("id, turma_id, turmas(nome, periodo, educador_id, faixa_etaria, oficina)")
          .eq("participante_id", p.id)
          .is("data_saida" as any, null);

        // Only unlink from SCFV turmas (no oficina) matching faixa — preserve Karate / extracurricular
        const linksToUnlink = (currentLinks || []).filter((l: any) => {
          const t = l.turmas;
          if (!t) return false;
          const isOficina = t.oficina && t.oficina !== "" && t.oficina !== "__none__";
          return !isOficina && t.faixa_etaria === faixa;
        });
        const oldTurmaIds = linksToUnlink.map((l: any) => l.turma_id);

        for (const link of linksToUnlink) {
          await supabase.from("turma_participantes")
            .update({ data_saida: today, motivo_saida: "Transferência de período" } as any)
            .eq("id", link.id);
        }

        const newLinks = destTurmas.map(t => ({ turma_id: t.id, participante_id: p.id }));
        await supabase.from("turma_participantes").upsert(newLinks, { onConflict: "turma_id,participante_id", ignoreDuplicates: true });

        for (const oldId of oldTurmaIds) {
          for (const newT of destTurmas) {
            await (supabase.from("participante_transferencias") as any).insert({
              participante_id: p.id,
              turma_origem_id: oldId,
              turma_destino_id: newT.id,
              motivo: "Transferência de período",
            });
          }
        }

        // Notify educators
        const myProfile = await supabase.from("profiles").select("id").eq("user_id", user!.id).single();
        if (myProfile.data) {
          const educadorIds = new Set<string>();
          linksToUnlink.forEach((l: any) => {
            if (l.turmas?.educador_id && l.turmas.educador_id !== myProfile.data!.id) educadorIds.add(l.turmas.educador_id);
          });
          destTurmas.forEach(t => {
            if (t.educador_id && t.educador_id !== myProfile.data!.id) educadorIds.add(t.educador_id);
          });
          const recados = Array.from(educadorIds).map(edId => ({
            remetente_id: myProfile.data!.id,
            destinatario_id: edId,
            participante_id: p.id,
            conteudo: `${p.nome_completo} foi transferido(a) de período (${periodoLabel[oldPeriodo || ""] || "—"} → ${periodoLabel[newPeriodo]}). Turmas atualizadas automaticamente.`,
          }));
          if (recados.length > 0) await supabase.from("recados").insert(recados);
        }

        toast.info(`Transferido para ${destTurmas.length} turma(s). ${oldTurmaIds.length > 0 ? "Frequências preservadas." : ""}`);
      } catch (err) {
        console.error("Erro na transferência automática:", err);
        toast.warning("Período alterado, mas houve erro na transferência automática de turmas");
      }
    }

    toast.success(`Período alterado para ${periodoLabel[newPeriodo]}`);
    setParticipantes(prev => prev.map(x => x.id === p.id ? { ...x, periodo: newPeriodo as any } : x));
  };

  // Quick status change
  const handleStatusChange = async (p: Tables<"participantes">, newStatus: string) => {
    if (guardDemo(isDemo)) return;
    if (newStatus === "desligado") {
      setDesligamentoTarget(p);
      setDesligamentoMotivo("");
      setDesligamentoJustificativa("");
      setDesligamentoOpen(true);
      return;
    }
    // Direct status change for ativo/incompleto
    const { error } = await supabase.from("participantes").update({ status: newStatus } as any).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    await auditLog({ acao: "alteração de status", tabela: "participantes", registro_id: p.id, detalhes: `Status: ${p.status} → ${newStatus}` });
    toast.success(`Status alterado para ${statusLabel[newStatus]}`);
    // Optimistic update to preserve scroll position
    setParticipantes(prev => prev.map(x => x.id === p.id ? { ...x, status: newStatus as any } : x));
  };

  const handleDesligamento = async () => {
    if (!desligamentoTarget || !desligamentoMotivo) return;
    setDesligamentoSaving(true);
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("participantes").update({
      status: "desligado",
      motivo_desligamento: desligamentoMotivo,
      justificativa_desligamento: desligamentoJustificativa || null,
      data_desligamento: today,
    } as any).eq("id", desligamentoTarget.id);

    if (error) {
      toast.error(error.message);
      setDesligamentoSaving(false);
      return;
    }

    await auditLog({
      acao: "desligamento",
      tabela: "participantes",
      registro_id: desligamentoTarget.id,
      detalhes: `Motivo: ${desligamentoMotivo}. ${desligamentoJustificativa || ""}`,
      justificativa: desligamentoJustificativa || desligamentoMotivo,
    });

    // Notify educators of turmas this participant belongs to
    try {
      const { data: tps } = await supabase.from("turma_participantes")
        .select("turma_id, turmas(educador_id)")
        .eq("participante_id", desligamentoTarget.id);

      if (tps) {
        const myProfile = await supabase.from("profiles").select("id").eq("user_id", user!.id).single();
        const educadorIds = new Set<string>();
        tps.forEach((tp: any) => {
          if (tp.turmas?.educador_id && tp.turmas.educador_id !== myProfile.data?.id) {
            educadorIds.add(tp.turmas.educador_id);
          }
        });

        const recados = Array.from(educadorIds).map(edId => ({
          remetente_id: myProfile.data!.id,
          destinatario_id: edId,
          participante_id: desligamentoTarget.id,
          conteudo: `O participante ${desligamentoTarget.nome_completo} foi desligado(a). Motivo: ${desligamentoMotivo}.${desligamentoJustificativa ? ` Justificativa: ${desligamentoJustificativa}` : ""} Por favor, tome ciência desta informação.`,
        }));

        if (recados.length > 0) {
          await supabase.from("recados").insert(recados);
          toast.info(`${recados.length} educador(es) notificado(s)`);
        }
      }
    } catch {
      // non-critical
    }

    toast.success("Participante desligado!");
    setDesligamentoOpen(false);
    setDesligamentoTarget(null);
    setDesligamentoSaving(false);
    fetchData();
  };

  const pendentes = participantes.filter((p) => (p as any).status === "pendente");
  const pendentesNaoVistos = pendentes.filter((p) => !(p as any).visualizado_em);

  const clearFilters = () => {
    setStatusFilter("");
    setPeriodoFilter("");
    setBairroFilter("");
    setGeneroFilter("");
    setIdadeMin("");
    setIdadeMax("");
  };

  const handleExportXLSX = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum participante para exportar com os filtros atuais");
      return;
    }
    const bairroMap = new Map(bairros.map(b => [b.id, b.nome]));
    const rows = filtered.map(p => ({
      ...p,
      bairro_nome: p.bairro_id ? (bairroMap.get(p.bairro_id) || "") : "",
      status_label: statusLabel[p.status || ""] || p.status || "",
      periodo_label: periodoLabel[p.periodo || ""] || p.periodo || "",
      idade: p.data_nascimento ? calcAge(p.data_nascimento) : "",
    }));
    const headers = [
      { key: "nome_completo", label: "Nome Completo" },
      { key: "cpf", label: "CPF" },
      { key: "data_nascimento", label: "Data de Nascimento" },
      { key: "idade", label: "Idade" },
      { key: "genero", label: "Gênero" },
      { key: "cor_raca", label: "Cor/Raça" },
      { key: "status_label", label: "Status" },
      { key: "bairro_nome", label: "Bairro CAIA" },
      { key: "periodo_label", label: "Período" },
      { key: "escola", label: "Escola" },
      { key: "serie", label: "Série" },
      { key: "iniciou_em", label: "Iniciou em" },
      { key: "data_desligamento", label: "Data Desligamento" },
      { key: "motivo_desligamento", label: "Motivo Desligamento" },
      { key: "justificativa_desligamento", label: "Justificativa Desligamento" },
      { key: "origem_encaminhamento", label: "Origem/Encaminhamento" },
      { key: "responsavel1_nome", label: "Responsável 1" },
      { key: "vinculo_resp1", label: "Vínculo Resp. 1" },
      { key: "responsavel1_cpf", label: "CPF Resp. 1" },
      { key: "responsavel1_whatsapp", label: "WhatsApp Resp. 1" },
      { key: "responsavel2_nome", label: "Responsável 2" },
      { key: "vinculo_resp2", label: "Vínculo Resp. 2" },
      { key: "responsavel2_whatsapp", label: "WhatsApp Resp. 2" },
      { key: "endereco_rua", label: "Endereço — Rua" },
      { key: "endereco_numero", label: "Endereço — Número" },
      { key: "endereco_bairro", label: "Endereço — Bairro" },
      { key: "uf_origem", label: "UF de Origem" },
      { key: "situacao_moradia", label: "Situação de Moradia" },
      { key: "categoria_vulnerabilidade", label: "Categoria Vulnerabilidade" },
      { key: "laudo", label: "Laudo" },
      { key: "remedio_continuo", label: "Remédio Contínuo" },
      { key: "restricao_alimentar", label: "Restrição Alimentar" },
      { key: "outras_condicoes", label: "Outras Condições" },
      { key: "dias_contraturno", label: "Dias Contraturno" },
      { key: "responsavel_tecnico", label: "Responsável Técnico" },
      { key: "observacoes_sigilosas", label: "Observações Sigilosas" },
      { key: "created_at", label: "Cadastrado em" },
      { key: "updated_at", label: "Atualizado em" },
    ];
    exportXLSX(rows, headers, "Participantes");
    toast.success(`${filtered.length} participante(s) exportado(s)`);
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

      <PageHeader
        icon={<Users className="h-5 w-5" />}
        title="Participantes"
        subtitle={`${filtered.length} participante${filtered.length !== 1 ? "s" : ""}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportXLSX} disabled={loading || filtered.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Exportar XLSX
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/participantes/importar"><Upload className="h-4 w-4 mr-1" />Importar</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/participantes/novo"><Plus className="h-4 w-4 mr-1" />Novo</Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-9 text-sm"><Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="busca_ativa">Busca Ativa</SelectItem>
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
        <Select value={generoFilter} onValueChange={setGeneroFilter}>
          <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue placeholder="Gênero" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="feminino">Feminino</SelectItem>
            <SelectItem value="masculino">Masculino</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={120}
            placeholder="Idade min"
            value={idadeMin}
            onChange={(e) => setIdadeMin(e.target.value)}
            className="w-[90px] h-9 text-sm"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            max={120}
            placeholder="máx"
            value={idadeMax}
            onChange={(e) => setIdadeMax(e.target.value)}
            className="w-[80px] h-9 text-sm"
          />
        </div>
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
                    <TableCell className="text-sm text-muted-foreground">{displayAge(p.data_nascimento)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{bairroNome && BAIRROS_SCFV.includes(bairroNome) ? bairroNome : "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={p.periodo || ""}
                        onValueChange={(v) => handlePeriodoChange(p, v)}
                      >
                        <SelectTrigger className="h-6 text-[10px] w-[90px] border-0 px-1.5">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manha">Manhã</SelectItem>
                          <SelectItem value="tarde">Tarde</SelectItem>
                          <SelectItem value="integral">Integral</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={p.status || "ativo"}
                        onValueChange={(v) => handleStatusChange(p, v)}
                      >
                        <SelectTrigger className={`h-6 text-[10px] w-[100px] border-0 px-1.5 ${statusColor[p.status || "ativo"]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="busca_ativa">Busca Ativa</SelectItem>
                          <SelectItem value="desligado">Desligado</SelectItem>
                          <SelectItem value="incompleto">Incompleto</SelectItem>
                        </SelectContent>
                      </Select>
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

      {/* Desligamento Dialog */}
      <Dialog open={desligamentoOpen} onOpenChange={setDesligamentoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Desligar Participante</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Desligar <span className="font-medium text-foreground">{desligamentoTarget?.nome_completo}</span>?
              Os educadores vinculados serão notificados.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Motivo *</Label>
              <Select value={desligamentoMotivo} onValueChange={setDesligamentoMotivo}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS_DESLIGAMENTO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Justificativa (opcional)</Label>
              <Textarea
                value={desligamentoJustificativa}
                onChange={e => setDesligamentoJustificativa(e.target.value)}
                placeholder="Detalhes adicionais..."
                className="text-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDesligamentoOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!desligamentoMotivo || desligamentoSaving}
              onClick={handleDesligamento}
            >
              {desligamentoSaving ? "Processando..." : "Confirmar Desligamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ParticipantesPage;
