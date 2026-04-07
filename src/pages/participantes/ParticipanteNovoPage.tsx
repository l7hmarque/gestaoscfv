import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Save, Upload, Camera, X, FileText, Image, Plus, Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useDocumentScanner, CATEGORIES, compressFileForUpload } from "@/hooks/useDocumentScanner";
import { isBairroSCFV, calcFaixaFromDate } from "@/lib/constants";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { maskCPF, maskPhone, unmaskDigits } from "@/lib/utils";

interface PendingDoc {
  blob: Blob;
  categoria: string;
  fileName: string;
  pageCount: number;
}

const ParticipanteNovoPage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [pontos, setPontos] = useState<Tables<"pontos_transporte">[]>([]);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [estrangeiroCpf, setEstrangeiroCpf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const scanner = useDocumentScanner();

  const [form, setForm] = useState({
    nome_completo: "", data_nascimento: "", genero: "", cor_raca: "",
    escola: "", serie: "", periodo: "manha" as string,
    endereco_rua: "", endereco_numero: "", endereco_bairro: "",
    bairro_id: "", ponto_transporte_id: "",
    responsavel1_nome: "", responsavel1_cpf: "", responsavel1_whatsapp: "",
    vinculo_resp1: "",
    responsavel2_nome: "", responsavel2_whatsapp: "",
    vinculo_resp2: "",
    origem_encaminhamento: "", responsavel_tecnico: "",
    categoria_vulnerabilidade: "", situacao_moradia: "", uf_origem: "",
    restricao_alimentar: "", laudo: "", iniciou_em: "",
    remedio_continuo: "", outras_condicoes: "",
  });

  useEffect(() => {
    Promise.all([
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("pontos_transporte").select("*").order("nome"),
    ]).then(([{ data: b }, { data: p }]) => {
      setBairros(b || []);
      setPontos(p || []);
    });
  }, []);

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleFotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleUploadFile = async (categoria: string) => {
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
        const now = new Date();
        const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}`;
        // Replace existing doc of same category
        setPendingDocs(prev => [...prev.filter(d => d.categoria !== categoria), {
          blob,
          categoria,
          fileName: `SysELO_Doc_${categoria}_${ts}.pdf`,
          pageCount: 1,
        }]);
        toast.success("Documento adicionado!");
      } catch (err: any) {
        toast.error(err.message || "Erro ao processar arquivo");
      }
    };
    input.click();
  };

  const handleFinalizeScan = () => {
    const result = scanner.finalizeScan();
    if (!result) return;
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}`;
    setPendingDocs(prev => [...prev, {
      blob: result.blob,
      categoria: result.categoria,
      fileName: `SysELO_Doc_${result.categoria}_${ts}.pdf`,
      pageCount: scanner.scanSession?.pages.length || 1,
    }]);
    toast.success("Scan finalizado!");
  };

  const removePendingDoc = (index: number) => setPendingDocs(prev => prev.filter((_, i) => i !== index));

  const isDemo = useIsDemo();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardDemo(isDemo)) return;
    if (!form.nome_completo.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);

    try {
      const payload: Record<string, unknown> = { ...form, nome_completo: form.nome_completo.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") };
      // Map CPF field: form uses responsavel1_cpf key but it's actually the participant's CPF
      if (payload.responsavel1_cpf) {
        payload.cpf = payload.responsavel1_cpf;
        delete payload.responsavel1_cpf;
      }
      if (!payload.bairro_id) delete payload.bairro_id;
      if (!payload.ponto_transporte_id) delete payload.ponto_transporte_id;
      if (!payload.data_nascimento) delete payload.data_nascimento;
      if (!payload.iniciou_em) delete payload.iniciou_em;

      if (fotoFile) {
        const ext = fotoFile.name.split(".").pop();
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("fotos-participantes").upload(path, fotoFile);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("fotos-participantes").getPublicUrl(path);
          payload.foto_url = urlData.publicUrl;
        }
      }

      const { data: inserted, error } = await supabase.from("participantes").insert(payload as any).select().single();
      if (error) throw error;

      // Upload categorized documents
      if (inserted && pendingDocs.length > 0) {
        for (const doc of pendingDocs) {
          const storagePath = `${inserted.id}/${doc.fileName}`;
          const { error: upErr } = await supabase.storage.from("documentos").upload(storagePath, doc.blob, { contentType: "application/pdf" });
          if (!upErr) {
            await supabase.from("participante_documentos" as any).insert({
              participante_id: inserted.id,
              categoria: doc.categoria,
              nome_arquivo: doc.fileName,
              arquivo_url: storagePath,
            });
          }
        }
      }

      // Auto-vincular a turmas compatíveis
      if (inserted && (inserted.status === "ativo" || !inserted.status)) {
        try {
          const faixa = calcFaixaFromDate(inserted.data_nascimento);
          if (inserted.bairro_id && inserted.periodo && faixa) {
            let query = supabase.from("turmas").select("id")
              .eq("ativa", true)
              .eq("bairro_id", inserted.bairro_id)
              .eq("faixa_etaria", faixa as any);

            if (inserted.periodo !== "integral") {
              query = query.eq("periodo", inserted.periodo as any);
            }

            const { data: turmasCompativeis } = await query;
            if (turmasCompativeis && turmasCompativeis.length > 0) {
              const links = turmasCompativeis.map(t => ({ turma_id: t.id, participante_id: inserted.id }));
              await supabase.from("turma_participantes").insert(links);
              toast.success(`Vinculado automaticamente a ${turmasCompativeis.length} turma(s)`);
            }
          }
        } catch { /* silently ignore linking errors */ }
      }

      toast.success("Participante cadastrado!");
      navigate("/participantes");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (label: string, field: string, type = "text", placeholder = "", half = false) => (
    <div className={half ? "col-span-1" : "col-span-2"} key={field}>
      <Label className="text-xs font-medium">{label}</Label>
      <Input type={type} value={(form as any)[field]} onChange={(e) => set(field, e.target.value)} placeholder={placeholder} className="h-9 text-sm mt-1"
    </div>
  );

  const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label || v;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/participantes"><ArrowLeft className="h-4 w-4"</Link></Button>
        <h1 className="text-xl font-semibold text-foreground">Novo Participante</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Foto de Perfil */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Foto de Perfil</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
              {fotoPreview ? <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" : <Image className="h-8 w-8 text-muted-foreground"}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5 mr-1"Selecionar Foto</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}><Camera className="h-3.5 w-3.5 mr-1"Câmera</Button>
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG. Máx 5MB.</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoSelect} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoSelect} />
            </div>
          </CardContent>
        </Card>

        {/* Dados Pessoais */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-medium">Nome Completo *</Label>
              <Input value={form.nome_completo} onChange={(e) => set("nome_completo", e.target.value)} placeholder="Nome completo do participante" className="h-9 text-sm mt-1" required />
            </div>
            {renderField("Data de Nascimento", "data_nascimento", "date", "", true)}
            <div>
              <Label className="text-xs font-medium">Gênero</Label>
              <Select value={form.genero} onValueChange={(v) => set("genero", v)}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent><SelectItem value="masculino">Masculino</SelectItem><SelectItem value="feminino">Feminino</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Cor/Raça</Label>
              <Select value={form.cor_raca} onValueChange={(v) => set("cor_raca", v)}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent><SelectItem value="branca">Branca</SelectItem><SelectItem value="preta">Preta</SelectItem><SelectItem value="parda">Parda</SelectItem><SelectItem value="amarela">Amarela</SelectItem><SelectItem value="indigena">Indígena</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Período</Label>
              <Select value={form.periodo} onValueChange={(v) => set("periodo", v)}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="manha">Manhã</SelectItem><SelectItem value="tarde">Tarde</SelectItem><SelectItem value="integral">Integral</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Escola */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Escolaridade</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {renderField("Escola", "escola", "text", "Nome da escola", true)}
            {renderField("Série/Ano", "serie", "text", "Ex: 5º ano", true)}
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Endereço</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {renderField("Rua", "endereco_rua", "text", "Nome da rua")}
            {renderField("Número", "endereco_numero", "text", "Nº", true)}
            {renderField("Bairro (texto)", "endereco_bairro", "text", "Bairro", true)}
            <div>
              <Label className="text-xs font-medium">Bairro do CAIA que vai frequentar</Label>
              <Select value={form.bairro_id} onValueChange={(v) => {
                set("bairro_id", v);
                if (form.ponto_transporte_id) {
                  const ponto = pontos.find(p => p.id === form.ponto_transporte_id);
                  if (ponto && ponto.bairro_id !== v) set("ponto_transporte_id", "");
                }
              }}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{bairros.filter(b => isBairroSCFV(b.nome)).map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Ponto de Transporte</Label>
              <Select value={form.ponto_transporte_id} onValueChange={(v) => set("ponto_transporte_id", v)}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{pontos.filter(p => !form.bairro_id || p.bairro_id === form.bairro_id).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {renderField("UF de Origem", "uf_origem", "text", "Ex: PR", true)}
            {renderField("Situação de Moradia", "situacao_moradia", "text", "Própria, alugada...", true)}
          </CardContent>
        </Card>

        {/* Responsáveis */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Responsáveis</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {renderField("Responsável 1 - Nome", "responsavel1_nome", "text", "Nome completo")}
            {renderField("Vínculo com o participante", "vinculo_resp1", "text", "Ex: Mãe, Pai, Avó", true)}
            <div className="col-span-1">
              <Label className="text-xs font-medium">CPF do Participante</Label>
              <Input value={estrangeiroCpf ? form.responsavel1_cpf : maskCPF(form.responsavel1_cpf)} onChange={(e) => set("responsavel1_cpf", estrangeiroCpf ? e.target.value : unmaskDigits(e.target.value))} placeholder={estrangeiroCpf ? "Documento" : "000.000.000-00"} className="h-9 text-sm mt-1" />
              <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                <input type="checkbox" checked={estrangeiroCpf} onChange={(e) => setEstrangeiroCpf(e.target.checked)} className="h-3 w-3" />
                <span className="text-[10px] text-muted-foreground">Estrangeiro/Sem CPF</span>
              </label>
            </div>
            <div className="col-span-1">
              <Label className="text-xs font-medium">WhatsApp</Label>
              <Input value={maskPhone(form.responsavel1_whatsapp)} onChange={(e) => set("responsavel1_whatsapp", unmaskDigits(e.target.value))} placeholder="(00) 00000-0000" className="h-9 text-sm mt-1" />
            </div>
            {renderField("Responsável 2 - Nome", "responsavel2_nome", "text", "Nome completo")}
            {renderField("Vínculo com o participante", "vinculo_resp2", "text", "Ex: Mãe, Pai, Avó", true)}
            <div className="col-span-1">
              <Label className="text-xs font-medium">WhatsApp</Label>
              <Input value={maskPhone(form.responsavel2_whatsapp)} onChange={(e) => set("responsavel2_whatsapp", unmaskDigits(e.target.value))} placeholder="(00) 00000-0000" className="h-9 text-sm mt-1" />
            </div>
          </CardContent>
        </Card>

        {/* Informações Complementares */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Informações Complementares</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {renderField("Origem/Encaminhamento", "origem_encaminhamento", "text", "CRAS, escola...", true)}
            {renderField("Responsável Técnico", "responsavel_tecnico", "text", "Nome do técnico", true)}
            {renderField("Categoria de Vulnerabilidade", "categoria_vulnerabilidade", "text", "Ex: situação de risco", true)}
            {renderField("Início no SCFV", "iniciou_em", "date", "", true)}
            <div className="col-span-2">
              <Label className="text-xs font-medium">Restrição Alimentar</Label>
              <Textarea value={form.restricao_alimentar} onChange={(e) => set("restricao_alimentar", e.target.value)} placeholder="Alergias, intolerâncias..." className="text-sm mt-1 min-h-[60px]" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium">Laudo / Observações de Saúde</Label>
              <Textarea value={form.laudo} onChange={(e) => set("laudo", e.target.value)} placeholder="Informações médicas relevantes..." className="text-sm mt-1 min-h-[60px]" />
            </div>
            {renderField("Remédio de Uso Contínuo", "remedio_continuo", "text", "Ex: Ritalina 10mg")}
            <div className="col-span-2">
              <Label className="text-xs font-medium">Outras Condições de Saúde</Label>
              <Textarea value={form.outras_condicoes} onChange={(e) => set("outras_condicoes", e.target.value)} placeholder="Outras condições relevantes..." className="text-sm mt-1 min-h-[60px]" />
            </div>
          </CardContent>
        </Card>

        {/* Documentos Categorizados */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Documentos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Escaneie com a câmera do celular ou faça upload de arquivos. Imagens são convertidas automaticamente para PDF.</p>

            {/* Scan session overlay */}
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
                        <img src={page.dataUrl} alt={`Página ${i+1}`} className="w-full h-full object-cover"
                        <button type="button" onClick={() => scanner.removePageFromScan(i)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3"
                        </button>
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center">{i+1}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={scanner.addPageToScan}><Plus className="h-3.5 w-3.5 mr-1"Adicionar Página</Button>
                  {scanner.scanSession.pages.length > 0 && (
                    <Button type="button" size="sm" onClick={handleFinalizeScan}><Check className="h-3.5 w-3.5 mr-1"Finalizar Scan</Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={scanner.cancelScan}>Cancelar</Button>
                </div>
              </div>
            )}

            {/* Category buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const docsForCat = pendingDocs.filter(d => d.categoria === cat.value);
                return (
                  <div key={cat.value} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{cat.label}</span>
                      {docsForCat.length > 0 && <Badge variant="secondary" className="text-[10px]">{docsForCat.length}</Badge>}
                    </div>
                    <div className="flex gap-1.5">
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => scanner.startScan(cat.value)} disabled={!!scanner.scanSession}>
                        <Camera className="h-3 w-3 mr-1)}Escanear
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => handleUploadFile(cat.value)} disabled={!!scanner.scanSession}>
                        <Upload className="h-3 w-3 mr-1)}Upload
                      </Button>
                    </div>
                    {docsForCat.map((doc, i) => {
                      const globalIdx = pendingDocs.indexOf(doc);
                      return (
                        <div key={i} className="flex items-center gap-2 bg-muted/50 rounded p-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                          <span className="text-[10px] truncate flex-1">{doc.fileName}</span>
                          <button type="button" onClick={() => removePendingDoc(globalIdx)} className="text-destructive hover:text-destructive/80">
                            <X className="h-3 w-3"
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Hidden scan input */}
            <input ref={scanner.scanInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={scanner.handleScanCapture} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" asChild><Link to="/participantes">Cancelar</Link></Button>
          <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-1)}{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </form>
    </div>
  );
};

export default ParticipanteNovoPage;
