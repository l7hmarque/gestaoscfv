import { useRef, useState } from "react";
import { Upload, Camera, X, FileText, Image as ImageIcon, Plus, Check, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import { useDocumentScanner, CATEGORIES, compressFileForUpload } from "@/hooks/useDocumentScanner";
import { isBairroSCFV } from "@/lib/constants";
import { maskCPF, maskPhone, unmaskDigits } from "@/lib/utils";
import { toast } from "sonner";

export interface PendingDoc {
  blob: Blob;
  categoria: string;
  fileName: string;
  pageCount: number;
}

export interface ParticipanteIndividual {
  uid: string;
  nome_completo: string;
  data_nascimento: string;
  genero: string;
  cor_raca: string;
  escola: string;
  serie: string;
  periodo: string;
  cpf: string;
  estrangeiroCpf: boolean;
  bairro_id: string;
  ponto_transporte_id: string;
  iniciou_em: string;
  laudo: string;
  remedio_continuo: string;
  outras_condicoes: string;
  fotoFile: File | null;
  fotoPreview: string | null;
  pendingDocs: PendingDoc[];
  _overridesBairro?: boolean;
  _overridesPonto?: boolean;
}

export const emptyParticipante = (familiaBairro = "", familiaPonto = ""): ParticipanteIndividual => ({
  uid: crypto.randomUUID(),
  nome_completo: "",
  data_nascimento: "",
  genero: "",
  cor_raca: "",
  escola: "",
  serie: "",
  periodo: "manha",
  cpf: "",
  estrangeiroCpf: false,
  bairro_id: familiaBairro,
  ponto_transporte_id: familiaPonto,
  iniciou_em: new Date().toISOString().slice(0, 10),
  laudo: "",
  remedio_continuo: "",
  outras_condicoes: "",
  fotoFile: null,
  fotoPreview: null,
  pendingDocs: [],
});

interface Props {
  index: number;
  data: ParticipanteIndividual;
  bairros: Tables<"bairros">[];
  pontos: Tables<"pontos_transporte">[];
  canRemove: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onChange: (patch: Partial<ParticipanteIndividual>) => void;
  onRemove: () => void;
}

const calcAge = (iso: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
};

const ParticipanteIndividualCard = ({ index, data, bairros, pontos, canRemove, collapsed, onToggleCollapse, onChange, onRemove }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const scanner = useDocumentScanner();

  const handleFotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    onChange({ fotoFile: file, fotoPreview: URL.createObjectURL(file) });
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
        const novo: PendingDoc = { blob, categoria, fileName: `SysCFV_Doc_${categoria}_${ts}.pdf`, pageCount: 1 };
        onChange({ pendingDocs: [...data.pendingDocs.filter(d => d.categoria !== categoria), novo] });
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
    const novo: PendingDoc = { blob: result.blob, categoria: result.categoria, fileName: `SysCFV_Doc_${result.categoria}_${ts}.pdf`, pageCount: scanner.scanSession?.pages.length || 1 };
    onChange({ pendingDocs: [...data.pendingDocs, novo] });
    toast.success("Scan finalizado!");
  };

  const removePendingDoc = (i: number) => onChange({ pendingDocs: data.pendingDocs.filter((_, idx) => idx !== i) });
  const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label || v;

  const idade = calcAge(data.data_nascimento);
  const titulo = `Participante ${index + 1}${data.nome_completo ? ` — ${data.nome_completo}` : ""}${idade !== null ? ` (${idade} anos)` : ""}`;

  return (
    <Card className="border-l-4 border-l-primary/40">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <button type="button" onClick={onToggleCollapse} className="flex items-center gap-2 text-left flex-1 group">
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
          <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">{titulo}</CardTitle>
          {data.pendingDocs.length > 0 && <Badge variant="secondary" className="text-[10px]">{data.pendingDocs.length} doc(s)</Badge>}
        </button>
        {canRemove && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-4">
          {/* Foto */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
              {data.fotoPreview ? <img src={data.fotoPreview} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon className="h-7 w-7 text-muted-foreground" />}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5 mr-1" />Foto</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}><Camera className="h-3.5 w-3.5 mr-1" />Câmera</Button>
              </div>
              <p className="text-[10px] text-muted-foreground">JPG, PNG. Máx 5MB.</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoSelect} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoSelect} />
            </div>
          </div>

          {/* Dados pessoais */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-medium">Nome Completo *</Label>
              <Input value={data.nome_completo} onChange={(e) => onChange({ nome_completo: e.target.value })} placeholder="Nome completo" className="h-9 text-sm mt-1" required />
            </div>
            <div>
              <Label className="text-xs font-medium">Data de Nascimento</Label>
              <Input type="date" value={data.data_nascimento} onChange={(e) => onChange({ data_nascimento: e.target.value })} className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Início no SCFV *</Label>
              <Input type="date" value={data.iniciou_em} onChange={(e) => onChange({ iniciou_em: e.target.value })} className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Gênero</Label>
              <Select value={data.genero} onValueChange={(v) => onChange({ genero: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent><SelectItem value="masculino">Masculino</SelectItem><SelectItem value="feminino">Feminino</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Cor/Raça</Label>
              <Select value={data.cor_raca} onValueChange={(v) => onChange({ cor_raca: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent><SelectItem value="branca">Branca</SelectItem><SelectItem value="preta">Preta</SelectItem><SelectItem value="parda">Parda</SelectItem><SelectItem value="amarela">Amarela</SelectItem><SelectItem value="indigena">Indígena</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Período</Label>
              <Select value={data.periodo} onValueChange={(v) => onChange({ periodo: v })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="manha">Manhã</SelectItem><SelectItem value="tarde">Tarde</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">CPF do Participante</Label>
              <Input
                value={data.estrangeiroCpf ? data.cpf : maskCPF(data.cpf)}
                onChange={(e) => onChange({ cpf: data.estrangeiroCpf ? e.target.value : unmaskDigits(e.target.value) })}
                placeholder={data.estrangeiroCpf ? "Documento" : "000.000.000-00"}
                className="h-9 text-sm mt-1"
              />
              <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                <input type="checkbox" checked={data.estrangeiroCpf} onChange={(e) => onChange({ estrangeiroCpf: e.target.checked })} className="h-3 w-3" />
                <span className="text-[10px] text-muted-foreground">Estrangeiro/Sem CPF</span>
              </label>
            </div>
            <div>
              <Label className="text-xs font-medium">Escola</Label>
              <Input value={data.escola} onChange={(e) => onChange({ escola: e.target.value })} placeholder="Nome da escola" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Série/Ano</Label>
              <Input value={data.serie} onChange={(e) => onChange({ serie: e.target.value })} placeholder="Ex: 5º ano" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Bairro do CAIA {data._overridesBairro && <span className="text-[10px] text-amber-600">(personalizado)</span>}</Label>
              <Select value={data.bairro_id} onValueChange={(v) => {
                const patch: Partial<ParticipanteIndividual> = { bairro_id: v, _overridesBairro: true };
                if (data.ponto_transporte_id) {
                  const ponto = pontos.find(p => p.id === data.ponto_transporte_id);
                  if (ponto && ponto.bairro_id !== v) patch.ponto_transporte_id = "";
                }
                onChange(patch);
              }}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{bairros.filter(b => isBairroSCFV(b.nome)).map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Ponto de Transporte {data._overridesPonto && <span className="text-[10px] text-amber-600">(personalizado)</span>}</Label>
              <Select value={data.ponto_transporte_id} onValueChange={(v) => onChange({ ponto_transporte_id: v, _overridesPonto: true })}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{pontos.filter(p => !data.bairro_id || p.bairro_id === data.bairro_id).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium">Laudo / Observações de Saúde</Label>
              <Textarea value={data.laudo} onChange={(e) => onChange({ laudo: e.target.value })} placeholder="Informações médicas relevantes..." className="text-sm mt-1 min-h-[50px]" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium">Remédio de Uso Contínuo</Label>
              <Input value={data.remedio_continuo} onChange={(e) => onChange({ remedio_continuo: e.target.value })} placeholder="Ex: Ritalina 10mg" className="h-9 text-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium">Outras Condições de Saúde</Label>
              <Textarea value={data.outras_condicoes} onChange={(e) => onChange({ outras_condicoes: e.target.value })} placeholder="Outras condições relevantes..." className="text-sm mt-1 min-h-[50px]" />
            </div>
          </div>

          {/* Documentos */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-xs font-semibold">Documentos do Participante</p>
            {scanner.scanSession && (
              <div className="border-2 border-primary/50 rounded-lg p-3 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Escaneando: {catLabel(scanner.scanSession.categoria)}</p>
                  <Badge variant="secondary">{scanner.scanSession.pages.length} pág.</Badge>
                </div>
                {scanner.scanSession.pages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {scanner.scanSession.pages.map((page, i) => (
                      <div key={i} className="relative group w-14 h-18 border rounded overflow-hidden">
                        <img src={page.dataUrl} alt={`Página ${i+1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => scanner.removePageFromScan(i)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={scanner.addPageToScan}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
                  {scanner.scanSession.pages.length > 0 && <Button type="button" size="sm" onClick={handleFinalizeScan}><Check className="h-3.5 w-3.5 mr-1" />Finalizar</Button>}
                  <Button type="button" size="sm" variant="ghost" onClick={scanner.cancelScan}>Cancelar</Button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const docsForCat = data.pendingDocs.filter(d => d.categoria === cat.value);
                return (
                  <div key={cat.value} className="border rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{cat.label}</span>
                      {docsForCat.length > 0 && <Badge variant="secondary" className="text-[10px]">{docsForCat.length}</Badge>}
                    </div>
                    <div className="flex gap-1.5">
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => scanner.startScan(cat.value)} disabled={!!scanner.scanSession}>
                        <Camera className="h-3 w-3 mr-1" />Escanear
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => handleUploadFile(cat.value)} disabled={!!scanner.scanSession}>
                        <Upload className="h-3 w-3 mr-1" />Upload
                      </Button>
                    </div>
                    {docsForCat.map((doc) => {
                      const globalIdx = data.pendingDocs.indexOf(doc);
                      return (
                        <div key={globalIdx} className="flex items-center gap-2 bg-muted/50 rounded p-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-[10px] truncate flex-1">{doc.fileName}</span>
                          <button type="button" onClick={() => removePendingDoc(globalIdx)} className="text-destructive hover:text-destructive/80">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <input ref={scanner.scanInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={scanner.handleScanCapture} />
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default ParticipanteIndividualCard;