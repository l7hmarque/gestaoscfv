import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardData, type DashboardDimFilters } from "@/hooks/useDashboardData";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { PERIODO_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  Users, GraduationCap, FileText, BookOpen, TrendingUp, Percent,
  Activity, ArrowUpRight, ArrowDownRight, CalendarDays, Newspaper,
  ClipboardCheck, AlertTriangle, Clock, CalendarIcon, X, CalendarRange, Cake, UserCheck,
  Sun, CloudSun,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, LabelList,
} from "recharts";
import { ChartCopyButton } from "@/components/ChartCopyButton";
import DashboardProfissionaisTab from "./DashboardProfissionaisTab";
import { PendenciasIntegridadeBanner } from "@/components/PendenciasIntegridadeBanner";
import { PageHeader } from "@/components/PageHeader";
import { LayoutDashboard } from "lucide-react";
import { IndicadorTimelineDrawer } from "@/components/dashboard/IndicadorTimelineDrawer";
import type { IndicadorId } from "@/lib/indicadorTimelineFetchers";
import { formatMesLabel, formatMesExtenso } from "@/lib/dateLabels";
import { RichTooltip } from "@/components/dashboard/RichTooltip";
import { chartColors, gridProps } from "@/lib/chartTheme";

const RED = "hsl(0,58%,56%)";
const BLUE = "hsl(210,80%,50%)";
// Paleta de tons distintos derivada de azul/vermelho para múltiplas séries (bairros)
const MULTI_TONES = [
  "hsl(210,80%,40%)", "hsl(210,75%,55%)", "hsl(210,60%,70%)",
  "hsl(0,65%,45%)",   "hsl(0,58%,60%)",   "hsl(0,45%,75%)",
  "hsl(220,40%,35%)", "hsl(195,55%,50%)", "hsl(15,55%,55%)",
];

const GENERO_LABELS: Record<string, string> = { feminino: "Feminino", masculino: "Masculino", outro: "Outro" };

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toIso(d?: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function IdadeRangeFilter({
  idadeMin,
  idadeMax,
  onApply,
  onClear,
}: {
  idadeMin: number | null;
  idadeMax: number | null;
  onApply: (min: number | null, max: number | null) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [minStr, setMinStr] = useState<string>(idadeMin != null ? String(idadeMin) : "");
  const [maxStr, setMaxStr] = useState<string>(idadeMax != null ? String(idadeMax) : "");
  useEffect(() => {
    setMinStr(idadeMin != null ? String(idadeMin) : "");
    setMaxStr(idadeMax != null ? String(idadeMax) : "");
  }, [idadeMin, idadeMax]);
  const active = idadeMin != null || idadeMax != null;
  const apply = () => {
    const parseN = (s: string) => {
      if (s.trim() === "") return null;
      const n = parseInt(s, 10);
      if (Number.isNaN(n)) return null;
      return Math.min(120, Math.max(0, n));
    };
    let mn = parseN(minStr);
    let mx = parseN(maxStr);
    if (mn != null && mx != null && mn > mx) [mn, mx] = [mx, mn];
    onApply(mn, mx);
    setOpen(false);
  };
  const clear = () => { setMinStr(""); setMaxStr(""); onClear(); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={active ? "default" : "outline"} size="sm" className="h-9 gap-1.5">
          <Cake size={14} />
          {active ? `${idadeMin ?? 0}–${idadeMax ?? 120} anos` : "Idade"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="end">
        <div>
          <p className="text-xs font-semibold mb-2">Intervalo de idade (anos)</p>
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={120} placeholder="Mín" value={minStr} onChange={(e) => setMinStr(e.target.value)} className="h-8 text-sm" />
            <span className="text-muted-foreground text-xs">até</span>
            <Input type="number" min={0} max={120} placeholder="Máx" value={maxStr} onChange={(e) => setMaxStr(e.target.value)} className="h-8 text-sm" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">Substitui o filtro de faixa categórica.</p>
        </div>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clear}>Limpar</Button>
          <Button size="sm" className="h-7 text-xs" onClick={apply}>Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
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
function ChartCard({ title, subtitle, children, className, action }: {
  title: string; subtitle?: string; className?: string; action?: React.ReactNode;
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
        <div className="flex items-center gap-2">
          {action}
          <ChartCopyButton targetRef={ref} />
        </div>
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
  const [dim, setDim] = useState<DashboardDimFilters>({});
  const [bairros, setBairros] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    supabase.from("bairros").select("id, nome").then(({ data }) => {
      if (data) setBairros(data as { id: string; nome: string }[]);
    });
  }, []);

  const dataInicio = range?.from ? toIso(range.from) : null;
  const dataFim = range?.from ? toIso(range.to ?? range.from) : null;
  const { data, loading, error } = useDashboardData(mes, ano, dataInicio, dataFim, dim);
  const navigate = useNavigate();

  const toggleDim = <K extends keyof DashboardDimFilters>(key: K, value: NonNullable<DashboardDimFilters[K]> | null) => {
    setDim((prev) => {
      const cur = prev[key] ?? null;
      if (cur === value || value === null) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  };
  const clearDim = () => setDim({});
  const bairroNomeById = (id: string) => bairros.find((b) => b.id === id)?.nome ?? id;
  const bairroIdByNome = (nome: string) => bairros.find((b) => b.nome === nome)?.id;
  const applyIdadeRange = (min: number | null, max: number | null) => {
    setDim((prev) => {
      const next = { ...prev };
      delete next.faixa;
      if (min == null) delete next.idadeMin; else next.idadeMin = min;
      if (max == null) delete next.idadeMax; else next.idadeMax = max;
      return next;
    });
  };
  const clearIdadeRange = () => setDim((p) => { const n = { ...p }; delete n.idadeMin; delete n.idadeMax; return n; });
  const toggleFaixaBar = (faixa: string) => {
    setDim((prev) => {
      const next = { ...prev };
      delete next.idadeMin;
      delete next.idadeMax;
      if (prev.faixa === faixa) delete next.faixa;
      else next.faixa = faixa;
      return next;
    });
  };
  const activeChips: { id: string; label: string; onRemove: () => void }[] = [];
  if (dim.faixa) activeChips.push({ id: "faixa", label: `Faixa: ${dim.faixa}`, onRemove: () => setDim((p) => { const n = { ...p }; delete n.faixa; return n; }) });
  if (dim.idadeMin != null || dim.idadeMax != null) {
    const lbl = `Idade: ${dim.idadeMin ?? "0"}–${dim.idadeMax ?? "120"} anos`;
    activeChips.push({ id: "idade", label: lbl, onRemove: clearIdadeRange });
  }
  if (dim.genero) activeChips.push({ id: "genero", label: `Gênero: ${GENERO_LABELS[dim.genero] ?? dim.genero}`, onRemove: () => setDim((p) => { const n = { ...p }; delete n.genero; return n; }) });
  if (dim.bairroId) activeChips.push({ id: "bairroId", label: `Bairro: ${bairroNomeById(dim.bairroId)}`, onRemove: () => setDim((p) => { const n = { ...p }; delete n.bairroId; return n; }) });
  if (dim.periodo) activeChips.push({ id: "periodo", label: `Período: ${PERIODO_LABELS[dim.periodo] ?? dim.periodo}`, onRemove: () => setDim((p) => { const n = { ...p }; delete n.periodo; return n; }) });

  if (loading && !data) return <div className="p-6 text-sm text-muted-foreground">Carregando indicadores...</div>;
  if (error) return <div className="p-6 text-sm text-destructive">Erro ao carregar indicadores: {(error as Error).message}</div>;
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Nenhum indicador encontrado para o período selecionado.</div>;

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
        <Button
          variant={dim.apenasAtivos === false ? "outline" : "default"}
          size="sm"
          onClick={() =>
            setDim((p) => {
              const next = { ...p };
              if (next.apenasAtivos === false) delete next.apenasAtivos;
              else next.apenasAtivos = false;
              return next;
            })
          }
          className="gap-1.5"
          title={dim.apenasAtivos === false ? "Mostrando todos os participantes (clique para limitar a ativos)" : "Mostrando apenas participantes ativos (clique para incluir todos)"}
        >
          <UserCheck className="w-3.5 h-3.5" />
          {dim.apenasAtivos === false ? "Todos" : "Apenas ativos"}
        </Button>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-md border border-primary/30 bg-primary/5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Filtros ativos</span>
          {activeChips.map((c) => (
            <Badge
              key={c.id}
              variant="secondary"
              className="cursor-pointer gap-1 hover:bg-destructive/10"
              onClick={c.onRemove}
              title="Clique para remover"
            >
              {c.label} <X size={10} />
            </Badge>
          ))}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] ml-auto" onClick={clearDim}>
            Limpar tudo
          </Button>
          {loading && <span className="text-[11px] text-muted-foreground">atualizando...</span>}
        </div>
      )}

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
          tooltip={`Com filtro: participantes distintos com pelo menos 1 presença registrada no período. Sem filtro: cadastros com status 'ativo'. Δ vs período anterior equivalente (${data.participantesAtivosMesAnterior}).`}
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

      {/* Frequência Mensal — Tendência (linha azul) + Comparativo (barras horizontais) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Frequência Mensal — Tendência" subtitle="Últimos meses · % de presença">
          {(ref) => (
            <div className="h-52" ref={ref}>
              {data.presencaMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.presencaMensal.map((m) => ({ ...m, mesLabel: formatMesLabel(m.mes) + (m.parcial ? "*" : "") }))}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<RichTooltip
                      labelFormatter={(l) => l.endsWith("*") ? `${l.replace("*","")} (parcial)` : l}
                      valueFormatter={(v) => `${v}%`}
                    />} />
                    <Line type="monotone" dataKey="pct" name="% Presença" stroke={BLUE} strokeWidth={2.5} dot={{ r: 3, fill: BLUE }} activeDot={{ r: 5 }} />
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
                    <BarChart layout="vertical" data={ult.map((m) => ({ ...m, mesLabel: formatMesLabel(m.mes) + (m.parcial ? "*" : "") }))} barGap={4}>
                      <CartesianGrid {...gridProps} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="mesLabel" tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip content={<RichTooltip labelFormatter={(l) => l.endsWith("*") ? `${l.replace("*","")} (parcial)` : l} />} />
                      <Legend wrapperStyle={{ fontSize: 10, color: chartColors.text }} />
                      <Bar dataKey="total" name="Registros" fill={BLUE} radius={[0, 3, 3, 0]}>
                        <LabelList dataKey="total" position="insideRight" style={{ fontSize: 10, fill: "#fff", fontWeight: 600 }} />
                      </Bar>
                      <Bar dataKey="presentes" name="Presenças" fill={RED} radius={[0, 3, 3, 0]}>
                        <LabelList dataKey="presentes" position="insideRight" style={{ fontSize: 10, fill: "#fff", fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
              </div>
            );
          }}
        </ChartCard>
      </div>

      {/* Evolução de Presença (linha azul) + Score ELO Mensal (digital) + % Adesão Mensal (digital) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ChartCard title="Evolução de Presença (%)" subtitle="Últimos meses" className="lg:col-span-2">
          {(ref) => (
            <div className="h-44" ref={ref}>
              {data.presencaMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.presencaMensal.map((m) => ({ ...m, mesLabel: formatMesLabel(m.mes) }))}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: chartColors.text }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<RichTooltip valueFormatter={(v) => `${v}%`} />} />
                    <Line type="monotone" dataKey="pct" name="% Presença" stroke={BLUE} strokeWidth={2.5} dot={{ r: 3, fill: BLUE }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Score ELO do Mês">
          {() => {
            const last = data.eloMensal[data.eloMensal.length - 1];
            return (
              <div className="h-44 flex flex-col items-center justify-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {last ? formatMesLabel(last.mes) : "—"}
                </p>
                <p className="text-6xl font-bold tabular-nums" style={{ color: RED }}>
                  {last ? last.elo.toFixed(2) : "0.00"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">de 5,00</p>
              </div>
            );
          }}
        </ChartCard>

        <ChartCard title="% Adesão Mensal">
          {() => {
            const last = data.adesaoMensal[data.adesaoMensal.length - 1];
            return (
              <div className="h-44 flex flex-col items-center justify-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {last ? formatMesLabel(last.mes) : "—"}
                </p>
                <p className="text-6xl font-bold tabular-nums" style={{ color: BLUE }}>
                  {last ? `${Math.round(last.adesao)}%` : "0%"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">adesão média</p>
              </div>
            );
          }}
        </ChartCard>
      </div>

      {/* Demographics: Faixa Etária (pizza), Gênero (símbolos), Período (sol/sol-nuvem) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard
          title="Faixa Etária"
          action={
            <IdadeRangeFilter
              idadeMin={dim.idadeMin ?? null}
              idadeMax={dim.idadeMax ?? null}
              onApply={applyIdadeRange}
              onClear={clearIdadeRange}
            />
          }
        >
          {() => (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.participantesPorFaixa}
                    dataKey="count"
                    nameKey="faixa"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ faixa, percent }) => `${faixa} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    style={{ fontSize: 10, cursor: "pointer", fill: chartColors.text }}
                    onClick={(e: any) => { if (e?.faixa) toggleFaixaBar(e.faixa); }}
                  >
                    {data.participantesPorFaixa.map((row, i) => (
                      <Cell
                        key={i}
                        fill={i % 2 === 0 ? RED : BLUE}
                        fillOpacity={!dim.faixa || dim.faixa === row.faixa ? 1 - (i * 0.08) : 0.25}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Gênero">
          {() => {
            const total = data.participantesPorGenero.reduce((a, b) => a + b.count, 0) || 1;
            const getPct = (key: string) => {
              const r = data.participantesPorGenero.find((x) => x.genero === key);
              return r ? Math.round((r.count / total) * 100) : 0;
            };
            const fem = getPct("feminino");
            const masc = getPct("masculino");
            return (
              <div className="h-52 flex items-center justify-around">
                <button
                  onClick={() => toggleDim("genero", "masculino")}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 py-3 rounded-md transition-all",
                    dim.genero === "masculino" && "ring-2 ring-offset-1",
                    !dim.genero || dim.genero === "masculino" ? "opacity-100" : "opacity-40",
                  )}
                  style={{ color: BLUE }}
                >
                  <span className="text-5xl font-bold leading-none">♂</span>
                  <span className="text-2xl font-bold tabular-nums" style={{ color: chartColors.text }}>{masc}%</span>
                  <span className="text-[10px] text-muted-foreground">Masculino</span>
                </button>
                <button
                  onClick={() => toggleDim("genero", "feminino")}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 py-3 rounded-md transition-all",
                    dim.genero === "feminino" && "ring-2 ring-offset-1",
                    !dim.genero || dim.genero === "feminino" ? "opacity-100" : "opacity-40",
                  )}
                  style={{ color: RED }}
                >
                  <span className="text-5xl font-bold leading-none">♀</span>
                  <span className="text-2xl font-bold tabular-nums" style={{ color: chartColors.text }}>{fem}%</span>
                  <span className="text-[10px] text-muted-foreground">Feminino</span>
                </button>
              </div>
            );
          }}
        </ChartCard>

        <ChartCard title="Período">
          {() => {
            const total = data.participantesPorPeriodo.reduce((a, b) => a + b.count, 0) || 1;
            const getPct = (key: string) => {
              const r = data.participantesPorPeriodo.find((x) => x.periodo === key);
              return r ? Math.round((r.count / total) * 100) : 0;
            };
            const manha = getPct("manha");
            const tarde = getPct("tarde");
            return (
              <div className="h-52 flex items-center justify-around">
                <button
                  onClick={() => toggleDim("periodo", "manha")}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md transition-all",
                    dim.periodo === "manha" && "ring-2 ring-offset-1",
                    !dim.periodo || dim.periodo === "manha" ? "opacity-100" : "opacity-40",
                  )}
                >
                  <Sun size={48} strokeWidth={1.8} style={{ color: RED }} />
                  <div className="text-left">
                    <p className="text-2xl font-bold tabular-nums" style={{ color: chartColors.text }}>{manha}%</p>
                    <p className="text-[10px] text-muted-foreground">Manhã</p>
                  </div>
                </button>
                <button
                  onClick={() => toggleDim("periodo", "tarde")}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md transition-all",
                    dim.periodo === "tarde" && "ring-2 ring-offset-1",
                    !dim.periodo || dim.periodo === "tarde" ? "opacity-100" : "opacity-40",
                  )}
                >
                  <CloudSun size={48} strokeWidth={1.8} style={{ color: BLUE }} />
                  <div className="text-left">
                    <p className="text-2xl font-bold tabular-nums" style={{ color: chartColors.text }}>{tarde}%</p>
                    <p className="text-[10px] text-muted-foreground">Tarde</p>
                  </div>
                </button>
              </div>
            );
          }}
        </ChartCard>
      </div>

      {/* Bairros (donut) + Relatórios por Educador (barras segmentadas) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Distribuição por Bairros">
          {() => {
            const sorted = [...data.participantesPorBairro].sort((a, b) => b.count - a.count);
            const max = sorted[0]?.count || 1;
            return (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sorted}
                      dataKey="count"
                      nameKey="bairro"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      label={({ bairro, percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      style={{ fontSize: 10, cursor: "pointer", fill: chartColors.text }}
                      onClick={(e: any) => {
                        const id = bairroIdByNome(e?.bairro);
                        if (id) toggleDim("bairroId", id);
                      }}
                    >
                      {sorted.map((row, i) => {
                        const active = dim.bairroId ? bairroNomeById(dim.bairroId) === row.bairro : true;
                        const baseOpacity = 0.4 + 0.6 * (row.count / max);
                        return (
                          <Cell
                            key={i}
                            fill={MULTI_TONES[i % MULTI_TONES.length]}
                            fillOpacity={active ? baseOpacity : 0.2}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip content={<RichTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, color: chartColors.text }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            );
          }}
        </ChartCard>

        <ChartCard title="Relatórios por Educador">
          {() => (
            <div className="h-52 overflow-y-auto pr-1">
              {data.topEducadores.length > 0 ? (
                <div className="space-y-2">
                  {data.topEducadores.map((e) => (
                    <div key={e.nome} className="flex items-center gap-2">
                      <span className="text-[10px] w-24 truncate" style={{ color: chartColors.text }} title={e.nome}>{e.nome}</span>
                      <div className="flex-1 flex items-center gap-[2px]">
                        {Array.from({ length: e.count }).map((_, i) => (
                          <span
                            key={i}
                            className="inline-block h-5 w-[6px] rounded-[1px]"
                            style={{ background: RED }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] tabular-nums font-semibold w-6 text-right" style={{ color: chartColors.text }}>{e.count}</span>
                    </div>
                  ))}
                </div>
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
        </TabsList>
        <TabsContent value="indicadores"><IndicadoresTab /></TabsContent>
        <TabsContent value="profissionais"><DashboardProfissionaisTab /></TabsContent>
      </Tabs>
    </div>
  );
}
