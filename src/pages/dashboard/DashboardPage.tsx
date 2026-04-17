import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, GraduationCap, FileText, BookOpen, TrendingUp, Percent,
  Activity, ArrowUpRight, ArrowDownRight, CalendarDays, Newspaper,
  ClipboardCheck, AlertTriangle, Clock, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend,
} from "recharts";
import { ChartCopyButton } from "@/components/ChartCopyButton";
import DashboardProfissionaisTab from "./DashboardProfissionaisTab";
import DashboardTransporteTab from "./DashboardTransporteTab";
import DashboardAdminTab from "./DashboardAdminTab";
import DashboardRelatorioMensalTab from "./DashboardRelatorioMensalTab";
import { PendenciasIntegridadeBanner } from "@/components/PendenciasIntegridadeBanner";

const COLORS = [
  "hsl(0,58%,56%)", "hsl(210,22%,49%)", "hsl(142,50%,40%)",
  "hsl(45,80%,55%)", "hsl(262,50%,55%)", "hsl(30,70%,55%)",
];
const OBJ_LABELS: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const quickShortcuts = [
  { title: "Relatórios", icon: FileText, url: "/relatorios", color: "hsl(0,58%,56%)" },
  { title: "Cronograma", icon: CalendarDays, url: "/cronograma", color: "hsl(210,22%,49%)" },
  { title: "Feed", icon: Newspaper, url: "/feed", color: "hsl(142,50%,40%)" },
  { title: "Participantes", icon: Users, url: "/participantes", color: "hsl(45,80%,55%)" },
  { title: "Presença", icon: ClipboardCheck, url: "/presenca", color: "hsl(262,50%,55%)" },
];

/* ── KPI Card ── */
function KPICard({ icon: Icon, label, value, sub, color, delta, deltaLabel, tooltip }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
  delta?: number; deltaLabel?: string; tooltip?: string;
}) {
  return (
    <Card
      className="hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: color }}
      title={tooltip}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight truncate uppercase tracking-wider font-semibold">
              {label}
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mt-1">{value}</p>
          </div>
          <Icon size={20} strokeWidth={1.5} style={{ color }} className="shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center gap-1 mt-2">
          {delta !== undefined && delta !== 0 && (
            <>
              {delta > 0 ? (
                <ArrowUpRight size={12} className="text-emerald-600" />
              ) : (
                <ArrowDownRight size={12} className="text-red-500" />
              )}
              <span className={`text-[11px] font-medium ${delta > 0 ? "text-emerald-600" : "text-red-500"}`}>
                {delta > 0 ? "+" : ""}{delta}
              </span>
              <span className="text-[11px] text-muted-foreground">{deltaLabel ?? "vs mês anterior"}</span>
            </>
          )}
          {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Chart Card ── */
function ChartCard({ title, subtitle, children, className }: {
  title: string; subtitle?: string; className?: string;
  children: (ref: React.RefObject<HTMLDivElement | null>) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <Card className={`hover:shadow-md transition-shadow ${className || ""}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        <ChartCopyButton targetRef={ref} />
      </CardHeader>
      <CardContent ref={ref}>{children(ref)}</CardContent>
    </Card>
  );
}

/* ── Period Filter ── */
function PeriodFilter({ mes, ano, onChange }: {
  mes: number | null; ano: number | null;
  onChange: (m: number | null, a: number | null) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={mes !== null ? String(mes) : "all"}
        onValueChange={(v) => onChange(v === "all" ? null : Number(v), ano ?? currentYear)}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os meses</SelectItem>
          {MONTH_NAMES.map((m, i) => (
            <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={ano !== null ? String(ano) : String(currentYear)}
        onValueChange={(v) => onChange(mes, Number(v))}
      >
        <SelectTrigger className="w-[90px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ── Atividades Recentes ── */
function AtividadesRecentes({ data }: { data: any }) {
  const navigate = useNavigate();
  if (!data?.atividadesRecentes?.length) return null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock size={14} className="text-muted-foreground" />
          Atividades Recentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-4 pt-0">
        {data.atividadesRecentes.map((a: any) => (
          <button
            key={a.id}
            onClick={() => navigate(`/relatorios/${a.id}`)}
            className="w-full flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50 transition-colors text-left group"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground truncate">{a.nome_atividade}</p>
              <p className="text-[11px] text-muted-foreground">
                {a.educador} · {a.num_participantes} participantes
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <span className="text-[11px] text-muted-foreground">
                {new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </span>
              <ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Alerta Card ── */
function AlertaCard({ count }: { count: number }) {
  if (!count) return null;
  return (
    <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: "hsl(45,80%,55%)" }}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "hsl(45,80%,95%)" }}>
          <AlertTriangle size={18} style={{ color: "hsl(45,80%,40%)" }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{count} participante{count > 1 ? "s" : ""} em alerta</p>
          <p className="text-[11px] text-muted-foreground">3+ faltas consecutivas recentes</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Indicadores Tab ── */
function IndicadoresTab() {
  const [mes, setMes] = useState<number | null>(null);
  const [ano, setAno] = useState<number | null>(null);
  const { data, loading } = useDashboardData(mes, ano);
  const navigate = useNavigate();

  if (loading || !data) return <div className="p-6 text-sm text-muted-foreground">Carregando indicadores...</div>;

  const periodLabel = mes ? `${MONTH_NAMES[mes - 1]} ${ano}` : "Todos os períodos";

  return (
    <div className="space-y-5">
      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </div>
        <PeriodFilter mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
      </div>

      {/* Quick shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {quickShortcuts.map((s) => (
          <button
            key={s.title}
            onClick={() => navigate(s.url)}
            className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-card hover:shadow-md transition-all text-left border-l-4"
            style={{ borderLeftColor: s.color }}
          >
            <s.icon size={16} strokeWidth={1.8} style={{ color: s.color }} />
            <span className="text-xs font-medium text-foreground">{s.title}</span>
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          icon={Users}
          label="Participantes Ativos"
          value={data.totalParticipantesAtivos}
          delta={data.deltaParticipantes}
          deltaLabel="vs 30 dias atrás"
          tooltip="Comparação de cadastros ativos hoje vs há 30 dias (baseado em iniciou_em / data_desligamento)"
          color="hsl(210,60%,50%)"
        />
        <KPICard icon={TrendingUp} label="Frequência Geral" value={`${data.taxaFrequenciaGeral}%`} color="hsl(142,50%,40%)" />
        <KPICard icon={GraduationCap} label="Turmas Ativas" value={data.totalTurmasAtivas} color="hsl(262,50%,55%)" />
        <KPICard
          icon={FileText}
          label="Relatórios"
          value={data.totalRelatorios}
          sub={data.totalConsolidadosChamada > 0 ? `+${data.totalConsolidadosChamada} consolidados` : undefined}
          tooltip="Relatórios pedagógicos reais (exclui consolidados de chamada física importada)"
          color="hsl(0,58%,56%)"
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={BookOpen} label="Planejamentos" value={data.totalPlanejamentos} color="hsl(30,70%,55%)" />
        <KPICard
          icon={TrendingUp}
          label="Média ELO"
          value={data.mediaELO.toFixed(2)}
          sub={`n=${data.mediaELON} relatórios`}
          color="hsl(0,58%,56%)"
        />
        <KPICard
          icon={Percent}
          label="Média Adesão"
          value={`${data.mediaAdesao.toFixed(0)}%`}
          sub={data.mediaAdesaoConsolidada > 0 ? `consol.: ${data.mediaAdesaoConsolidada.toFixed(0)}%` : undefined}
          tooltip="Média de adesão calculada apenas sobre relatórios pedagógicos reais"
          color="hsl(210,22%,49%)"
        />
        <KPICard icon={Activity} label="Educadores Ativos" value={data.topEducadores.length} sub="com relatórios" color="hsl(142,50%,40%)" />
      </div>

      {/* Alerta */}
      <AlertaCard count={data.totalParticipantesAlerta} />
      {/* Main charts + Recent activities */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <ChartCard title="Frequência Mensal" subtitle="Presentes vs Total · meses parciais marcados com *" className="lg:col-span-3">
          {(ref) => (
            <div className="h-52" ref={ref}>
              {data.presencaMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.presencaMensal.map((m) => ({ ...m, mesLabel: m.parcial ? `${m.mes}*` : m.mes }))} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} width={35} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      labelFormatter={(label: string) => label.endsWith("*") ? `${label.replace("*","")} (parcial)` : label}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="total" name="Total" fill="hsl(215,20%,93%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="presentes" name="Presentes" fill="hsl(0,58%,56%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados de presença</p>}
            </div>
          )}
        </ChartCard>

        <div className="lg:col-span-2">
          <AtividadesRecentes data={data} />
        </div>
      </div>

      {/* Evolution charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Evolução de Presença (%)" subtitle="Últimos meses">
          {(ref) => (
            <div className="h-52" ref={ref}>
              {data.presencaMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.presencaMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => `${v}%`} />
                    <Line type="monotone" dataKey="pct" name="% Presença" stroke="hsl(0,58%,56%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(0,58%,56%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Score ELO Mensal">
          {() => (
            <div className="h-52">
              {data.eloMensal.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.eloMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="elo" name="ELO" stroke="hsl(0,58%,56%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(0,58%,56%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard title="Faixa Etária">
          {() => (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.participantesPorFaixa}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" name="Participantes" fill="hsl(0,58%,56%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Gênero">
          {() => (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.participantesPorGenero} dataKey="count" nameKey="genero" cx="50%" cy="50%" outerRadius={65} label={({ genero, percent }) => `${genero} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                    {data.participantesPorGenero.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Período">
          {() => (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.participantesPorPeriodo} dataKey="count" nameKey="periodo" cx="50%" cy="50%" outerRadius={65} label={({ periodo, percent }) => `${periodo} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                    {data.participantesPorPeriodo.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Bairro + Educadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Bairro (top 10)">
          {() => (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.participantesPorBairro} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="bairro" tick={{ fontSize: 9, fill: "hsl(215,14%,46%)" }} width={80} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" name="Participantes" fill="hsl(210,22%,49%)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Top Educadores (Relatórios)">
          {() => (
            <div className="h-52">
              {data.topEducadores.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topEducadores} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 9, fill: "hsl(215,14%,46%)" }} width={80} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" name="Relatórios" fill="hsl(142,50%,40%)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Competências + Adesão + Objetivos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard title="Competências ELO">
          {() => (
            <div className="h-56">
              {data.competencias.some(c => c.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data.competencias}>
                    <PolarGrid stroke="hsl(220,13%,90%)" />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(215,14%,46%)" }} />
                    <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9, fill: "hsl(215,14%,46%)" }} />
                    <Radar name="Média" dataKey="value" stroke="hsl(0,58%,56%)" fill="hsl(0,58%,56%)" fillOpacity={0.25} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
            </div>
          )}
        </ChartCard>

        <ChartCard title="% Adesão Mensal">
          {() => (
            <div className="h-56">
              {data.adesaoMensal.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.adesaoMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="adesao" name="Adesão %" stroke="hsl(210,22%,49%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(210,22%,49%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Objetivos Alcançados">
          {() => (
            <div className="h-56">
              {data.objetivos.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.objetivos.map(o => ({ ...o, label: OBJ_LABELS[o.status] || o.status }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(215,14%,46%)" }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" name="Relatórios" radius={[3, 3, 0, 0]}>
                      {data.objetivos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-xs text-muted-foreground">Visão geral do projeto</p>
      </div>

      <PendenciasIntegridadeBanner />

      <Tabs defaultValue="indicadores" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="indicadores" className="text-xs sm:text-sm">Indicadores</TabsTrigger>
          <TabsTrigger value="profissionais" className="text-xs sm:text-sm">Profissionais</TabsTrigger>
          <TabsTrigger value="transporte" className="text-xs sm:text-sm">Transporte</TabsTrigger>
          <TabsTrigger value="relatorio-mensal" className="text-xs sm:text-sm">Rel. Mensal</TabsTrigger>
          <TabsTrigger value="admin" className="text-xs sm:text-sm">Admin</TabsTrigger>
        </TabsList>
        <TabsContent value="indicadores"><IndicadoresTab /></TabsContent>
        <TabsContent value="profissionais"><DashboardProfissionaisTab /></TabsContent>
        <TabsContent value="transporte"><DashboardTransporteTab /></TabsContent>
        <TabsContent value="relatorio-mensal"><DashboardRelatorioMensalTab /></TabsContent>
        <TabsContent value="admin"><DashboardAdminTab /></TabsContent>
      </Tabs>
    </div>
  );
}
