import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Upload, X, ExternalLink, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { compressFileForUpload } from "@/hooks/useDocumentScanner";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const MAX_FOTOS = 10;
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

type Profile = { id: string; nome: string; cargo?: string };
type Turma = { id: string; nome: string };
type Registro = {
  id: string;
  autor_id: string;
  arquivo_url: string;
  drive_file_id: string;
  nome_arquivo: string;
  mes_ref: string;
  descricao: string | null;
  turma_id: string | null;
  relatorio_id: string | null;
  profissionais_marcados: string[];
  created_at: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.includes(",") ? s.split(",")[1] : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const RegistrosFotograficosPage = () => {
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [myProfileId, setMyProfileId] = useState<string>("");
  const [isCoord, setIsCoord] = useState(false);

  const [arquivos, setArquivos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [descricao, setDescricao] = useState("");
  const [turmaId, setTurmaId] = useState<string>("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesFiltro, setMesFiltro] = useState<string>("todos");
  const [autorFiltro, setAutorFiltro] = useState<string>("todos");
  const [modalReg, setModalReg] = useState<Registro | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: profs }, { data: roles }, { data: tms }] = await Promise.all([
        supabase.from("profiles").select("id, nome, cargo, user_id, ativo").eq("ativo", true),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("turmas").select("id, nome").eq("ativa", true).order("nome"),
      ]);
      const map: Record<string, Profile> = {};
      (profs || []).forEach((p: any) => {
        map[p.id] = { id: p.id, nome: p.nome, cargo: p.cargo };
        if (p.user_id === user.id) setMyProfileId(p.id);
      });
      setProfiles(map);
      setProfilesList(Object.values(map).sort((a, b) => a.nome.localeCompare(b.nome)));
      setIsCoord((roles || []).some((r: any) => r.role === "coordenacao"));
      setTurmas((tms || []) as Turma[]);
    })();
    void carregarRegistros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function carregarRegistros() {
    setLoading(true);
    const { data } = await supabase
      .from("registros_fotograficos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRegistros((data || []) as Registro[]);
    setLoading(false);
  }

  function handleFiles(list: FileList | null) {
    if (!list) return;
    const novos = Array.from(list).slice(0, MAX_FOTOS - arquivos.length);
    const validos = novos.filter((f) => f.type.startsWith("image/"));
    if (validos.length < novos.length) toast.error("Apenas imagens são aceitas");
    setArquivos((prev) => [...prev, ...validos]);
    setPreviews((prev) => [...prev, ...validos.map((f) => URL.createObjectURL(f))]);
  }

  function removerFoto(i: number) {
    setArquivos((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[i]);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function toggleMarcado(id: string) {
    setMarcados((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function enviar() {
    if (guardDemo(isDemo)) return;
    if (arquivos.length === 0) { toast.error("Selecione ao menos 1 foto"); return; }
    setEnviando(true);
    try {
      const fotos = await Promise.all(arquivos.map(async (file) => {
        const compressed = await compressFileForUpload(file, 1600, 0.82);
        if (compressed.size > MAX_BYTES) throw new Error(`${file.name} excede 8MB após compressão`);
        const base64 = await fileToBase64(compressed);
        return { base64, mime: compressed.type || "image/jpeg", tamanho: compressed.size };
      }));

      const { data, error } = await supabase.functions.invoke("upload-registro-fotografico", {
        body: {
          fotos,
          descricao,
          turma_id: turmaId || null,
          profissionais_marcados: marcados,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success(`${fotos.length} foto(s) enviada(s) para Drive e Feed`);
      previews.forEach((u) => URL.revokeObjectURL(u));
      setArquivos([]); setPreviews([]); setDescricao(""); setTurmaId(""); setMarcados([]);
      await carregarRegistros();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar fotos");
    } finally {
      setEnviando(false);
    }
  }

  async function excluir(reg: Registro) {
    if (guardDemo(isDemo)) return;
    if (!confirm(`Excluir ${reg.nome_arquivo}? (não remove do Google Drive)`)) return;
    const { error } = await supabase.from("registros_fotograficos").delete().eq("id", reg.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    setRegistros((p) => p.filter((r) => r.id !== reg.id));
  }

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    registros.forEach((r) => set.add(r.mes_ref));
    return Array.from(set);
  }, [registros]);

  const autoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    registros.forEach((r) => set.add(r.autor_id));
    return Array.from(set);
  }, [registros]);

  const filtrados = useMemo(() => {
    return registros.filter((r) => {
      if (mesFiltro !== "todos" && r.mes_ref !== mesFiltro) return false;
      if (autorFiltro !== "todos" && r.autor_id !== autorFiltro) return false;
      return true;
    });
  }, [registros, mesFiltro, autorFiltro]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Registros Fotográficos"
        subtitle="Envie fotos do serviço — salvas no Google Drive (pasta MMM-AAAA) e publicadas no Feed em carrossel."
        icon={<Camera className="h-5 w-5" />}
      />

      {/* UPLOAD */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label className="text-xs">Fotos ({arquivos.length}/{MAX_FOTOS})</Label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
              className="mt-1 border border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-muted/40 transition-colors"
            >
              <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="text-sm mt-2">Clique ou arraste fotos aqui</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WEBP — até 8MB cada, máx. {MAX_FOTOS}</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
              />
            </div>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded overflow-hidden border">
                    <img src={src} alt="" className="object-cover w-full h-full" />
                    <button
                      onClick={() => removerFoto(i)}
                      className="absolute top-1 right-1 bg-background/90 rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground"
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value.slice(0, 280))}
                placeholder="Breve descrição das fotos…"
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground">{descricao.length}/280</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Turma/Oficina (opcional)</Label>
              <Select value={turmaId || "__none"} onValueChange={(v) => setTurmaId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— nenhuma —</SelectItem>
                  {turmas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Marcar profissionais (opcional)</Label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto p-2 border rounded">
              {profilesList.filter((p) => p.id !== myProfileId).map((p) => {
                const on = marcados.includes(p.id);
                return (
                  <Badge
                    key={p.id}
                    variant={on ? "default" : "outline"}
                    onClick={() => toggleMarcado(p.id)}
                    className="cursor-pointer text-[11px]"
                  >
                    {p.nome}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={enviar} disabled={enviando || arquivos.length === 0}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Enviar e publicar no Feed
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* GALERIA */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Mês</Label>
              <Select value={mesFiltro} onValueChange={setMesFiltro}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {mesesDisponiveis.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Autor</Label>
              <Select value={autorFiltro} onValueChange={setAutorFiltro}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {autoresDisponiveis.map((a) => (
                    <SelectItem key={a} value={a}>{profiles[a]?.nome || "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              {filtrados.length} registro(s)
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum registro fotográfico ainda.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {filtrados.map((r) => {
                const podeExcluir = r.autor_id === myProfileId || isCoord;
                return (
                  <div key={r.id} className="group relative border rounded overflow-hidden hover:shadow-md transition">
                    <button
                      onClick={() => setModalReg(r)}
                      className="block w-full aspect-square bg-muted"
                      type="button"
                    >
                      <img
                        src={r.arquivo_url}
                        alt={r.nome_arquivo}
                        loading="lazy"
                        className="object-cover w-full h-full"
                        onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                      />
                    </button>
                    <div className="p-2 text-[11px] space-y-0.5">
                      <p className="font-medium truncate">{profiles[r.autor_id]?.nome || "—"}</p>
                      <p className="text-muted-foreground truncate">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {podeExcluir && (
                      <button
                        onClick={() => excluir(r)}
                        className="absolute top-1 right-1 bg-background/90 rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition"
                        type="button"
                        title="Excluir registro"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL */}
      <Dialog open={!!modalReg} onOpenChange={(o) => !o && setModalReg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono">{modalReg?.nome_arquivo}</DialogTitle>
          </DialogHeader>
          {modalReg && (
            <div className="space-y-3">
              <img
                src={modalReg.arquivo_url}
                alt={modalReg.nome_arquivo}
                className="w-full max-h-[60vh] object-contain bg-muted rounded"
                onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
              />
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Autor:</span> {profiles[modalReg.autor_id]?.nome || "—"}</p>
                <p><span className="text-muted-foreground">Data:</span> {new Date(modalReg.created_at).toLocaleString("pt-BR")}</p>
                {modalReg.descricao && (
                  <p><span className="text-muted-foreground">Descrição:</span> {modalReg.descricao}</p>
                )}
                {modalReg.profissionais_marcados?.length > 0 && (
                  <p>
                    <span className="text-muted-foreground">Marcados: </span>
                    {modalReg.profissionais_marcados.map((id) => profiles[id]?.nome).filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              <a
                href={`https://drive.google.com/file/d/${modalReg.drive_file_id}/view`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Abrir no Google Drive <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegistrosFotograficosPage;