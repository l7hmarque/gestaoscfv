import { useState, useEffect } from "react";
import { ArrowLeft, Save, Pencil, Printer, FileText, FileSpreadsheet, Lock, Camera, Upload, X, Plus, Check, Eye, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportFichaInscricaoDocx, exportFichaInscricaoPdf } from "@/hooks/useDocumentExport";
import { isBairroSCFV, calcFaixaFromDate } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentScanner, CATEGORIES } from "@/hooks/useDocumentScanner";
import type { Tables } from "@/integrations/supabase/types";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";

const statusLabel: Record<string, string> = { ativo: "Ativo", desligado: "Desligado", incompleto: "Incompleto", pendente: "Pendente" };
const periodoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };

function calcFaixaEtaria(dataNasc: string | null): string {
  if (!dataNasc) return "—";
  const age = Math.floor((Date.now() - new Date(dataNasc).getTime()) / 31557600000);
  if (age >= 6 && age <= 8) return "6-8";
  if (age >= 9 && age <= 11) return "9-11";
  if (age >= 12 && age <= 17) return "12-17";
  if (age >= 60) return "Idosos";
  return `${age} anos`;
}

interface DocRow { id: string; categoria: string; nome_arquivo: string; arquivo_url: string; created_at: string; }

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

  const scanner = useDocumentScanner();

  useEffect(() => { fetchAll(); }, [id]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setUserRoles((data || []).map((r: any) => r.role));
    });
  }, [user]);

  const canSeeConfidential = userRoles.includes("tecnico") || userRoles.includes("coordenacao");
  const canDelete = userRoles.includes("coordenacao");

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: p }, { data: b }, { data: pt }, { data: tp }, { data: docData }] = await Promise.all([
      supabase.from("participantes").select("*").eq("id", id!).single(),
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("pontos_transporte").select("*").order("nome"),
      supabase.from("turma_participantes").select("turma_id, turmas(nome)").eq("participante_id", id!),
      supabase.from("participante_documentos" as any).select("*").eq("participante_id", id!).order("created_at", { ascending: false }),
    ]);
    setParticipante(p as any);
    setBairros(b || []);
    setPontos(pt || []);
    setTurmas((tp || []).map((t: any) => ({ turma_id: t.turma_id, turma_nome: t.turmas?.nome || "" })));
    setDocs((docData || []) as unknown as DocRow[]);
    if (p) {
      const f: Record<string, string> = {};
      Object.entries(p).forEach(([k, v]) => { f[k] = v == null ? "" : String(v); });
      setForm(f);
    }
    setLoading(false);
  };

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const isDemo = useIsDemo();

  const handleSave = async () => {
    if (guardDemo(isDemo)) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    ["bairro_id", "ponto_transporte_id", "data_nascimento", "iniciou_em"].forEach((k) => { if (!payload[k]) payload[k] = null; });
    if (!canSeeConfidential) delete payload.observacoes_sigilosas;

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

    // Automação 1: Desligar → remover de turmas
    if (newStatus === "desligado" && oldStatus !== "desligado") {
      const { data: links } = await supabase.from("turma_participantes").select("id").eq("participante_id", id!);
      if (links && links.length > 0) {
        await supabase.from("turma_participantes").delete().eq("participante_id", id!);
        toast.info(`Removido de ${links.length} turma(s) automaticamente`);
      }
    }

    // Automação 3: Realocar turmas se bairro/período/idade mudaram e está ativo
    if (newStatus === "ativo" && oldStatus === "ativo") {
      const oldFaixa = calcFaixaFromDate(oldDataNasc);
      const newFaixa = calcFaixaFromDate(newDataNasc);
      const changed = oldBairro !== newBairro || oldPeriodo !== newPeriodo || oldFaixa !== newFaixa;

      if (changed && newBairro && newPeriodo && newFaixa) {
        // Remover vínculos antigos
        await supabase.from("turma_participantes").delete().eq("participante_id", id!);

        // Buscar turmas compatíveis
        let query = supabase.from("turmas").select("id").eq("ativa", true).eq("bairro_id", newBairro).eq("faixa_etaria", newFaixa as any);
        if (newPeriodo !== "integral") query = query.eq("periodo", newPeriodo as any);

        const { data: turmasCompativeis } = await query;
        if (turmasCompativeis && turmasCompativeis.length > 0) {
          const newLinks = turmasCompativeis.map(t => ({ turma_id: t.id, participante_id: id! }));
          await supabase.from("turma_participantes").insert(newLinks);
          toast.info(`Realocado para ${turmasCompativeis.length} turma(s) compatível(is)`);
        } else {
          toast.warning("Nenhuma turma compatível encontrada para os novos dados");
        }
      }
    }

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
      const blob = await scanner.processUploadFile(file);
      await uploadDocBlob(blob, categoria);
    };
    input.click();
  };

  const uploadDocBlob = async (blob: Blob, categoria: string) => {
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}`;
    const fileName = `SysELO_Doc_${categoria}_${ts}.pdf`;
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

  const Info = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div><span className="text-xs text-muted-foreground">{label}</span><p className="text-sm">{value || "—"}</p></div>
  );

  const EditField = ({ label, field, type = "text" }: { label: string; field: string; type?: string }) => (
    <div><Label className="text-xs">{label}</Label><Input type={type} value={form[field] || ""} onChange={(e) => set(field, e.target.value)} className="h-8 text-sm mt-0.5" /></div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild><Link to="/participantes"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{participante.nome_completo}</h1>
            <div className="flex gap-2 mt-0.5">
              <Badge variant="secondary" className="text-xs">{statusLabel[participante.status || "ativo"]}</Badge>
            </div>
          </div>
        </div>
        {!editing ? (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Imprimir</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1"><FileText className="h-3.5 w-3.5" />Ficha</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportFichaInscricaoDocx(participante)} className="text-xs gap-2"><FileSpreadsheet className="h-3.5 w-3.5" /> DOCX</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportFichaInscricaoPdf(participante).catch(() => {})} className="text-xs gap-2"><FileText className="h-3.5 w-3.5" /> PDF</DropdownMenuItem>
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
                <div className="col-span-2"><EditField label="Nome Completo" field="nome_completo" /></div>
                <EditField label="Data Nascimento" field="data_nascimento" type="date" />
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
                    <SelectContent><SelectItem value="manha">Manhã</SelectItem><SelectItem value="tarde">Tarde</SelectItem><SelectItem value="integral">Integral</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Bairro SCFV</Label>
                  <Select value={form.bairro_id || ""} onValueChange={(v) => {
                    set("bairro_id", v);
                    // Limpar ponto se não pertence ao novo bairro
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
                    <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="desligado">Desligado</SelectItem><SelectItem value="incompleto">Incompleto</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <Info label="Nome" value={participante.nome_completo} />
                <Info label="Data de Nascimento" value={participante.data_nascimento} />
                <Info label="Gênero" value={participante.genero} />
                <Info label="Cor/Raça" value={participante.cor_raca} />
                <Info label="Período" value={participante.periodo ? periodoLabel[participante.periodo] : null} />
                <Info label="Escola" value={participante.escola} />
                <Info label="Série" value={participante.serie} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Endereço</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {editing ? (
              <><EditField label="Rua" field="endereco_rua" /><EditField label="Número" field="endereco_numero" /><EditField label="Bairro" field="endereco_bairro" /><EditField label="UF Origem" field="uf_origem" /><EditField label="Sit. Moradia" field="situacao_moradia" /></>
            ) : (
              <><Info label="Rua" value={participante.endereco_rua} /><Info label="Número" value={participante.endereco_numero} /><Info label="Bairro" value={participante.endereco_bairro} /><Info label="UF Origem" value={participante.uf_origem} /><Info label="Sit. Moradia" value={participante.situacao_moradia} /></>
            )}
          </CardContent>
        </Card>

        {/* Responsáveis */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Responsáveis</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {editing ? (
              <><EditField label="Resp. 1 Nome" field="responsavel1_nome" /><EditField label="CPF" field="responsavel1_cpf" /><EditField label="WhatsApp" field="responsavel1_whatsapp" /><EditField label="Resp. 2 Nome" field="responsavel2_nome" /><EditField label="WhatsApp 2" field="responsavel2_whatsapp" /></>
            ) : (
              <><Info label="Resp. 1" value={participante.responsavel1_nome} /><Info label="CPF" value={participante.responsavel1_cpf} /><Info label="WhatsApp" value={participante.responsavel1_whatsapp} /><Info label="Resp. 2" value={participante.responsavel2_nome} /><Info label="WhatsApp 2" value={participante.responsavel2_whatsapp} /></>
            )}
          </CardContent>
        </Card>

        {/* Complementar */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Complementar</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {editing ? (
              <>
                <EditField label="Escola" field="escola" /><EditField label="Série" field="serie" /><EditField label="Origem" field="origem_encaminhamento" />
                <EditField label="Resp. Técnico" field="responsavel_tecnico" /><EditField label="Vulnerabilidade" field="categoria_vulnerabilidade" /><EditField label="Início SCFV" field="iniciou_em" type="date" />
                <div className="col-span-2 sm:col-span-3"><Label className="text-xs">Restrição Alimentar</Label><Textarea value={form.restricao_alimentar || ""} onChange={(e) => set("restricao_alimentar", e.target.value)} className="text-sm mt-0.5 min-h-[50px]" /></div>
                <div className="col-span-2 sm:col-span-3"><Label className="text-xs">Laudo</Label><Textarea value={form.laudo || ""} onChange={(e) => set("laudo", e.target.value)} className="text-sm mt-0.5 min-h-[50px]" /></div>
              </>
            ) : (
              <>
                <Info label="Origem" value={participante.origem_encaminhamento} /><Info label="Resp. Técnico" value={participante.responsavel_tecnico} />
                <Info label="Vulnerabilidade" value={participante.categoria_vulnerabilidade} /><Info label="Início SCFV" value={participante.iniciou_em} />
                <Info label="Restrição Alimentar" value={participante.restricao_alimentar} /><Info label="Laudo" value={participante.laudo} />
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

        {/* Seção Sigilosa */}
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
    </div>
  );
};

export default ParticipantePerfilPage;
