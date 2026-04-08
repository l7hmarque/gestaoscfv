import { useState, useEffect } from "react";
import { Image, Send, Pin, PinOff, Trash2, Plus, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FeedPost } from "@/components/FeedPost";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { compressFileForUpload } from "@/hooks/useDocumentScanner";
import { MentionInput } from "@/components/MentionInput";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Mural post-it config
const tipoConfig: Record<string, { label: string; emoji: string; bg: string; tape: string }> = {
  aviso: { label: "Aviso", emoji: "📌", bg: "bg-amber-100", tape: "bg-amber-400" },
  lembrete: { label: "Lembrete", emoji: "🔔", bg: "bg-blue-100", tape: "bg-blue-400" },
  informativo: { label: "Informativo", emoji: "💬", bg: "bg-green-100", tape: "bg-green-400" },
};
const rotations = ["rotate-[-2deg]", "rotate-[1deg]", "rotate-[-1deg]", "rotate-[2deg]", "rotate-[0.5deg]", "rotate-[-0.5deg]"];

const FeedPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [muralPosts, setMuralPosts] = useState<any[]>([]);
  const [fotos, setFotos] = useState<Record<string, any[]>>({});
  const [reacoes, setReacoes] = useState<Record<string, any[]>>({});
  const [comentarios, setComentarios] = useState<Record<string, any[]>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [myProfileId, setMyProfileId] = useState("");
  const [isCoord, setIsCoord] = useState(false);
  const [loading, setLoading] = useState(true);

  // Composer state
  const [newContent, setNewContent] = useState("");
  const [newMentions, setNewMentions] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]); // URLs from gallery
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryItems, setGalleryItems] = useState<any[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Mural dialog state
  const [muralDialogOpen, setMuralDialogOpen] = useState(false);
  const [muralForm, setMuralForm] = useState({ tipo: "informativo", titulo: "", conteudo: "" });

  const isDemo = useIsDemo();

  const fetchAll = async () => {
    const [{ data: p }, { data: f }, { data: r }, { data: c }, { data: m }] = await Promise.all([
      supabase.from("feed_posts").select("*").neq("tipo", "conquista").order("created_at", { ascending: false }).limit(100),
      supabase.from("feed_fotos").select("*"),
      supabase.from("feed_reacoes").select("*"),
      supabase.from("feed_comentarios").select("*").order("created_at"),
      supabase.from("mural_posts").select("*").order("fixado", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    setPosts(p || []);
    setMuralPosts(m || []);
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
    const ch4 = supabase.channel("mural-rt").on("postgres_changes", { event: "*", schema: "public", table: "mural_posts" }, () => fetchAll()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); supabase.removeChannel(ch4); };
  }, [user]);

  // --- Feed Post ---
  const handlePost = async () => {
    if (guardDemo(isDemo)) return;
    const totalPhotos = newPhotos.length + galleryPhotos.length;
    if (!newContent.trim() && totalPhotos === 0) { toast.error("Escreva algo ou adicione uma foto"); return; }
    if (!myProfileId) { toast.error("Perfil não encontrado"); return; }

    const { data: fp, error } = await supabase.from("feed_posts").insert({
      autor_id: myProfileId,
      conteudo: newContent,
      tipo: "manual" as any,
      mencoes: newMentions,
    } as any).select("id").single();
    if (error || !fp) { toast.error(error?.message || "Erro"); return; }

    for (const mid of newMentions) {
      if (mid !== myProfileId) {
        await supabase.from("recados").insert({
          remetente_id: myProfileId,
          destinatario_id: mid,
          conteudo: `Você foi mencionado em um post no Feed por ${profiles[myProfileId]?.nome || "alguém"}`,
        });
      }
    }

    let ordem = 0;
    // Upload device photos
    for (const file of newPhotos) {
      const compressed = await compressFileForUpload(file);
      const ext = compressed.name.split(".").pop();
      const path = `feed/${fp.id}/${ordem}.${ext}`;
      const { error: upErr } = await supabase.storage.from("fotos-relatorios").upload(path, compressed);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("fotos-relatorios").getPublicUrl(path);
        await supabase.from("feed_fotos").insert({ feed_post_id: fp.id, foto_url: urlData.publicUrl, ordem });
      }
      ordem++;
    }
    // Add gallery photos (already URLs)
    for (const url of galleryPhotos) {
      await supabase.from("feed_fotos").insert({ feed_post_id: fp.id, foto_url: url, ordem });
      ordem++;
    }

    toast.success("Publicado!");
    setNewContent("");
    setNewMentions([]);
    setNewPhotos([]);
    setGalleryPhotos([]);
    fetchAll();
  };

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
    if (newPhotos.length + galleryPhotos.length + files.length > 5) { toast.error("Máximo 5 fotos"); return; }
    setNewPhotos(prev => [...prev, ...files]);
  };

  // --- Gallery ---
  const openGallery = async () => {
    setGalleryOpen(true);
    setGalleryLoading(true);
    const { data } = await supabase.from("relatorio_fotos").select("id, foto_url, relatorio_id").order("id", { ascending: false }).limit(60);
    setGalleryItems(data || []);
    setGalleryLoading(false);
  };

  const toggleGalleryPhoto = (url: string) => {
    if (galleryPhotos.includes(url)) {
      setGalleryPhotos(prev => prev.filter(u => u !== url));
    } else {
      if (newPhotos.length + galleryPhotos.length >= 5) { toast.error("Máximo 5 fotos"); return; }
      setGalleryPhotos(prev => [...prev, url]);
    }
  };

  // --- Mural ---
  const handleCreateMural = async () => {
    if (guardDemo(isDemo)) return;
    if (!muralForm.titulo.trim()) { toast.error("Título é obrigatório"); return; }
    if (!myProfileId) { toast.error("Perfil não encontrado"); return; }
    const { error } = await supabase.from("mural_posts").insert({
      autor_id: myProfileId,
      tipo: muralForm.tipo as any,
      titulo: muralForm.titulo,
      conteudo: muralForm.conteudo,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Aviso publicado!");
    setMuralForm({ tipo: "informativo", titulo: "", conteudo: "" });
    setMuralDialogOpen(false);
  };

  const handlePinMural = async (id: string, current: boolean) => {
    if (guardDemo(isDemo)) return;
    await supabase.from("mural_posts").update({ fixado: !current } as any).eq("id", id);
  };

  const handleDeleteMural = async (id: string) => {
    if (guardDemo(isDemo)) return;
    if (!confirm("Excluir este aviso?")) return;
    await supabase.from("mural_posts").delete().eq("id", id);
    toast.success("Excluído");
  };

  const allPhotoPreviews = [
    ...newPhotos.map((f, i) => ({ type: "file" as const, key: `f-${i}`, src: URL.createObjectURL(f), idx: i })),
    ...galleryPhotos.map((url, i) => ({ type: "gallery" as const, key: `g-${i}`, src: url, idx: i })),
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Feed / Mural</h1>
          <p className="text-sm text-muted-foreground">Avisos, novidades e atividades</p>
        </div>
        {isCoord && (
          <Dialog open={muralDialogOpen} onOpenChange={setMuralDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Novo Aviso</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Aviso no Mural</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={muralForm.tipo} onValueChange={v => setMuralForm(f => ({ ...f, tipo: v }))}>
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
                  <Input value={muralForm.titulo} onChange={e => setMuralForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Reunião de equipe" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Conteúdo</Label>
                  <Textarea value={muralForm.conteudo} onChange={e => setMuralForm(f => ({ ...f, conteudo: e.target.value }))} placeholder="Detalhes..." rows={4} />
                </div>
                <Button onClick={handleCreateMural} className="w-full">Publicar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : (
        <>
          {/* ===== MURAL SECTION ===== */}
          {muralPosts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {muralPosts.map((post, idx) => {
                const cfg = tipoConfig[post.tipo] || tipoConfig.informativo;
                const autor = profiles[post.autor_id];
                const canManage = post.autor_id === myProfileId || isCoord;
                const rotation = rotations[idx % rotations.length];

                return (
                  <div
                    key={post.id}
                    className={`relative ${cfg.bg} ${post.fixado ? "ring-2 ring-amber-400" : ""} rounded shadow-md hover:shadow-xl transition-all duration-200 ${rotation} hover:rotate-0 hover:scale-105 cursor-default`}
                  >
                    <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 ${cfg.tape} opacity-70 rounded-sm`} />
                    {post.fixado && (
                      <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-1 shadow-md z-10">
                        <Pin className="h-3 w-3" />
                      </div>
                    )}
                    <div className="p-4 pt-5">
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{cfg.emoji}</span>
                          <span className="text-[10px] font-medium uppercase tracking-wider opacity-60">{cfg.label}</span>
                        </div>
                        {canManage && (
                          <div className="flex gap-0.5 shrink-0">
                            {isCoord && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100" onClick={() => handlePinMural(post.id, post.fixado)}>
                                {post.fixado ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100 text-destructive hover:text-destructive" onClick={() => handleDeleteMural(post.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-foreground leading-tight mb-1">{post.titulo}</h3>
                      {post.conteudo && <p className="text-xs text-foreground/70 whitespace-pre-wrap line-clamp-4">{post.conteudo}</p>}
                      <div className="mt-3 pt-2 border-t border-black/5">
                        <p className="text-[10px] text-foreground/50">
                          {autor?.nome || "—"} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ===== INLINE COMPOSER ===== */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <MentionInput
                value={newContent}
                onChange={setNewContent}
                profiles={profiles}
                mentions={newMentions}
                onMentionsChange={setNewMentions}
                placeholder="O que está acontecendo? Use @ para mencionar..."
                rows={3}
              />
              {allPhotoPreviews.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {allPhotoPreviews.map((p) => (
                    <div key={p.key} className="relative">
                      <img src={p.src} alt="" className="h-16 w-16 object-cover rounded" />
                      <button
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px]"
                        onClick={() => {
                          if (p.type === "file") setNewPhotos(prev => prev.filter((_, j) => j !== p.idx));
                          else setGalleryPhotos(prev => prev.filter((_, j) => j !== p.idx));
                        }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <Image className="h-4 w-4" />
                    <span className="text-xs">Foto</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
                  </label>
                  <button onClick={openGallery} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-xs">Galeria</span>
                  </button>
                </div>
                <Button size="sm" onClick={handlePost} disabled={!newContent.trim() && allPhotoPreviews.length === 0}>
                  <Send className="h-4 w-4 mr-1" />Publicar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ===== FEED POSTS ===== */}
          {posts.length === 0 ? (
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
        </>
      )}

      {/* ===== GALLERY DIALOG ===== */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Galeria de Fotos dos Relatórios</DialogTitle></DialogHeader>
          {galleryLoading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : galleryItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma foto encontrada nos relatórios.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-80 overflow-auto">
              {galleryItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleGalleryPhoto(item.foto_url)}
                  className={`relative rounded overflow-hidden border-2 transition-all ${galleryPhotos.includes(item.foto_url) ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/30"}`}
                >
                  <img src={item.foto_url} alt="" className="w-full h-20 object-cover" />
                  {galleryPhotos.includes(item.foto_url) && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <span className="bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          <Button onClick={() => setGalleryOpen(false)} className="w-full">
            Confirmar ({galleryPhotos.length} selecionada{galleryPhotos.length !== 1 ? "s" : ""})
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeedPage;
