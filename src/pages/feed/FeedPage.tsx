import { useState, useEffect } from "react";
import { Plus, Upload, Image, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FeedPost } from "@/components/FeedPost";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { compressFileForUpload } from "@/hooks/useDocumentScanner";

const FeedPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [fotos, setFotos] = useState<Record<string, any[]>>({});
  const [reacoes, setReacoes] = useState<Record<string, any[]>>({});
  const [comentarios, setComentarios] = useState<Record<string, any[]>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [myProfileId, setMyProfileId] = useState("");
  const [isCoord, setIsCoord] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const isDemo = useIsDemo();

  const fetchAll = async () => {
    const [{ data: p }, { data: f }, { data: r }, { data: c }] = await Promise.all([
      supabase.from("feed_posts").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("feed_fotos").select("*"),
      supabase.from("feed_reacoes").select("*"),
      supabase.from("feed_comentarios").select("*").order("created_at"),
    ]);
    setPosts(p || []);
    const fMap: Record<string, any[]> = {};
    (f || []).forEach((x: any) => { (fMap[x.feed_post_id] = fMap[x.feed_post_id] || []).push(x); });
    setFotos(fMap);
    const rMap: Record<string, any[]> = {};
    (r || []).forEach((x: any) => { (rMap[x.feed_post_id] = rMap[x.feed_post_id] || []).push(x); });
    setReacoes(rMap);
    const cMap: Record<string, any[]> = {};
    (c || []).forEach((x: any) => { (cMap[x.feed_post_id] = cMap[x.feed_post_id] || []).push(x); });
    setComentarios(cMap);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const [, { data: profs }, { data: roles }] = await Promise.all([
        fetchAll(),
        supabase.from("profiles").select("id, nome, cargo, foto_url, user_id"),
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

    const ch1 = supabase.channel("feed-posts-rt").on("postgres_changes", { event: "*", schema: "public", table: "feed_posts" }, () => fetchAll()).subscribe();
    const ch2 = supabase.channel("feed-reacoes-rt").on("postgres_changes", { event: "*", schema: "public", table: "feed_reacoes" }, () => fetchAll()).subscribe();
    const ch3 = supabase.channel("feed-coment-rt").on("postgres_changes", { event: "*", schema: "public", table: "feed_comentarios" }, () => fetchAll()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  }, [user]);

  const handlePost = async () => {
    if (guardDemo(isDemo)) return;
    if (!newContent.trim() && newPhotos.length === 0) { toast.error("Escreva algo ou adicione uma foto"); return; }
    if (!myProfileId) { toast.error("Perfil não encontrado"); return; }

    const { data: fp, error } = await supabase.from("feed_posts").insert({
      autor_id: myProfileId,
      conteudo: newContent,
      tipo: "manual" as any,
    }).select("id").single();
    if (error || !fp) { toast.error(error?.message || "Erro"); return; }

    for (let i = 0; i < newPhotos.length; i++) {
      const compressed = await compressFileForUpload(newPhotos[i]);
      const ext = compressed.name.split(".").pop();
      const path = `feed/${fp.id}/${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from("fotos-relatorios").upload(path, compressed);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("fotos-relatorios").getPublicUrl(path);
        await supabase.from("feed_fotos").insert({ feed_post_id: fp.id, foto_url: urlData.publicUrl, ordem: i });
      }
    }

    toast.success("Publicado!");
    setNewContent("");
    setNewPhotos([]);
    setDialogOpen(false);
    fetchAll();
  };

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
    if (newPhotos.length + files.length > 5) { toast.error("Máximo 5 fotos"); return; }
    setNewPhotos(prev => [...prev, ...files]);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Feed</h1>
          <p className="text-sm text-muted-foreground">Novidades, conquistas e atividades</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova Postagem</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Postagem</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="O que está acontecendo?"
                rows={4}
              />
              {newPhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {newPhotos.map((f, i) => (
                    <div key={i} className="relative">
                      <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 object-cover rounded" />
                      <button
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px]"
                        onClick={() => setNewPhotos(prev => prev.filter((_, j) => j !== i))}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="cursor-pointer flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <Image className="h-4 w-4" />
                  Fotos
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
                </label>
                <Button onClick={handlePost} disabled={!newContent.trim() && newPhotos.length === 0}>
                  <Send className="h-4 w-4 mr-1" />Publicar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : posts.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          O feed está vazio. Crie a primeira postagem!
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <FeedPost
              key={post.id}
              post={post}
              fotos={fotos[post.id] || []}
              reacoes={reacoes[post.id] || []}
              comentarios={comentarios[post.id] || []}
              profiles={profiles}
              myProfileId={myProfileId}
              isCoord={isCoord}
              onRefresh={fetchAll}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedPage;
