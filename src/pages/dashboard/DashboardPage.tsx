import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  Users, GraduationCap, FileText, BookOpen, TrendingUp, Percent,
  Activity, ArrowUpRight, ArrowDownRight, CalendarDays, Newspaper,
  ClipboardCheck, AlertTriangle, Clock, CalendarIcon, X, CalendarRange,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, LabelList,
} from "recharts";
import { ChartCopyButton } from "@/components/ChartCopyButton";
import DashboardProfissionaisTab from "./DashboardProfissionaisTab";
import DashboardAdminTab from "./DashboardAdminTab";
import DashboardRelatorioMensalTab from "./DashboardRelatorioMensalTab";
import { PendenciasIntegridadeBanner } from "@/components/PendenciasIntegridadeBanner";
import { PageHeader } from "@/components/PageHeader";
import { LayoutDashboard } from "lucide-react";
import { IndicadorTimelineDrawer } from "@/components/dashboard/IndicadorTimelineDrawer";
import type { IndicadorId } from "@/lib/indicadorTimelineFetchers";
import { formatMesLabel, formatMesExtenso } from "@/lib/dateLabels";
import { eloColor } from "@/lib/eloColors";
import { RichTooltip } from "@/components/dashboard/RichTooltip";
import { chartColors, gridProps } from "@/lib/chartTheme";

const COLORS = [
  "hsl(0,58%,56%)", "hsl(210,22%,49%)", "hsl(142,50%,40%)",
  "hsl(45,80%,55%)", "hsl(262,50%,55%)", "hsl(30,70%,55%)",
];
const OBJ_LABELS: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toIso(d?: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const quickShortcuts = [
  { title: "Relatórios", icon: FileText, url: "/relatorios", color: "hsl(0,58%,56%)" },
  { title: "Cronograma", icon: CalendarDays, url: "/cronograma", color: "hsl(210,22%,49%)" },
  { title: "Feed", icon: Newspaper, url: "/feed", color: "hsl(142,50%,40%)" },
  { title: "Participantes", icon: Users, url: "/participantes", color: "hsl(45,80%,55%)" },
  { title: "Presença", icon: ClipboardCheck, url: "/presenca", color: "hsl(262,50%,55%)" },
];

/* ── KPI Card ── */
function KPICard({ icon: Icon, label, value, sub, color, delta, deltaLabel, tooltip, onClick }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
  delta?: number; deltaLabel?: string; tooltip?: string; onClick?: () => void;
}) {
  const interactive = !!onClick;
  return (
    <Card
      className={`hover:shadow-md transition-shadow border-l-4 ${
        interactive ? "cursor-pointer hover:ring-2 hover:ring-primary/30 focus-within:ring-2 focus-within:ring-primary/40" : ""
      }`}
      style={{ borderLeftColor: color }}
      title={tooltip ?? (interactive ? "Clique para ver evolução e histórico técnico" : undefined)}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
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
function PeriodFilter({ mes, ano, onChange, range, onRangeChange }: {
  mes: number | null; ano: number | null;
  onChange: (m: number | null, a: number | null) => void;
  range: DateRange | undefined;
  onRangeChange: (r: DateRange | undefined) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const intervaloAtivo = !!range?.from;

  const rangeLabel = range?.from
    ? range.to
      ? `${format(range.from, "dd/MM/yy", { locale: ptBR })} – ${format(range.to, "dd/MM/yy", { locale: ptBR })}`
      : format(range.from, "dd/MM/yy", { locale: ptBR })
    : "Intervalo de datas";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={mes !== null ? String(mes) : "all"}
        onValueChange={(v) => onChange(v === "all" ? null : Number(v), ano ?? currentYear)}
        disabled={intervaloAtivo}
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
        disabled={intervaloAtivo}
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

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 px-2.5 text-xs font-normal gap-1.5",
              !range?.from && "text-muted-foreground",
            )}
          >
            <CalendarIcon size={12} />
            {rangeLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={range}
            onSelect={onRangeChange}
            numberOfMonths={2}
            locale={ptBR}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      {range?.from && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground"
          onClick={() => onRangeChange(undefined)}
          title="Limpar intervalo"
        >
          <X size={12} />
        </Button>
      )}
    </div>
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
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [selectedIndicator, setSelectedIndicator] = useState<IndicadorId | null>(null);
  const dataInicio = range?.from ? toIso(range.from) : null;
  const dataFim = range?.from ? toIso(range.to ?? range.from) : null;
  const { data, loading } = useDashboardData(mes, ano, dataInicio, dataFim);
  const navigate = useNavigate();

  if (loading || !data) return <div className="p-6 text-sm text-muted-foreground">Carregando indicadores...</div>;

  const periodLabel = range?.from
    ? range.to
      ? `${format(range.from, "dd/MM/yyyy", { locale: ptBR })} até ${format(range.to, "dd/MM/yyyy", { locale: ptBR })}`
      : format(range.from, "dd/MM/yyyy", { locale: ptBR })
    : mes ? `${MONTH_NAMES[mes - 1]} ${ano}` : "Todos os períodos";

  return (
    <div className="space-y-5">
      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
          {range?.from && (
            <p className="text-[10px] text-muted-foreground/80 mt-0.5">
              Intervalo aplicado a todos os indicadores (substitui filtro de mês/ano)
            </p>
          )}
        </div>
        <PeriodFilter
          mes={mes}
          ano={ano}
          onChange={(m, a) => { setMes(m); setAno(a); }}
          range={range}
          onRangeChange={setRange}
        />
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
          deltaLabel="vs período anterior"
          tooltip={`Total = participantes ativos no período selecionado (ou ativos hoje, se sem filtro). Δ = distintos com presença registrada no período (${data.participantesAtivosMesAtual}) vs período anterior equivalente (${data.participantesAtivosMesAnterior}).`}
          color="hsl(210,60%,50%)"
          onClick={() => setSelectedIndicator("participantes")}
        />
        <KPICard icon={TrendingUp} label="Frequência Geral" value={`${data.taxaFrequenciaGeral}%`} color="hsl(142,50%,40%)" onClick={() => setSelectedIndicator("frequencia")} />
        <KPICard icon={GraduationCap} label="Turmas Ativas" value={data.totalTurmasAtivas} color="hsl(262,50%,55%)" onClick={() => setSelectedIndicator("turmas")} />
        <KPICard
          icon={FileText}
          label="Relatórios"
          value={data.totalRelatorios}
          sub={data.totalConsolidadosChamada > 0 ? `+${data.totalConsolidadosChamada} consolidados` : undefined}
          tooltip="Relatórios pedagógicos reais (exclui consolidados de chamada física importada)"
          color="hsl(0,58%,56%)"
          onClick={() => setSelectedIndicator("relatorios")}
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={BookOpen} label="Planejamentos" value={data.totalPlanejamentos} color="hsl(30,70%,55%)" onClick={() => setSelectedIndicator("planejamentos")} />
        <KPICard
          icon={TrendingUp}
          label="Média ELO"
          value={data.mediaELO.toFixed(2)}
          sub={`n=${data.mediaELON} relatórios`}
          color="hsl(0,58%,56%)"
          onClick={() => setSelectedIndicator("elo")}
        />
        <KPICard
          icon={Percent}
          label="Média Adesão"
          value={`${data.mediaAdesao.toFixed(0)}%`}
          sub={data.mediaAdesaoConsolidada > 0 ? `consol.: ${data.mediaAdesaoConsolidada.toFixed(0)}%` : undefined}
          tooltip="% de adesão é congelada na data do lançamento de cada relatório (presentes / esperados naquele dia). Não é afetada por desligamentos retroativos."
          color="hsl(210,22%,49%)"
          onClick={() => setSelectedIndicator("adesao")}
        />
        <KPICard icon={Activity} label="Educadores Ativos" value={data.topEducadores.length} sub="com relatórios" color="hsl(142,50%,40%)" onClick={() => setSelectedIndicator("educadores")} />
      </div>

      {/* Frequência Atual (mês corrente parcial) */}
      {(() => {
        const atual = data.presencaMensal.find((m) => m.parcial) ?? data.presencaMensal[data.presencaMensal.length - 1];
        if (!atual) return null;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KPICard
              icon={CalendarRange}
              label={`Frequência Atual · ${formatMesExtenso(atual.mes)}${atual.parcial ? " (parcial)" : ""}`}
              value={`${atual.pct}%`}
              sub={`${atual.presentes} presenças em ${atual.total} registros lançados`}
              tooltip="Cada relatório gera 1 registro por participante esperado. O total cresce conforme novas atividades são lançadas — não é a frequência esperada do mês."
              color="hsl(142,50%,40%)"
              onClick={() => setSelectedIndicator("frequencia")}
            />
          </div>
        );
      })()}

      {/* Alerta */}
      <AlertaCard count={data.totalParticipantesAlerta} />
      {/* Frequência Mensal — Tendência (linha) + Comparativo (barras) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Frequência Mensal — Tendência" subtitle="Últimos meses · % de presença">
          {(ref) => (
            <div className="h-52" ref={ref}>
              {data.presencaMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.presencaMensal.map((m) => ({ ...m, mesLabel: formatMesLabel(m.mes) + (m.parcial ? "*" : "") }))}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<RichTooltip
                      labelFormatter={(l) => l.endsWith("*") ? `${l.replace("*","")} (parcial)` : l}
                      valueFormatter={(v) => `${v}%`}
                    />} />
                    <Line type="monotone" dataKey="pct" name="% Presença" stroke="hsl(0,58%,56%)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(0,58%,56%)" }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados de presença</p>}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Frequência Mensal — Comparativo" subtitle="Registros lançados × presenças confirmadas">
          {(ref) => {
            const ult = data.presencaMensal.slice(-2);
            return (
              <div className="h-52" ref={ref}>
                {ult.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ult.map((m) => ({ ...m, mesLabel: formatMesLabel(m.mes) + (m.parcial ? "*" : "") }))} barGap={4}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} width={35} allowDecimals={false} />
                      <Tooltip content={<RichTooltip labelFormatter={(l) => l.endsWith("*") ? `${l.replace("*","")} (parcial)` : l} />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="total" name="Registros" fill={chartColors.graySecondary} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="presentes" name="Presenças" fill="hsl(0,58%,56%)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
              </div>
            );
          }}
        </ChartCard>
      </div>

      {/* Evolution charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Evolução de Presença (%)" subtitle="Últimos meses">
          {(ref) => (
            <div className="h-52" ref={ref}>
              {data.presencaMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.presencaMensal.map((m) => ({ ...m, mesLabel: formatMesLabel(m.mes) }))}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<RichTooltip valueFormatter={(v) => `${v}%`} />} />
                    <Line type="monotone" dataKey="pct" name="% Presença" stroke="hsl(0,58%,56%)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(0,58%,56%)" }} activeDot={{ r: 5 }} />
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
                  <LineChart data={data.eloMensal.map((m) => ({ ...m, mesLabel: formatMesLabel(m.mes) }))}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<RichTooltip valueFormatter={(v) => v.toFixed(2)} />} />
                    <Line type="monotone" dataKey="elo" name="ELO" stroke="hsl(0,58%,56%)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(0,58%,56%)" }} activeDot={{ r: 5 }} />
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
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
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
        <ChartCard title="Distribuição por Bairros">
          {() => (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.participantesPorBairro} layout="vertical">
                  <CartesianGrid {...gridProps} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="bairro" tick={{ fontSize: 9, fill: chartColors.text }} width={80} axisLine={false} tickLine={false} />
                  <Tooltip content={<RichTooltip />} />
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
                    <CartesianGrid {...gridProps} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 9, fill: chartColors.text }} width={80} axisLine={false} tickLine={false} />
                    <Tooltip content={<RichTooltip />} />
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
        <ChartCard title="Competências ELO" subtitle="Cores escalares por pontuação">
          {() => (
            <div className="h-56">
              {data.competencias.some(c => c.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.competencias} margin={{ top: 18, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<RichTooltip valueFormatter={(v) => v.toFixed(2)} />} />
                    <Bar dataKey="value" name="Média" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="value" position="top" formatter={(v: any) => Number(v).toFixed(1)} style={{ fontSize: 10, fill: chartColors.text, fontWeight: 600 }} />
                      {data.competencias.map((c, i) => <Cell key={i} fill={eloColor(c.value)} />)}
                    </Bar>
                  </BarChart>
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
                  <LineChart data={data.adesaoMensal.map((m) => ({ ...m, mesLabel: formatMesLabel(m.mes) }))}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<RichTooltip valueFormatter={(v) => `${v}%`} />} />
                    <Line type="monotone" dataKey="adesao" name="Adesão %" stroke="hsl(210,22%,49%)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(210,22%,49%)" }} activeDot={{ r: 5 }} />
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
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                    <Tooltip content={<RichTooltip />} />
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

      <IndicadorTimelineDrawer
        indicadorId={selectedIndicator}
        onClose={() => setSelectedIndicator(null)}
      />
    </div>
  );
}

function DashboardHeader() {
  const { data } = useDashboardData();
  const dataCorte = data?.dataInicioOperacional;
  const dataFmt = dataCorte
    ? new Date(dataCorte + "T00:00:00").toLocaleDateString("pt-BR")
    : null;
  return (
    <PageHeader
      icon={<LayoutDashboard className="h-5 w-5" />}
      title="Dashboard"
      subtitle="Visão geral do projeto"
      actions={dataFmt ? (
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-muted/40 text-[11px] text-muted-foreground"
          title={`Indicadores institucionais consideram apenas dados a partir de ${dataFmt}, marco operacional do SysCFV.`}
        >
          <Clock size={12} className="opacity-70" />
          <span>Indicadores a partir de {dataFmt}</span>
        </div>
      ) : undefined}
    />
  );
}


export default function DashboardPage() {
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 max-w-[1400px]">
      <DashboardHeader />

      <PendenciasIntegridadeBanner />

      <Tabs defaultValue="indicadores" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="indicadores" className="text-xs sm:text-sm">Indicadores</TabsTrigger>
          <TabsTrigger value="profissionais" className="text-xs sm:text-sm">Profissionais</TabsTrigger>
          <TabsTrigger value="relatorio-mensal" className="text-xs sm:text-sm">Rel. Mensal</TabsTrigger>
          <TabsTrigger value="admin" className="text-xs sm:text-sm">Admin</TabsTrigger>
        </TabsList>
        <TabsContent value="indicadores"><IndicadoresTab /></TabsContent>
        <TabsContent value="profissionais"><DashboardProfissionaisTab /></TabsContent>
        <TabsContent value="relatorio-mensal"><DashboardRelatorioMensalTab /></TabsContent>
        <TabsContent value="admin"><DashboardAdminTab /></TabsContent>
      </Tabs>
    </div>
  );
}
