import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Video, Headphones, FileText, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const tipoConfig: Record<string, { label: string; icon: typeof BookOpen; color: string }> = {
  ebook: { label: "E-book", icon: BookOpen, color: "#E5541B" },
  video: { label: "Vídeo", icon: Video, color: "#3B8FC2" },
  podcast: { label: "Podcast", icon: Headphones, color: "#8B5CF6" },
  guia: { label: "Guia", icon: FileText, color: "#059669" },
};

interface Conteudo {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  arquivo_url: string;
  thumbnail_url: string | null;
}

export default function SiteConteudosPage() {
  const [conteudos, setConteudos] = useState<Conteudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("site_conteudos" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setConteudos((data as any) || []);
        setLoading(false);
      });
  }, []);

  const filtered = filtro ? conteudos.filter((c) => c.tipo === filtro) : conteudos;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          Conteúdos <span className="text-[#E5541B]">Gratuitos</span>
        </h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Materiais educativos sobre OSC, SCFV, Prestação de Contas e muito mais.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        <Button
          variant={filtro === null ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltro(null)}
          className={filtro === null ? "bg-[#E5541B] hover:bg-[#E5541B]/90 text-white" : ""}
        >
          Todos
        </Button>
        {Object.entries(tipoConfig).map(([key, cfg]) => (
          <Button
            key={key}
            variant={filtro === key ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltro(key)}
            className={filtro === key ? "bg-[#E5541B] hover:bg-[#E5541B]/90 text-white" : ""}
          >
            <cfg.icon className="h-4 w-4 mr-1" /> {cfg.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#E5541B]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">Nenhum conteúdo disponível ainda.</p>
          <p className="text-sm mt-1">Em breve adicionaremos materiais!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((c) => {
            const cfg = tipoConfig[c.tipo] || tipoConfig.guia;
            const Icon = cfg.icon;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                {c.thumbnail_url ? (
                  <img src={c.thumbnail_url} alt={c.titulo} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center" style={{ backgroundColor: cfg.color + "10" }}>
                    <Icon className="h-12 w-12" style={{ color: cfg.color, opacity: 0.3 }} />
                  </div>
                )}
                <div className="p-5">
                  <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: cfg.color + "15", color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <h3 className="font-semibold text-gray-900 mt-3 mb-1 line-clamp-2">{c.titulo}</h3>
                  {c.descricao && <p className="text-sm text-gray-500 mb-4 line-clamp-3">{c.descricao}</p>}
                  <a href={c.arquivo_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1">
                      <Download className="h-3 w-3" /> Acessar
                    </Button>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
