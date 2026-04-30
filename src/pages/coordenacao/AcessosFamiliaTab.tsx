import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Clock, Activity, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Acesso {
  id: string;
  participante_id: string | null;
  participante_nome: string | null;
  iniciado_em: string;
  ultimo_ping_em: string;
  duracao_segundos: number | null;
  total_acoes: number;
  acoes: any;
  user_agent: string | null;
  match_type: string | null;
}

function formatarDuracao(segundos: number | null) {
  if (!segundos || segundos < 0) return "—";
  if (segundos < 60) return `${segundos}s`;
  const min = Math.floor(segundos / 60);
  const s = segundos % 60;
  if (min < 60) return `${min}min ${s}s`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}min`;
}

function dispositivo(ua: string | null) {
  if (!ua) return "—";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Mobile/i.test(ua)) return "Mobile";
  return "Desktop";
}

export function AcessosFamiliaTab() {
  const [loading, setLoading] = useState(true);
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [dias, setDias] = useState(30);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      const { data } = await (supabase.from as any)("familia_acessos")
        .select("*")
        .gte("iniciado_em", desde.toISOString())
        .order("iniciado_em", { ascending: false })
        .limit(500);
      setAcessos(data || []);
      setLoading(false);
    })();
  }, [dias]);

  const stats = useMemo(() => {
    const hojeStr = new Date().toISOString().slice(0, 10);
    const hoje = acessos.filter(a => a.iniciado_em.slice(0, 10) === hojeStr);
    const familiasUnicas = new Set(acessos.map(a => a.participante_id).filter(Boolean)).size;
    const familiasHoje = new Set(hoje.map(a => a.participante_id).filter(Boolean)).size;
    const duracoes = acessos.map(a => a.duracao_segundos || 0).filter(d => d > 0);
    const duracaoMedia = duracoes.length ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length) : 0;
    // pico horários
    const porHora: Record<number, number> = {};
    for (const a of acessos) {
      const h = new Date(a.iniciado_em).getHours();
      porHora[h] = (porHora[h] || 0) + 1;
    }
    const horarioPico = Object.entries(porHora).sort((a, b) => b[1] - a[1])[0];
    return {
      total: acessos.length,
      hoje: hoje.length,
      familiasUnicas,
      familiasHoje,
      duracaoMedia,
      porHora,
      horarioPico: horarioPico ? `${horarioPico[0]}h (${horarioPico[1]} acessos)` : "—",
    };
  }, [acessos]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const maxHora = Math.max(...Object.values(stats.porHora), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Monitoramento de acessos ao Portal da Família — últimos {dias} dias.</p>
        <select
          className="text-sm border rounded-md px-2 py-1 bg-background"
          value={dias}
          onChange={(e) => setDias(parseInt(e.target.value, 10))}
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={<Activity className="h-4 w-4" />} label="Acessos no período" value={stats.total} />
        <StatCard icon={<Calendar className="h-4 w-4" />} label="Acessos hoje" value={stats.hoje} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Famílias únicas" value={stats.familiasUnicas} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Famílias hoje" value={stats.familiasHoje} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Duração média" value={formatarDuracao(stats.duracaoMedia)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Distribuição por horário do dia</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Horário de pico: <strong className="text-foreground">{stats.horarioPico}</strong></p>
          <div className="grid grid-cols-24 gap-px" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
            {Array.from({ length: 24 }).map((_, h) => {
              const v = stats.porHora[h] || 0;
              const pct = (v / maxHora) * 100;
              return (
                <div key={h} className="flex flex-col items-center gap-1">
                  <div className="w-full bg-muted rounded-sm relative h-24 flex items-end">
                    <div
                      className="w-full bg-primary rounded-sm transition-all"
                      style={{ height: `${pct}%` }}
                      title={`${h}h: ${v} acessos`}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{h}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sessões recentes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2">Quando</th>
                  <th>Participante</th>
                  <th>Duração</th>
                  <th>Ações</th>
                  <th>Dispositivo</th>
                  <th>Match</th>
                </tr>
              </thead>
              <tbody>
                {acessos.slice(0, 100).map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-accent/30">
                    <td className="py-2 whitespace-nowrap">
                      {format(parseISO(a.iniciado_em), "dd/MM HH:mm", { locale: ptBR })}
                    </td>
                    <td className="font-medium">{a.participante_nome || "—"}</td>
                    <td>{formatarDuracao(a.duracao_segundos)}</td>
                    <td>{a.total_acoes}</td>
                    <td className="text-xs text-muted-foreground">{dispositivo(a.user_agent)}</td>
                    <td>
                      <Badge variant={a.match_type === "fuzzy" ? "outline" : "secondary"} className="text-[10px]">
                        {a.match_type || "—"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {acessos.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum acesso registrado no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="border-l-4 border-l-primary/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}