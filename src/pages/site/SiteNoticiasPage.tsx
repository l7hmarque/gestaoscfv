import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Noticia {
  id: string;
  titulo: string;
  subtitulo: string | null;
  conteudo: string;
  imagem_url: string | null;
  published_at: string;
}

export default function SiteNoticiasPage() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Noticia | null>(null);

  useEffect(() => {
    supabase
      .from("site_noticias" as any)
      .select("*")
      .eq("status", "publicado")
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        setNoticias((data as any) || []);
        setLoading(false);
      });
  }, []);

  if (selected) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <button onClick={() => setSelected(null)} className="text-[#E5541B] text-sm font-medium mb-6 hover:underline">
          ← Voltar às notícias
        </button>
        {selected.imagem_url && (
          <img src={selected.imagem_url} alt={selected.titulo} className="w-full h-64 object-cover rounded-xl mb-6" />
        )}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{selected.titulo}</h1>
        {selected.subtitulo && <p className="text-lg text-gray-500 mb-4">{selected.subtitulo}</p>}
        <p className="text-sm text-gray-400 mb-8 flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          {format(new Date(selected.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
        <div className="prose prose-gray max-w-none whitespace-pre-line text-gray-700">
          {selected.conteudo}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          <span className="text-[#3B8FC2]">Notícias</span> e Destaques
        </h1>
        <p className="text-gray-500">Acompanhe as atividades e conquistas do CAIA Medianeira.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#3B8FC2]" /></div>
      ) : noticias.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">Nenhuma notícia publicada ainda.</p>
          <p className="text-sm mt-1">Em breve teremos novidades!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {noticias.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelected(n)}
              className="text-left bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
            >
              {n.imagem_url ? (
                <img src={n.imagem_url} alt={n.titulo} className="w-full h-48 object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-[#E5541B]/10 to-[#3B8FC2]/10 flex items-center justify-center">
                  <span className="text-4xl font-bold text-[#E5541B]/20">SCNSA</span>
                </div>
              )}
              <div className="p-5">
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{n.titulo}</h3>
                {n.subtitulo && <p className="text-sm text-gray-500 mb-2 line-clamp-2">{n.subtitulo}</p>}
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(n.published_at), "dd/MM/yyyy")}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
