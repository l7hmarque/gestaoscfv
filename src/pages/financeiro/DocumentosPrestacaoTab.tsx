import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Trash2, Clock, AlertTriangle, FolderOpen, History, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sysEloFileName } from "@/lib/fileNaming";

interface DocPC {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  arquivo_url: string;
  nome_arquivo: string;
  versao: number;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  uploaded_by: string | null;
  created_at: string;
}

const CATEGORIAS_DOC = [
  { value: "ata_eleicao", label: "Ata de Eleição da Diretoria" },
  { value: "estatuto_social", label: "Estatuto Social" },
  { value: "cnpj_osc", label: "Cartão CNPJ da OSC" },
  { value: "doc_presidente", label: "Documentos do Presidente" },
  { value: "certidao_negativa", label: "Certidões Negativas" },
  { value: "alvara", label: "Alvará de Funcionamento" },
  { value: "plano_trabalho", label: "Plano de Trabalho" },
  { value: "termo_colaboracao", label: "Termo de Colaboração/Fomento" },
  { value: "outro", label: "Outro" },
];

const catLabel = (v: string) => CATEGORIAS_DOC.find(c => c.value === v)?.label || v;

function isExpiringSoon(vigenciaFim: string | null): "expired" | "warning" | "ok" {
  if (!vigenciaFim) return "ok";
  const now = new Date();
  const end = new Date(vigenciaFim + "T23:59:59");
  if (end < now) return "expired";
  const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 30) return "warning";
  return "ok";
}

export default function DocumentosPrestacaoTab() {
  const [docs, setDocs] = useState<DocPC[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ categoria: "", titulo: "", descricao: "", vigencia_inicio: "", vigencia_fim: "" });
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("documentos_prestacao_contas").select("*").order("created_at", { ascending: false });
    setDocs((data || []) as unknown as DocPC[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group by category, get latest per category
  const latestByCategory = new Map<string, DocPC>();
  docs.forEach(d => {
    if (!latestByCategory.has(d.categoria) || new Date(d.created_at) > new Date(latestByCategory.get(d.categoria)!.created_at)) {
      latestByCategory.set(d.categoria, d);
    }
  });

  const historyDocs = showHistory ? docs.filter(d => d.categoria === showHistory) : [];

  const handleUpload = async () => {
    if (!file || !form.categoria || !form.titulo) { toast.error("Preencha categoria, título e arquivo"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const fileName = sysEloFileName(`DocPC_${form.categoria}`, ext);
      const path = `prestacao-contas/${form.categoria}/${fileName}`;
      const { error: upErr } = await supabase.storage.from("documentos").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = await supabase.storage.from("documentos").createSignedUrl(path, 31536000);

      const existingVersions = docs.filter(d => d.categoria === form.categoria);
      const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions.map(d => d.versao)) + 1 : 1;

      const { error } = await supabase.from("documentos_prestacao_contas").insert({
        categoria: form.categoria,
        titulo: form.titulo,
        descricao: form.descricao || null,
        arquivo_url: urlData?.signedUrl || path,
        nome_arquivo: fileName,
        versao: nextVersion,
        vigencia_inicio: form.vigencia_inicio || null,
        vigencia_fim: form.vigencia_fim || null,
      } as any);
      if (error) throw error;
      toast.success("Documento enviado com sucesso");
      setShowUpload(false);
      setForm({ categoria: "", titulo: "", descricao: "", vigencia_inicio: "", vigencia_fim: "" });
      setFile(null);
      load();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = async (id: string) => {
    if (!confirm("Excluir este documento?")) return;
    await supabase.from("documentos_prestacao_contas").delete().eq("id", id);
    toast.success("Documento excluído");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Documentos Institucionais — Prestação de Contas</h3>
        <Button size="sm" className="gap-1" onClick={() => setShowUpload(true)}><Plus className="h-3 w-3" />Enviar Documento</Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Documentos recorrentes da OSC (ata de eleição, CNPJ, estatuto, certidões etc.) com controle de versão e alertas de vigência.
      </p>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATEGORIAS_DOC.map(cat => {
            const latest = latestByCategory.get(cat.value);
            const status = latest ? isExpiringSoon(latest.vigencia_fim) : "ok";
            return (
              <Card key={cat.value} className={status === "expired" ? "border-destructive/50" : status === "warning" ? "border-amber-500/50" : ""}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold">{cat.label}</span>
                    </div>
                    {status === "expired" && <Badge variant="destructive" className="text-[10px]">Expirado</Badge>}
                    {status === "warning" && <Badge className="text-[10px] bg-amber-500">Expirando</Badge>}
                  </div>
                  {latest ? (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">{latest.titulo} — v{latest.versao}</p>
                      <p className="text-[10px] text-muted-foreground">Enviado em {new Date(latest.created_at).toLocaleDateString("pt-BR")}</p>
                      {latest.vigencia_fim && (
                        <p className="text-[10px] flex items-center gap-1">
                          <Clock className="h-3 w-3" />Vigência até {new Date(latest.vigencia_fim + "T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      )}
                      <div className="flex gap-1 pt-1">
                        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => window.open(latest.arquivo_url, "_blank")}>
                          <Download className="h-3 w-3" />Baixar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setShowHistory(cat.value)}>
                          <History className="h-3 w-3" />Histórico
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic">Nenhum documento enviado</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar Documento Institucional</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Categoria *</Label>
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CATEGORIAS_DOC.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Título *</Label><Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Ata de Eleição 2026" /></div>
            <div><Label className="text-xs">Descrição</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Vigência Início</Label><Input type="date" value={form.vigencia_inicio} onChange={e => setForm(f => ({ ...f, vigencia_inicio: e.target.value }))} /></div>
              <div><Label className="text-xs">Vigência Fim</Label><Input type="date" value={form.vigencia_fim} onChange={e => setForm(f => ({ ...f, vigencia_fim: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Arquivo *</Label><Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading}>{uploading ? "Enviando..." : "Enviar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!showHistory} onOpenChange={() => setShowHistory(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Histórico — {showHistory ? catLabel(showHistory) : ""}</DialogTitle></DialogHeader>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">Versão</TableHead>
              <TableHead className="text-xs">Título</TableHead>
              <TableHead className="text-xs">Data</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {historyDocs.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs">v{d.versao}</TableCell>
                  <TableCell className="text-xs">{d.titulo}</TableCell>
                  <TableCell className="text-xs">{new Date(d.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(d.arquivo_url, "_blank")}><Download className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteDoc(d.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {historyDocs.length === 0 && <TableRow><TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-4">Nenhum documento</TableCell></TableRow>}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
