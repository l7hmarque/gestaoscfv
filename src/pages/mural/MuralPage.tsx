import { useState, useEffect } from "react";
import { MessageSquare, Pin, PinOff, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";

const tipoConfig: Record<string, { label: string; emoji: string; color: string }> = {
  aviso: { label: "Aviso", emoji: "📌", color: "bg-amber-100 text-amber-800" },
  lembrete: { label: "Lembrete", emoji: "🔔", color: "bg-blue-100 text-blue-800" },
  informativo: { label: "Informativo", emoji: "💬", color: "bg-green-100 text-green-800" },
};

const MuralPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [myProfileId, setMyProfileId] = useState<string>("");
  const [isCoord, setIsCoord] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "informativo", titulo: "", conteudo: "" });
  const isDemo = useIsDemo();

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("mural_posts")
      .select("*")
      .order("fixado", { ascending: false })
      .order("created_at", { ascending: false });
    setPosts(data || []);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const [, { data: profs }, { data: roles }] = await Promise.all([
        fetchPosts(),
        supabase.from("profiles").select("id, nome, cargo, user_id"),
        supabase.from("user_roles").select("role").eq("user_id", user?.id || ""),
      ]);
      const profMap: Record<string, any> = {};
      (profs || []).forEach((p: any) => {
        profMap[p.id] = p;
        if (p.user_id === user?.id) setMyProfileId(p.id);
      });
      setProfiles(profMap);
      setIsCoord((roles || []).some((r: any) => r.role === "coordenacao"));
      setLoading(false);
    };
    init();

    const channel = supabase
      .channel("mural-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "mural_posts" }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleCreate = async () => {
    if (guardDemo(isDemo)) return;
    if (!form.titulo.trim()) { toast.error("Título é obrigatório"); return; }
    if (!myProfileId) { toast.error("Perfil não encontrado"); return; }
    const { error } = await supabase.from("mural_posts").insert({
      autor_id: myProfileId,
      tipo: form.tipo as any,
      titulo: form.titulo,
      conteudo: form.conteudo,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Publicado!");
    setForm({ tipo: "informativo", titulo: "", conteudo: "" });
    setDialogOpen(false);
  };

  const handlePin = async (id: string, current: boolean) => {
    if (guardDemo(isDemo)) return;
    await supabase.from("mural_posts").update({ fixado: !current } as any).eq("id", id);
  };

  const handleDelete = async (id: string) => {
    if (guardDemo(isDemo)) return;
    if (!confirm("Excluir este post?")) return;
    await supabase.from("mural_posts").delete().eq("id", id);
    toast.success("Excluído");
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Mural Coletivo</h1>
          <p className="text-sm text-muted-foreground">Avisos, lembretes e informações</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Aviso</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Post no Mural</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aviso">📌 Aviso</SelectItem>
                    <SelectItem value="lembrete">🔔 Lembrete</SelectItem>
                    <SelectItem value="informativo">💬 Informativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Título *</Label>
                <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Reunião de equipe" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Conteúdo</Label>
                <Textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} placeholder="Detalhes..." rows={4} />
              </div>
              <Button onClick={handleCreate} className="w-full">Publicar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : posts.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Nenhum post no mural ainda. Seja o primeiro a publicar!
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const cfg = tipoConfig[post.tipo] || tipoConfig.informativo;
            const autor = profiles[post.autor_id];
            const canManage = post.autor_id === myProfileId || isCoord;
            return (
              <Card key={post.id} className={post.fixado ? "border-amber-300 bg-amber-50/30" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-lg">{cfg.emoji}</span>
                        <Badge variant="secondary" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                        {post.fixado && <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">Fixado</Badge>}
                      </div>
                      <h3 className="font-semibold text-sm text-foreground">{post.titulo}</h3>
                      {post.conteudo && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{post.conteudo}</p>}
                      <p className="text-xs text-muted-foreground mt-2">
                        por <span className="font-medium">{autor?.nome || "—"}</span>
                        {autor?.cargo && ` (${autor.cargo})`}
                        {" · "}
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex gap-1 shrink-0">
                        {isCoord && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title={post.fixado ? "Desafixar" : "Fixar"} onClick={() => handlePin(post.id, post.fixado)}>
                            {post.fixado ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(post.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MuralPage;
