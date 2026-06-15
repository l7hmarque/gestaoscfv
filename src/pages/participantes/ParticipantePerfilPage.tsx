import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Save, Pencil, Printer, FileText, FileSpreadsheet, Lock, Camera, Upload, X, Plus, Check, Eye, Trash2, CheckCircle, ClipboardList, MessageCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportFichaInscricaoDocx, exportFichaInscricaoPdf, exportProntuarioPdf } from "@/hooks/useDocumentExport";
import { isBairroSCFV, calcFaixaFromDate, STATUS_LABELS, PERIODO_LABELS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentScanner, CATEGORIES, compressFileForUpload } from "@/hooks/useDocumentScanner";
import type { Tables } from "@/integrations/supabase/types";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { maskCPF, maskPhone, unmaskDigits, displayCPF, displayPhone } from "@/lib/utils";
import { SendRecadoDialog } from "@/components/SendRecadoDialog";
import { formatDataBR } from "@/lib/formatDate";

const MOTIVOS_DESLIGAMENTO = [
  "Mudança de município",
  "Mudança de bairro",
  "Idade fora da faixa",
  "Desistência voluntária",
  "Evasão / Infrequência",
  "Encaminhamento para outro serviço",
  "Situação familiar",
  "Outro",
];

const statusLabel = STATUS_LABELS;
const periodoLabel = PERIODO_LABELS;

function calcFaixaEtaria(dataNasc: string | null): string {
  if (!dataNasc) return "—";
  const age = Math.floor((Date.now() - new Date(dataNasc).getTime()) / 31557600000);
  if (age >= 6 && age <= 8) return "6-8";
  if (age >= 9 && age <= 11) return "9-11";
  if (age >= 12 && age <= 17) return "12-17";
  if (age >= 60) return "Idosos";
  return `${age} anos`;
}

function toTitleCase(str: string): string {
  const lowerWords = new Set(["de", "da", "do", "das", "dos", "e", "em", "com", "para", "por"]);
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      if (i > 0 && lowerWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

interface DocRow { id: string; categoria: string; nome_arquivo: string; arquivo_url: string; created_at: string; }

// ---- Extracted components (outside render to preserve focus) ----
const InfoField = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div><span className="text-xs text-muted-foreground">{label}</span><p className="text-sm">{value || "—"}</p></div>
);

const EditTextField = ({ label, field, type = "text", form, set }: { label: string; field: string; type?: string; form: Record<string, string>; set: (field: string, value: string) => void }) => (
  <div><Label className="text-xs">{label}</Label><Input type={type} value={form[field] || ""} onChange={(e) => set(field, e.target.value)} className="h-8 text-sm mt-0.5" /></div>
);

const ParticipantePerfilPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [participante, setParticipante] = useState<(Tables<"participantes"> & { observacoes_sigilosas?: string | null }) | null>(null);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [pontos, setPontos] = useState<Tables<"pontos_transporte">[]>([]);
  const [turmas, setTurmas] = useState<{ turma_id: string; turma_nome: string }[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [presenca30, setPresenca30] = useState<any[]>([]);
  const [estrangeiroCpf, setEstrangeiroCpf] = useState(false);
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [showAtdForm, setShowAtdForm] = useState(false);
  const [atdForm, setAtdForm] = useState({ data_atendimento: new Date().toISOString().slice(0, 10), tipo: "atendimento_individual", descricao: "", encaminhamento: "" });
  const [myProfileId, setMyProfileId] = useState("");
  // Discharge dialog
  const [showDesligDialog, setShowDesligDialog] = useState(false);
  const [desligForm, setDesligForm] = useState({ data_desligamento: new Date().toISOString().slice(0, 10), motivo_desligamento: "", justificativa_desligamento: "" });
  // Transfer dialog removido: mudanças de bairro/período/idade não realocam mais turmas automaticamente.

  const scanner = useDocumentScanner();

  useEffect(() => { fetchAll(); }, [id]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setUserRoles((data || []).map((r: any) => r.role));
    });
    supabase.from("profiles").select("id, nome, cargo, user_id").then(({ data }) => {
      setAllProfiles(data || []);
      const me = (data || []).find((p: any) => p.user_id === user.id);
      if (me) setMyProfileId(me.id);
    });
  }, [user]);

  const canSeeConfidential = userRoles.includes("tecnico") || userRoles.includes("coordenacao");
  const canDelete = userRoles.includes("coordenacao");

  const fetchAll = async () => {
    setLoading(true);
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const [{ data: p }, { data: b }, { data: pt }, { data: tp }, { data: docData }, { data: atdData }, { data: presData }] = await Promise.all([
      supabase.from("participantes").select("*").eq("id", id!).single(),
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("pontos_transporte").select("*").order("nome"),
      supabase.from("turma_participantes").select("turma_id, turmas(nome)").eq("participante_id", id!),
      supabase.from("participante_documentos" as any).select("*").eq("participante_id", id!).order("created_at", { ascending: false }),
      supabase.from("atendimentos").select("*").eq("participante_id", id!).order("data_atendimento", { ascending: false }),
      supabase.from("presenca").select("data, presente, justificativa, turma_id, turmas(nome)").eq("participante_id", id!).gte("data", thirtyDaysAgo).order("data", { ascending: false }),
    ]);
    setParticipante(p as any);
    setBairros(b || []);
    setPontos(pt || []);
    setTurmas((tp || []).map((t: any) => ({ turma_id: t.turma_id, turma_nome: t.turmas?.nome || "" })));
    setDocs((docData || []) as unknown as DocRow[]);
    setAtendimentos(atdData || []);
    setPresenca30((presData || []) as any[]);
    if (p) {
      const f: Record<string, string> = {};
      Object.entries(p).forEach(([k, v]) => { f[k] = v == null ? "" : String(v); });
      setForm(f);

      // Mark as visualized first time it's opened
      if (!(p as any).visualizado_em) {
        supabase.from("participantes").update({ visualizado_em: new Date().toISOString() } as any).eq("id", id!).then(() => {});
      }
    }
    setLoading(false);
  };

  const set = useCallback((field: string, value: string) => setForm((f) => ({ ...f, [field]: value })), []);

  const isDemo = useIsDemo();

  const handleSave = async () => {
    if (guardDemo(isDemo)) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    // Remove system fields
    delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.visualizado_em;

    // Normaliza "" → null em campos de data/timestamp/uuid (Postgres rejeita "" nesses tipos)
    const NULLABLE_EMPTY_FIELDS = [
      "bairro_id", "ponto_transporte_id",
      "data_nascimento", "iniciou_em", "data_desligamento",
      "busca_ativa_desde", "desligado_registrado_em",
    ];
    NULLABLE_EMPTY_FIELDS.forEach((k) => { if (payload[k] === "" || payload[k] === undefined || payload[k] === null) payload[k] = null; });
    if (!canSeeConfidential) delete payload.observacoes_sigilosas;

    // Apply Title Case to text fields
    const titleCaseFields = ["nome_completo", "responsavel1_nome", "responsavel2_nome", "escola", "endereco_rua", "endereco_bairro"];
    titleCaseFields.forEach((k) => {
      if (payload[k] && typeof payload[k] === "string" && (payload[k] as string).trim()) {
        payload[k] = toTitleCase(payload[k] as string);
      }
    });

    // Detectar mudanças relevantes antes de salvar
    const oldStatus = participante?.status || "ativo";
    const newStatus = form.status || "ativo";
    const oldBairro = participante?.bairro_id || null;
    const newBairro = (payload.bairro_id as string) || null;
    const oldPeriodo = participante?.periodo || null;
    const newPeriodo = (payload.periodo as string) || null;
    const oldDataNasc = participante?.data_nascimento || null;
    const newDataNasc = (payload.data_nascimento as string) || null;

    const { error } = await supabase.from("participantes").update(payload as any).eq("id", id!);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Atualizado com sucesso!");

    // Automação 1: Desligar → abrir dialog para preencher motivo/justificativa
    if (newStatus === "desligado" && oldStatus !== "desligado") {
      setDesligForm({ data_desligamento: form.data_desligamento || new Date().toISOString().slice(0, 10), motivo_desligamento: "", justificativa_desligamento: "" });
      setShowDesligDialog(true);
    }

    // Automação 2: Busca ativa → Ativo = revincular a turmas compatíveis
    if (newStatus === "ativo" && oldStatus === "busca_ativa") {
      const newFaixa = calcFaixaFromDate(newDataNasc);
      if (newBairro && newPeriodo && newFaixa) {
        let query = supabase.from("turmas").select("id").eq("ativa", true).eq("bairro_id", newBairro).eq("faixa_etaria", newFaixa as any);
        if (newPeriodo !== "integral") query = query.eq("periodo", newPeriodo as any);
        const { data: turmasCompativeis } = await query;
        if (turmasCompativeis && turmasCompativeis.length > 0) {
        const newLinks = turmasCompativeis.map(t => ({ turma_id: t.id, participante_id: id! }));
          await supabase.from("turma_participantes").upsert(newLinks, { onConflict: "turma_id,participante_id", ignoreDuplicates: true });
          toast.info(`Vinculado a ${turmasCompativeis.length} turma(s) automaticamente`);
        } else {
          toast.warning("Nenhuma turma compatível encontrada para vinculação automática");
        }
      }
    }

    // Automação 3 removida: mudanças de bairro/período/data de nascimento NÃO realocam mais turmas
    // automaticamente. A realocação deve ser feita manualmente pela coordenação para evitar
    // vínculos duplicados em chamadas. Ver mem://funcionalidades/auto-transferencia-periodo-relatorio.
    void oldBairro; void newBairro; void oldPeriodo; void newPeriodo; void oldDataNasc; void newDataNasc;

    setEditing(false);
    fetchAll();
  };

  // Document management
  const handleUploadDoc = async (categoria: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0] as File | undefined;
      if (!file) return;
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.error("Envie apenas imagem ou PDF.");
        return;
      }
      try {
        const compressed = await compressFileForUpload(file);
        const blob = await scanner.processUploadFile(compressed);
        await uploadDocBlob(blob, categoria);
      } catch (err: any) {
        toast.error(err.message || "Erro ao processar arquivo");
      }
    };
    input.click();
  };

  const uploadDocBlob = async (blob: Blob, categoria: string) => {
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}`;
    const fileName = `SysCFV_Doc_${categoria}_${ts}.pdf`;
    const storagePath = `${id}/${fileName}`;
    const { error: upErr } = await supabase.storage.from("documentos").upload(storagePath, blob, { contentType: "application/pdf" });
    if (upErr) { toast.error("Erro no upload: " + upErr.message); return; }
    await supabase.from("participante_documentos" as any).insert({
      participante_id: id,
      categoria,
      nome_arquivo: fileName,
      arquivo_url: storagePath,
    });
    toast.success("Documento salvo!");
    fetchAll();
  };

  const handleFinalizeScanProfile = async () => {
    const result = scanner.finalizeScan();
    if (!result) return;
    await uploadDocBlob(result.blob, result.categoria);
  };

  const handleViewDoc = async (doc: DocRow) => {
    const { data } = await supabase.storage.from("documentos").createSignedUrl(doc.arquivo_url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao gerar link");
  };

  const handleDeleteDoc = async (doc: DocRow) => {
    if (!confirm("Excluir este documento?")) return;
    await supabase.storage.from("documentos").remove([doc.arquivo_url]);
    await supabase.from("participante_documentos" as any).delete().eq("id", doc.id);
    toast.success("Documento excluído");
    fetchAll();
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!participante) return <div className="text-center py-12 text-muted-foreground">Participante não encontrado.</div>;

  const bairroNome = bairros.find(b => b.id === participante.bairro_id)?.nome || "—";
  const faixaEtaria = calcFaixaEtaria(participante.data_nascimento);
  const periodo = participante.periodo ? periodoLabel[participante.periodo] : "—";
  const bairrosSCFV = bairros.filter(b => isBairroSCFV(b.nome));
  const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label || v;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/participantes"><ArrowLeft className="h-4 w-4" /></Link></Button>
          {participante.foto_url && (
            <img src={participante.foto_url} alt={participante.nome_completo} className="h-14 w-14 rounded-full object-cover object-center shrink-0 border-2 border-muted" />
          )}
          <div>
            <h1 className="text-xl font-semibold text-foreground">{participante.nome_completo}</h1>
            <div className="flex gap-2 mt-0.5">
              <Badge variant="secondary" className="text-xs">{statusLabel[participante.status || "ativo"]}</Badge>
            </div>
          </div>
        </div>
        {!editing ? (
          <div className="flex gap-1">
            {/* Aprovação de matrícula pendente removida: status "pendente" não existe mais */}
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Imprimir</Button>
            <SendRecadoDialog
              paraFamilia
              participanteIdFixo={participante.id}
              trigger={
                <Button variant="outline" size="sm" className="gap-1">
                  <MessageCircle className="h-3.5 w-3.5" />Recado p/ Família
                </Button>
              }
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1"><FileText className="h-3.5 w-3.5" />Ficha</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => {
                  const pontoNome = pontos.find(p => p.id === participante!.ponto_transporte_id)?.nome || "";
                  const turmaNames = turmas.map(t => t.turma_nome).join(", ");
                  exportFichaInscricaoDocx({ ...participante, _ponto_transporte: pontoNome, _turmas_nomes: turmaNames, _bairro_scfv: bairroNome });
                }} className="text-xs gap-2"><FileSpreadsheet className="h-3.5 w-3.5" /> DOCX</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const pontoNome = pontos.find(p => p.id === participante!.ponto_transporte_id)?.nome || "";
                  const turmaNames = turmas.map(t => t.turma_nome).join(", ");
                  exportFichaInscricaoPdf({ ...participante, _ponto_transporte: pontoNome, _turmas_nomes: turmaNames, _bairro_scfv: bairroNome }).catch(() => {});
                }} className="text-xs gap-2"><FileText className="h-3.5 w-3.5" /> PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-3.5 w-3.5 mr-1" />{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        )}
      </div>

      {/* Destaque SCFV */}
      <div className="flex gap-2 flex-wrap">
        <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-xs px-3 py-1">{bairroNome}</Badge>
        <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-xs px-3 py-1">Faixa: {faixaEtaria}</Badge>
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs px-3 py-1">{periodo}</Badge>
      </div>

      {turmas.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {turmas.map((t) => <Badge key={t.turma_id} variant="secondary" className="text-xs">{t.turma_nome}</Badge>)}
        </div>
      )}

      <div className="grid gap-4">
        {/* Dados Pessoais */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {editing ? (
              <>
                <div className="col-span-2"><EditTextField label="Nome Completo" field="nome_completo" form={form} set={set} /></div>
                <EditTextField label="Data Nascimento" field="data_nascimento" type="date" form={form} set={set} />
                <div><Label className="text-xs">Gênero</Label>
                  <Select value={form.genero || ""} onValueChange={(v) => set("genero", v)}>
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="masculino">Masculino</SelectItem><SelectItem value="feminino">Feminino</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Cor/Raça</Label>
                  <Select value={form.cor_raca || ""} onValueChange={(v) => set("cor_raca", v)}>
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="branca">Branca</SelectItem><SelectItem value="preta">Preta</SelectItem><SelectItem value="parda">Parda</SelectItem><SelectItem value="amarela">Amarela</SelectItem><SelectItem value="indigena">Indígena</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Período</Label>
                  <Select value={form.periodo || "manha"} onValueChange={(v) => set("periodo", v)}>
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="manha">Manhã</SelectItem><SelectItem value="tarde">Tarde</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Bairro do CAIA</Label>
                  <Select value={form.bairro_id || ""} onValueChange={(v) => {
                    set("bairro_id", v);
                    if (form.ponto_transporte_id) {
                      const ponto = pontos.find(p => p.id === form.ponto_transporte_id);
                      if (ponto && ponto.bairro_id !== v) set("ponto_transporte_id", "");
                    }
                  }}>
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{bairrosSCFV.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Status</Label>
                  <Select value={form.status || "ativo"} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="busca_ativa">Busca Ativa</SelectItem><SelectItem value="desligado">Desligado</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <InfoField label="Nome" value={participante.nome_completo} />
                <InfoField label="Data de Nascimento" value={formatDataBR(participante.data_nascimento)} />
                <InfoField label="Gênero" value={participante.genero} />
                <InfoField label="Cor/Raça" value={participante.cor_raca} />
                <InfoField label="Período" value={participante.periodo ? periodoLabel[participante.periodo] : null} />
                <InfoField label="Escola" value={participante.escola} />
                <InfoField label="Série" value={participante.serie} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Endereço</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {editing ? (
              <><EditTextField label="Rua" field="endereco_rua" form={form} set={set} /><EditTextField label="Número" field="endereco_numero" form={form} set={set} /><EditTextField label="Bairro" field="endereco_bairro" form={form} set={set} /><EditTextField label="UF Origem" field="uf_origem" form={form} set={set} /><EditTextField label="Sit. Moradia" field="situacao_moradia" form={form} set={set} /></>
            ) : (
              <><InfoField label="Rua" value={participante.endereco_rua} /><InfoField label="Número" value={participante.endereco_numero} /><InfoField label="Bairro" value={participante.endereco_bairro} /><InfoField label="UF Origem" value={participante.uf_origem} /><InfoField label="Sit. Moradia" value={participante.situacao_moradia} /></>
            )}
          </CardContent>
        </Card>

        {/* Responsáveis */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Responsáveis</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {editing ? (
              <>
                <EditTextField label="Resp. 1 Nome" field="responsavel1_nome" form={form} set={set} />
                <EditTextField label="Vínculo Resp. 1" field="vinculo_resp1" form={form} set={set} />
                <div>
                  <Label className="text-xs">CPF do Participante</Label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Input value={estrangeiroCpf ? (form.cpf || "") : maskCPF(form.cpf || "")} onChange={(e) => set("cpf", estrangeiroCpf ? e.target.value : unmaskDigits(e.target.value))} className="h-8 text-sm" placeholder={estrangeiroCpf ? "Documento" : "000.000.000-00"} />
                  </div>
                  <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                    <input type="checkbox" checked={estrangeiroCpf} onChange={(e) => setEstrangeiroCpf(e.target.checked)} className="h-3 w-3" />
                    <span className="text-[10px] text-muted-foreground">Estrangeiro/Sem CPF</span>
                  </label>
                </div>
                <div><Label className="text-xs">WhatsApp</Label><Input value={maskPhone(form.responsavel1_whatsapp || "")} onChange={(e) => set("responsavel1_whatsapp", unmaskDigits(e.target.value))} className="h-8 text-sm mt-0.5" placeholder="(00) 00000-0000" /></div>
                <EditTextField label="Resp. 2 Nome" field="responsavel2_nome" form={form} set={set} />
                <EditTextField label="Vínculo Resp. 2" field="vinculo_resp2" form={form} set={set} />
                <div><Label className="text-xs">WhatsApp 2</Label><Input value={maskPhone(form.responsavel2_whatsapp || "")} onChange={(e) => set("responsavel2_whatsapp", unmaskDigits(e.target.value))} className="h-8 text-sm mt-0.5" placeholder="(00) 00000-0000" /></div>
              </>
            ) : (
              <><InfoField label="Resp. 1" value={participante.responsavel1_nome} /><InfoField label="Vínculo" value={(participante as any).vinculo_resp1} /><InfoField label="CPF" value={displayCPF((participante as any).cpf)} /><InfoField label="WhatsApp" value={displayPhone(participante.responsavel1_whatsapp)} /><InfoField label="Resp. 2" value={participante.responsavel2_nome} /><InfoField label="Vínculo" value={(participante as any).vinculo_resp2} /><InfoField label="WhatsApp 2" value={displayPhone(participante.responsavel2_whatsapp)} /></>
            )}
          </CardContent>
        </Card>

        {/* Complementar */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Complementar</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {editing ? (
              <>
                <EditTextField label="Escola" field="escola" form={form} set={set} /><EditTextField label="Série" field="serie" form={form} set={set} /><EditTextField label="Origem" field="origem_encaminhamento" form={form} set={set} />
                <EditTextField label="Resp. Técnico" field="responsavel_tecnico" form={form} set={set} /><EditTextField label="Vulnerabilidade" field="categoria_vulnerabilidade" form={form} set={set} /><EditTextField label="Início SCFV" field="iniciou_em" type="date" form={form} set={set} />
                <EditTextField label="Data Desligamento" field="data_desligamento" type="date" form={form} set={set} /><EditTextField label="Dias Contraturno" field="dias_contraturno" form={form} set={set} />
                <EditTextField label="Remédio Contínuo" field="remedio_continuo" form={form} set={set} />
                <div className="col-span-2 sm:col-span-3"><Label className="text-xs">Restrição Alimentar</Label><Textarea value={form.restricao_alimentar || ""} onChange={(e) => set("restricao_alimentar", e.target.value)} className="text-sm mt-0.5 min-h-[50px]" /></div>
                <div className="col-span-2 sm:col-span-3"><Label className="text-xs">Laudo</Label><Textarea value={form.laudo || ""} onChange={(e) => set("laudo", e.target.value)} className="text-sm mt-0.5 min-h-[50px]" /></div>
                <div className="col-span-2 sm:col-span-3"><Label className="text-xs">Outras Condições de Saúde</Label><Textarea value={form.outras_condicoes || ""} onChange={(e) => set("outras_condicoes", e.target.value)} className="text-sm mt-0.5 min-h-[50px]" /></div>
              </>
            ) : (
              <>
                <InfoField label="Origem" value={participante.origem_encaminhamento} /><InfoField label="Resp. Técnico" value={participante.responsavel_tecnico} />
                <InfoField label="Vulnerabilidade" value={participante.categoria_vulnerabilidade} /><InfoField label="Início SCFV" value={formatDataBR(participante.iniciou_em)} />
                <InfoField label="Data Desligamento" value={formatDataBR((participante as any).data_desligamento)} /><InfoField label="Dias Contraturno" value={(participante as any).dias_contraturno} />
                <InfoField label="Restrição Alimentar" value={participante.restricao_alimentar} /><InfoField label="Laudo" value={participante.laudo} />
                <InfoField label="Remédio Contínuo" value={(participante as any).remedio_continuo} /><InfoField label="Outras Condições" value={(participante as any).outras_condicoes} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Documentos */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Documentos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Scan session */}
            {scanner.scanSession && (
              <div className="border-2 border-primary/50 rounded-lg p-4 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Escaneando: {catLabel(scanner.scanSession.categoria)}</p>
                  <Badge variant="secondary">{scanner.scanSession.pages.length} página(s)</Badge>
                </div>
                {scanner.scanSession.pages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {scanner.scanSession.pages.map((page, i) => (
                      <div key={i} className="relative group w-16 h-20 border rounded overflow-hidden">
                        <img src={page.dataUrl} alt={`Página ${i+1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => scanner.removePageFromScan(i)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3" />
                        </button>
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center">{i+1}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={scanner.addPageToScan}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar Página</Button>
                  {scanner.scanSession.pages.length > 0 && (
                    <Button type="button" size="sm" onClick={handleFinalizeScanProfile}><Check className="h-3.5 w-3.5 mr-1" />Finalizar Scan</Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={scanner.cancelScan}>Cancelar</Button>
                </div>
              </div>
            )}

            {/* Categories with docs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => {
                const catDocs = docs.filter(d => d.categoria === cat.value);
                return (
                  <div key={cat.value} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{cat.label}</span>
                      {catDocs.length > 0 && <Badge variant="secondary" className="text-[10px]">{catDocs.length}</Badge>}
                    </div>
                    <div className="flex gap-1.5">
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => scanner.startScan(cat.value)} disabled={!!scanner.scanSession}>
                        <Camera className="h-3 w-3 mr-1" />Escanear
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => handleUploadDoc(cat.value)} disabled={!!scanner.scanSession}>
                        <Upload className="h-3 w-3 mr-1" />Upload
                      </Button>
                    </div>
                    {catDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 bg-muted/50 rounded p-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] truncate flex-1">{doc.nome_arquivo}</span>
                        <button type="button" onClick={() => handleViewDoc(doc)} className="text-primary hover:text-primary/80" title="Visualizar">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {canDelete && (
                          <button type="button" onClick={() => handleDeleteDoc(doc)} className="text-destructive hover:text-destructive/80" title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Hidden scan input */}
            <input ref={scanner.scanInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={scanner.handleScanCapture} />
          </CardContent>
        </Card>

        {/* Prontuário Técnico */}
        {canSeeConfidential && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" /> Prontuário Técnico
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => exportProntuarioPdf(participante, atendimentos, allProfiles, bairros)}>
                    <FileText className="h-3 w-3" />Exportar PDF
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setShowAtdForm(!showAtdForm)}>
                    <Plus className="h-3 w-3" />{showAtdForm ? "Cancelar" : "Novo Atendimento"}
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Visível apenas para equipe técnica e coordenação</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {showAtdForm && (
                <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Data</Label><Input type="date" value={atdForm.data_atendimento} onChange={e => setAtdForm(f => ({ ...f, data_atendimento: e.target.value }))} className="h-8 text-sm mt-0.5" /></div>
                    <div><Label className="text-xs">Tipo</Label>
                      <Select value={atdForm.tipo} onValueChange={v => setAtdForm(f => ({ ...f, tipo: v }))}>
                        <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="visita_domiciliar">Visita Domiciliar</SelectItem>
                          <SelectItem value="atendimento_individual">Atend. Individual</SelectItem>
                          <SelectItem value="atendimento_familiar">Atend. Familiar</SelectItem>
                          <SelectItem value="encaminhamento">Encaminhamento</SelectItem>
                          <SelectItem value="busca_ativa">Busca Ativa</SelectItem>
                          <SelectItem value="acolhida">Acolhida</SelectItem>
                          <SelectItem value="desligamento">Desligamento</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label className="text-xs">Descrição</Label><Textarea value={atdForm.descricao} onChange={e => setAtdForm(f => ({ ...f, descricao: e.target.value }))} className="text-sm mt-0.5 min-h-[80px]" /></div>
                  <div><Label className="text-xs">Encaminhamento (opcional)</Label><Textarea value={atdForm.encaminhamento} onChange={e => setAtdForm(f => ({ ...f, encaminhamento: e.target.value }))} className="text-sm mt-0.5 min-h-[50px]" /></div>
                  <Button size="sm" onClick={async () => {
                    if (guardDemo(isDemo)) return;
                    if (!atdForm.descricao.trim()) { toast.error("Preencha a descrição"); return; }
                    const { error } = await supabase.from("atendimentos").insert({
                      participante_id: id,
                      profissional_id: myProfileId,
                      data_atendimento: atdForm.data_atendimento,
                      tipo: atdForm.tipo,
                      descricao: atdForm.descricao,
                      encaminhamento: atdForm.encaminhamento || null,
                    } as any);
                    if (error) { toast.error("Erro: " + error.message); return; }
                    toast.success("Atendimento registrado!");
                    setShowAtdForm(false);
                    setAtdForm({ data_atendimento: new Date().toISOString().slice(0, 10), tipo: "atendimento_individual", descricao: "", encaminhamento: "" });
                    fetchAll();
                  }}>Salvar Atendimento</Button>
                </div>
              )}

              {atendimentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum atendimento registrado</p>
              ) : atendimentos.map(a => (
                <div key={a.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{a.tipo.replace(/_/g, " ")}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDataBR(a.data_atendimento)}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{allProfiles.find(p => p.id === a.profissional_id)?.nome || "—"}</span>
                  </div>
                  <p className="text-sm">{a.descricao}</p>
                  {a.encaminhamento && <p className="text-xs text-muted-foreground">📋 Encaminhamento: {a.encaminhamento}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Frequência (últimos 30 dias) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Frequência (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {presenca30.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem registros de presença nos últimos 30 dias</p>
            ) : (
              <>
                {(() => {
                  const tot = presenca30.length;
                  const pres = presenca30.filter(r => r.presente).length;
                  const pct = tot > 0 ? Math.round((pres / tot) * 100) : 0;
                  return (
                    <div className="flex items-center gap-3 mb-3 text-xs">
                      <Badge variant="secondary">{pres} presenças / {tot} registros</Badge>
                      <Badge variant={pct >= 80 ? "default" : pct >= 65 ? "secondary" : "destructive"}>{pct}% adesão</Badge>
                    </div>
                  );
                })()}
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {presenca30.map((r, i) => (
                    <div key={i} className="flex items-center justify-between border-b py-1.5 text-xs">
                      <span className="font-medium">{r.data}</span>
                      <span className="flex-1 mx-2 text-muted-foreground truncate">{r.turmas?.nome || "—"}</span>
                      <Badge variant={r.presente ? "default" : "destructive"} className="text-[10px]">{r.presente ? "Presente" : "Ausente"}</Badge>
                      {!r.presente && r.justificativa && <span className="ml-2 text-[10px] text-muted-foreground italic max-w-[150px] truncate">{r.justificativa}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {canSeeConfidential && (
          <Card className="border-destructive/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                <Lock className="h-4 w-4" /> Observações Sigilosas
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">Visível apenas para equipe técnica e coordenação</p>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  value={form.observacoes_sigilosas || ""}
                  onChange={(e) => set("observacoes_sigilosas", e.target.value)}
                  placeholder="Registre aqui observações sigilosas sobre o participante..."
                  className="text-sm min-h-[100px] border-destructive/30"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{(participante as any).observacoes_sigilosas || "Nenhuma observação registrada."}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Discharge Dialog */}
      <Dialog open={showDesligDialog} onOpenChange={setShowDesligDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-base">Desligamento do Participante</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Data de Desligamento *</Label><Input type="date" value={desligForm.data_desligamento} onChange={e => setDesligForm(f => ({ ...f, data_desligamento: e.target.value }))} className="h-8 text-sm mt-0.5" /></div>
            <div><Label className="text-xs">Motivo *</Label>
              <Select value={desligForm.motivo_desligamento} onValueChange={v => setDesligForm(f => ({ ...f, motivo_desligamento: v }))}>
                <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="Selecione o motivo..." /></SelectTrigger>
                <SelectContent>{MOTIVOS_DESLIGAMENTO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Justificativa (opcional)</Label><Textarea value={desligForm.justificativa_desligamento} onChange={e => setDesligForm(f => ({ ...f, justificativa_desligamento: e.target.value }))} className="text-sm mt-0.5 min-h-[60px]" placeholder="Detalhes adicionais..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDesligDialog(false)}>Cancelar</Button>
            <Button size="sm" disabled={!desligForm.data_desligamento || !desligForm.motivo_desligamento} onClick={async () => {
              await supabase.from("participantes").update({
                data_desligamento: desligForm.data_desligamento,
                motivo_desligamento: desligForm.motivo_desligamento,
                justificativa_desligamento: desligForm.justificativa_desligamento || null,
              } as any).eq("id", id!);
              toast.success("Desligamento registrado. Participante permanece na turma como desligado.");
              setShowDesligDialog(false);
              fetchAll();
            }}>Confirmar Desligamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      {/* Transfer Dialog removido — realocação de turmas agora é manual via coordenação. */}
    </div>
  );
};

export default ParticipantePerfilPage;
