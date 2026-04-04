import { useState } from "react";
import { Heart, MessageCircle, Trophy, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { renderMentionText } from "@/components/MentionInput";
import { Link } from "react-router-dom";

interface FeedPostProps {
  post: any;
  fotos: any[];
  reacoes: any[];
  comentarios: any[];
  profiles: Record<string, any>;
  myProfileId: string;
  isCoord: boolean;
  onRefresh: () => void;
}

const tipoLabel: Record<string, { icon: string; label: string }> = {
  relatorio_auto: { icon: "📝", label: "Relatório" },
  conquista: { icon: "🏆", label: "Conquista" },
  manual: { icon: "", label: "" },
};

function RenderContent({ text, profiles }: { text: string; profiles: Record<string, any> }) {
  const parts = renderMentionText(text, profiles);
  if (typeof parts === "string") return <>{parts}</>;
  return (
    <>
      {(parts as any[]).map((part, i) =>
        typeof part === "string" ? (
          <span key={i}>{part}</span>
        ) : (
          <Link
            key={i}
            to={`/profissional/${part.id}`}
            className="text-primary font-medium hover:underline"
          >
            @{part.name}
          </Link>
        )
      )}
    </>
  );
}

export function FeedPost({ post, fotos, reacoes, comentarios, profiles, myProfileId, isCoord, onRefresh }: FeedPostProps) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");

  const autor = profiles[post.autor_id];
  const myReacao = reacoes.find((r) => r.user_id === myProfileId);
  const likeCount = reacoes.filter((r) => r.tipo === "like").length;
  const ameiCount = reacoes.filter((r) => r.tipo === "amei").length;
  const canDelete = post.autor_id === myProfileId || isCoord;
  const tipo = tipoLabel[post.tipo] || tipoLabel.manual;

  const handleReacao = async (tipo: "like" | "amei") => {
    if (!myProfileId) return;
    if (myReacao) {
      if (myReacao.tipo === tipo) {
        await supabase.from("feed_reacoes").delete().eq("id", myReacao.id);
      } else {
        await supabase.from("feed_reacoes").update({ tipo } as any).eq("id", myReacao.id);
      }
    } else {
      await supabase.from("feed_reacoes").insert({ feed_post_id: post.id, user_id: myProfileId, tipo });
    }
    onRefresh();
  };

  const handleComment = async () => {
    if (!newComment.trim() || !myProfileId) return;

    // Extract @mentions from comment
    const profNames = Object.values(profiles).map((p: any) => p.nome).filter(Boolean);
    const mentionIds: string[] = [];
    profNames.forEach((name: string) => {
      if (newComment.includes(`@${name}`)) {
        const prof = Object.values(profiles).find((p: any) => p.nome === name);
        if (prof) mentionIds.push(prof.id);
      }
    });

    await supabase.from("feed_comentarios").insert({
      feed_post_id: post.id,
      autor_id: myProfileId,
      conteudo: newComment.trim(),
      mencoes: mentionIds,
    } as any);

    // Send notification for each mentioned person
    for (const mid of mentionIds) {
      if (mid !== myProfileId) {
        await supabase.from("recados").insert({
          remetente_id: myProfileId,
          destinatario_id: mid,
          conteudo: `Você foi mencionado em um comentário no Feed por ${profiles[myProfileId]?.nome || "alguém"}`,
        });
      }
    }

    setNewComment("");
    onRefresh();
  };

  const handleDelete = async () => {
    if (!confirm("Excluir este post?")) return;
    await supabase.from("feed_posts").delete().eq("id", post.id);
    toast.success("Post excluído");
    onRefresh();
  };

  const handleDeleteComment = async (id: string) => {
    await supabase.from("feed_comentarios").delete().eq("id", id);
    onRefresh();
  };

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={autor?.foto_url} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">{autor?.nome?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{autor?.nome || "—"}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {tipo.label && (
              <Badge variant="secondary" className="text-xs">{tipo.icon} {tipo.label}</Badge>
            )}
            {canDelete && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Content with @mentions */}
        {post.conteudo && (
          <p className="text-sm text-foreground whitespace-pre-wrap mb-3">
            <RenderContent text={post.conteudo} profiles={profiles} />
          </p>
        )}

        {/* Photos */}
        {fotos.length > 0 && (
          <div className={`grid gap-1 mb-3 ${fotos.length === 1 ? "grid-cols-1" : fotos.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {fotos.slice(0, 6).map((f) => (
              <img key={f.id} src={f.foto_url} alt="" className="rounded-md w-full h-40 object-cover" />
            ))}
          </div>
        )}

        {/* Reactions */}
        <div className="flex items-center gap-4 border-t pt-2">
          <button
            onClick={() => handleReacao("like")}
            className={`flex items-center gap-1 text-xs transition-colors ${myReacao?.tipo === "like" ? "text-red-500 font-medium" : "text-muted-foreground hover:text-red-500"}`}
          >
            <Heart className={`h-4 w-4 ${myReacao?.tipo === "like" ? "fill-current" : ""}`} />
            {likeCount > 0 && likeCount}
          </button>
          <button
            onClick={() => handleReacao("amei")}
            className={`flex items-center gap-1 text-xs transition-colors ${myReacao?.tipo === "amei" ? "text-pink-500 font-medium" : "text-muted-foreground hover:text-pink-500"}`}
          >
            <span className="text-base">💕</span>
            {ameiCount > 0 && ameiCount}
          </button>
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            {comentarios.length > 0 && comentarios.length}
          </button>
        </div>

        {/* Comments */}
        {showComments && (
          <div className="mt-3 space-y-2 border-t pt-2">
            {comentarios.map((c) => {
              const cAutor = profiles[c.autor_id];
              const canDeleteComment = c.autor_id === myProfileId || isCoord;
              return (
                <div key={c.id} className="flex items-start gap-2">
                  <Avatar className="h-6 w-6 mt-0.5">
                    <AvatarFallback className="text-[10px] bg-muted">{cAutor?.nome?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">
                      <span className="font-medium">{cAutor?.nome || "—"}</span>{" "}
                      <span className="text-muted-foreground">
                        <RenderContent text={c.conteudo} profiles={profiles} />
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {canDeleteComment && (
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteComment(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
            <div className="flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Comentar... use @ para mencionar"
                className="h-8 text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleComment} disabled={!newComment.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
