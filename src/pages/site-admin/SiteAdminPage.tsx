import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Edit2, Plus, Trash2, Loader2, Upload, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function SiteAdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestão do Site Público</h1>
      <Tabs defaultValue="noticias">
        <TabsList>
          <TabsTrigger value="noticias">Notícias</TabsTrigger>
          <TabsTrigger value="conteudos">Conteúdos</TabsTrigger>
          <TabsTrigger value="leads">Leads / Contatos</TabsTrigger>
        </TabsList>
        <TabsContent value="noticias"><NoticiasTab /></TabsContent>
        <TabsContent value="conteudos"><ConteudosTab /></TabsContent>
        <TabsContent value="leads"><LeadsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function NoticiasTab() {
  const [noticias, setNoticias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);

  const load = () => {
    supabase.from("site_noticias" as any).select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setNoticias((data as any) || []); setLoading(false); });
  };
  useEffect(load, []);

  async function updateStatus(id: string, status: string) {
    const update: any = { status };
    if (status === "publicado") update.published_at = new Date().toISOString();
    await supabase.from("site_noticias" as any).update(update).eq("id", id);
    load();
    toast.success(status === "publicado" ? "Notícia publicada!" : "Status atualizado");
  }

  async function deleteNoticia(id: string) {
    await supabase.from("site_noticias" as any).delete().eq("id", id);
    load();
    toast.success("Notícia removida");
  }

  const statusColor: Record<string, string> = {
    rascunho: "bg-gray-100 text-gray-600",
    pendente: "bg-yellow-100 text-yellow-700",
    publicado: "bg-green-100 text-green-700",
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 mt-4">
      <Button size="sm" onClick={() => setShowNew(true)} className="gap-1"><Plus className="h-4 w-4" /> Nova Notícia</Button>
      {noticias.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma notícia cadastrada.</p>
      ) : (
        <div className="space-y-3">
          {noticias.map((n) => (
            <div key={n.id} className="bg-card rounded-lg border p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={statusColor[n.status] || ""}>{n.status}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(n.created_at), "dd/MM/yyyy")}</span>
                </div>
                <h4 className="font-medium truncate">{n.titulo}</h4>
                {n.subtitulo && <p className="text-sm text-muted-foreground truncate">{n.subtitulo}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {n.status === "pendente" && (
                  <Button size="icon" variant="ghost" onClick={() => updateStatus(n.id, "publicado")} title="Publicar">
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                )}
                {n.status === "publicado" && (
                  <Button size="icon" variant="ghost" onClick={() => updateStatus(n.id, "rascunho")} title="Despublicar">
                    <X className="h-4 w-4 text-yellow-600" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => setEditItem(n)}><Edit2 className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => deleteNoticia(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <NoticiaForm open={showNew || !!editItem} onClose={() => { setShowNew(false); setEditItem(null); }} item={editItem} onSaved={load} />
    </div>
  );
}

function NoticiaForm({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: any; onSaved: () => void }) {
  const { profile } = useAuth();
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) { setTitulo(item.titulo); setSubtitulo(item.subtitulo || ""); setConteudo(item.conteudo); }
    else { setTitulo(""); setSubtitulo(""); setConteudo(""); }
  }, [item]);

  async function save() {
    if (!titulo.trim()) { toast.error("Título obrigatório"); return; }
    setSaving(true);
    if (item) {
      await supabase.from("site_noticias" as any).update({ titulo, subtitulo, conteudo }).eq("id", item.id);
    } else {
      await supabase.from("site_noticias" as any).insert({ titulo, subtitulo, conteudo, autor_id: profile?.id, status: "rascunho" });
    }
    setSaving(false);
    onSaved();
    onClose();
    toast.success(item ? "Notícia atualizada" : "Notícia criada");
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{item ? "Editar" : "Nova"} Notícia</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <Input placeholder="Subtítulo (opcional)" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
          <Textarea placeholder="Conteúdo da notícia..." value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={8} />
          <Button onClick={save} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConteudosTab() {
  const [conteudos, setConteudos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = () => {
    supabase.from("site_conteudos" as any).select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setConteudos((data as any) || []); setLoading(false); });
  };
  useEffect(load, []);

  async function deleteItem(id: string) {
    await supabase.from("site_conteudos" as any).delete().eq("id", id);
    load();
    toast.success("Conteúdo removido");
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 mt-4">
      <Button size="sm" onClick={() => setShowNew(true)} className="gap-1"><Plus className="h-4 w-4" /> Novo Conteúdo</Button>
      {conteudos.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Nenhum conteúdo cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {conteudos.map((c) => (
            <div key={c.id} className="bg-card rounded-lg border p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{c.tipo}</Badge>
                </div>
                <h4 className="font-medium truncate">{c.titulo}</h4>
              </div>
              <div className="flex gap-1 shrink-0">
                <a href={c.arquivo_url} target="_blank" rel="noopener noreferrer">
                  <Button size="icon" variant="ghost"><Eye className="h-4 w-4" /></Button>
                </a>
                <Button size="icon" variant="ghost" onClick={() => deleteItem(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConteudoForm open={showNew} onClose={() => setShowNew(false)} onSaved={load} />
    </div>
  );
}

function ConteudoForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("guia");
  const [descricao, setDescricao] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!titulo.trim() || !file) { toast.error("Título e arquivo obrigatórios"); return; }
    setSaving(true);
    const path = `site-conteudos/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("documentos-publicos").upload(path, file);
    if (upErr) { toast.error("Erro no upload"); setSaving(false); return; }
    const { data: urlData } = supabase.storage.from("documentos-publicos").getPublicUrl(path);
    await supabase.from("site_conteudos" as any).insert({ titulo, tipo, descricao, arquivo_url: urlData.publicUrl });
    setSaving(false);
    onSaved();
    onClose();
    setTitulo(""); setDescricao(""); setFile(null);
    toast.success("Conteúdo adicionado");
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Novo Conteúdo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ebook">E-book</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="podcast">Podcast</SelectItem>
              <SelectItem value="guia">Guia</SelectItem>
            </SelectContent>
          </Select>
          <Textarea placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Button onClick={save} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeadsTab() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("site_leads" as any).select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setLeads((data as any) || []); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="mt-4">
      {leads.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Nenhum lead capturado.</p>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => (
            <div key={l.id} className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{l.nome}</span>
                <span className="text-muted-foreground text-xs">— {l.email}</span>
                <span className="text-xs text-muted-foreground ml-auto">{format(new Date(l.created_at), "dd/MM/yyyy HH:mm")}</span>
              </div>
              {l.interesse && <p className="text-xs text-muted-foreground">{l.interesse}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
