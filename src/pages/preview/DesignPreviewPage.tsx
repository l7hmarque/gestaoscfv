import { useState } from "react";
import {
  Users, BookOpen, Calendar, BarChart3, TrendingUp, Bell, Menu,
  Home, ClipboardList, FileText, DollarSign, Settings, ChevronDown,
  Search, Plus, Download, Filter, MoreHorizontal, CheckCircle2,
  AlertCircle, Clock, ArrowUpRight, ArrowDownRight, User
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from "recharts";

/* ─── mock data ─── */
const kpis = [
  { label: "Participantes Ativos", value: "76", delta: "+3", up: true, icon: Users, color: "hsl(210 60% 50%)" },
  { label: "Frequência Média", value: "84%", delta: "+2%", up: true, icon: TrendingUp, color: "hsl(142 50% 40%)" },
  { label: "Turmas Ativas", value: "12", delta: "0", up: true, icon: BookOpen, color: "hsl(262 50% 55%)" },
  { label: "Relatórios Pendentes", value: "5", delta: "-2", up: false, icon: FileText, color: "hsl(0 58% 56%)" },
];

const tableRows = [
  { nome: "Ana Clara Silva", turma: "Manhã · JD Irene", status: "ativo", freq: "92%", idade: "9 anos" },
  { nome: "Pedro Henrique Santos", turma: "Tarde · Alvorada", status: "ativo", freq: "87%", idade: "11 anos" },
  { nome: "Maria Eduarda Lima", turma: "Manhã · Pq Independência", status: "busca_ativa", freq: "45%", idade: "8 anos" },
  { nome: "João Gabriel Souza", turma: "Tarde · JD Irene", status: "ativo", freq: "96%", idade: "10 anos" },
  { nome: "Laura Beatriz Costa", turma: "Manhã · Alvorada", status: "desligado", freq: "—", idade: "12 anos" },
  { nome: "Lucas Oliveira Reis", turma: "Manhã · JD Irene", status: "ativo", freq: "78%", idade: "7 anos" },
];

const chartData = [
  { mes: "Out", presentes: 62, matriculados: 70 },
  { mes: "Nov", presentes: 58, matriculados: 72 },
  { mes: "Dez", presentes: 45, matriculados: 72 },
  { mes: "Jan", presentes: 30, matriculados: 74 },
  { mes: "Fev", presentes: 55, matriculados: 74 },
  { mes: "Mar", presentes: 68, matriculados: 76 },
];

const sidebarGroups = [
  {
    label: "Principal",
    items: [
      { icon: Home, label: "Início", active: false },
      { icon: BarChart3, label: "Dashboard", active: true },
      { icon: Users, label: "Participantes", active: false },
      { icon: BookOpen, label: "Turmas", active: false },
    ],
  },
  {
    label: "Atividades",
    items: [
      { icon: Calendar, label: "Cronograma", active: false },
      { icon: ClipboardList, label: "Planejamentos", active: false },
      { icon: FileText, label: "Relatórios", active: false },
    ],
  },
  {
    label: "Administração",
    items: [
      { icon: DollarSign, label: "Financeiro", active: false },
      { icon: Settings, label: "Configurações", active: false },
    ],
  },
];

const statusMap: Record<string, { label: string; className: string }> = {
  ativo: { label: "ATIVO", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  busca_ativa: { label: "BUSCA ATIVA", className: "bg-amber-100 text-amber-800 border-amber-200" },
  desligado: { label: "DESLIGADO", className: "bg-red-100 text-red-700 border-red-200" },
};

/* ─── styles (new design tokens applied inline to isolate from global) ─── */
const NEW = {
  bg: "hsl(220 14% 96%)",
  card: "hsl(0 0% 100%)",
  cardBorder: "hsl(220 13% 90%)",
  headerBg: "linear-gradient(to right, hsl(0 0% 100%), hsl(220 14% 97%))",
  sidebarBg: "hsl(220 15% 98%)",
  sidebarBorder: "hsl(220 13% 91%)",
  primary: "hsl(0 58% 56%)",
  primaryLight: "hsl(0 58% 96%)",
  muted: "hsl(215 14% 46%)",
  mutedBg: "hsl(215 20% 93%)",
  foreground: "hsl(220 20% 14%)",
  foregroundLight: "hsl(215 14% 46%)",
};

export default function DesignPreviewPage() {
  const [sidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: NEW.bg, color: NEW.foreground, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Notice banner */}
      <div className="text-center py-2 text-xs font-medium tracking-wide uppercase" style={{ background: NEW.primary, color: "#fff" }}>
        ⚡ Preview do Novo Design — Apenas Visual, Sem Funcionalidade
      </div>

      <div className="flex h-[calc(100vh-32px)]">
        {/* ═══ SIDEBAR ═══ */}
        <aside
          className="shrink-0 flex flex-col overflow-y-auto"
          style={{
            width: sidebarCollapsed ? 56 : 200,
            background: NEW.sidebarBg,
            borderRight: `1px solid ${NEW.sidebarBorder}`,
          }}
        >
          {/* Brand */}
          <div className="px-4 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${NEW.sidebarBorder}` }}>
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white" style={{ background: NEW.primary }}>
              SE
            </div>
            {!sidebarCollapsed && <span className="font-semibold text-sm tracking-tight">SysCFV</span>}
          </div>

          {/* Nav groups */}
          <nav className="flex-1 py-3 px-2 space-y-4">
            {sidebarGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: NEW.muted }}>
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] cursor-pointer transition-all duration-150"
                      style={{
                        background: item.active ? NEW.primaryLight : "transparent",
                        color: item.active ? NEW.primary : NEW.foreground,
                        fontWeight: item.active ? 600 : 400,
                        borderLeft: item.active ? `3px solid ${NEW.primary}` : "3px solid transparent",
                      }}
                    >
                      <item.icon size={16} strokeWidth={item.active ? 2.2 : 1.8} />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* ═══ MAIN CONTENT ═══ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* ─── HEADER ─── */}
          <header
            className="h-[52px] flex items-center justify-between px-5 shrink-0"
            style={{
              background: NEW.headerBg,
              borderBottom: `1px solid ${NEW.cardBorder}`,
            }}
          >
            <div className="flex items-center gap-3">
              <button className="p-1.5 rounded-md hover:bg-black/5 transition-colors">
                <Menu size={18} style={{ color: NEW.foregroundLight }} />
              </button>
              <div>
                <h1 className="text-sm font-semibold leading-tight">Dashboard</h1>
                <p className="text-[11px]" style={{ color: NEW.muted }}>Visão geral do projeto</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-md hover:bg-black/5 transition-colors">
                <Search size={16} style={{ color: NEW.foregroundLight }} />
              </button>
              <button className="p-2 rounded-md hover:bg-black/5 transition-colors relative">
                <Bell size={16} style={{ color: NEW.foregroundLight }} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: NEW.primary }} />
              </button>
              <button className="p-2 rounded-md hover:bg-black/5 transition-colors">
                <User size={16} style={{ color: NEW.foregroundLight }} />
              </button>
            </div>
          </header>

          {/* ─── PAGE CONTENT ─── */}
          <main className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Page title bar */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Dashboard</h2>
                <p className="text-xs" style={{ color: NEW.muted }}>Resumo de março 2026</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors hover:bg-black/5"
                  style={{ borderColor: NEW.cardBorder, color: NEW.foreground }}
                >
                  <Filter size={13} /> Filtros
                </button>
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors hover:bg-black/5"
                  style={{ borderColor: NEW.cardBorder, color: NEW.foreground }}
                >
                  <Download size={13} /> Exportar
                </button>
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white transition-colors"
                  style={{ background: NEW.primary }}
                >
                  <Plus size={13} /> Novo
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-lg p-4 transition-shadow hover:shadow-md"
                  style={{
                    background: NEW.card,
                    border: `1px solid ${NEW.cardBorder}`,
                    borderLeft: `4px solid ${kpi.color}`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: NEW.muted }}>
                        {kpi.label}
                      </p>
                      <p className="text-2xl font-bold mt-1 leading-none" style={{ color: NEW.foreground }}>
                        {kpi.value}
                      </p>
                    </div>
                    <kpi.icon size={20} strokeWidth={1.5} style={{ color: kpi.color }} />
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {kpi.up ? (
                      <ArrowUpRight size={12} className="text-emerald-600" />
                    ) : (
                      <ArrowDownRight size={12} className="text-red-500" />
                    )}
                    <span className={`text-[11px] font-medium ${kpi.up ? "text-emerald-600" : "text-red-500"}`}>
                      {kpi.delta}
                    </span>
                    <span className="text-[11px]" style={{ color: NEW.muted }}>vs mês anterior</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts + Table row */}
            <div className="grid grid-cols-5 gap-4">
              {/* Chart */}
              <div
                className="col-span-2 rounded-lg p-4"
                style={{ background: NEW.card, border: `1px solid ${NEW.cardBorder}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">Frequência Mensal</h3>
                    <p className="text-[11px]" style={{ color: NEW.muted }}>Presentes vs Matriculados</p>
                  </div>
                  <button className="p-1 rounded hover:bg-black/5">
                    <MoreHorizontal size={14} style={{ color: NEW.muted }} />
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke={NEW.cardBorder} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: NEW.muted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: NEW.muted }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${NEW.cardBorder}` }} />
                    <Bar dataKey="matriculados" fill={NEW.mutedBg} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="presentes" fill={NEW.primary} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line chart */}
              <div
                className="col-span-3 rounded-lg p-4"
                style={{ background: NEW.card, border: `1px solid ${NEW.cardBorder}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">Evolução de Presença</h3>
                    <p className="text-[11px]" style={{ color: NEW.muted }}>Últimos 6 meses</p>
                  </div>
                  <button className="p-1 rounded hover:bg-black/5">
                    <MoreHorizontal size={14} style={{ color: NEW.muted }} />
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={NEW.cardBorder} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: NEW.muted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: NEW.muted }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${NEW.cardBorder}` }} />
                    <Line type="monotone" dataKey="presentes" stroke={NEW.primary} strokeWidth={2} dot={{ r: 3, fill: NEW.primary }} />
                    <Line type="monotone" dataKey="matriculados" stroke="hsl(210 60% 50%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(210 60% 50%)" }} strokeDasharray="5 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table */}
            <div
              className="rounded-lg overflow-hidden"
              style={{ background: NEW.card, border: `1px solid ${NEW.cardBorder}` }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${NEW.cardBorder}` }}>
                <h3 className="text-sm font-semibold">Participantes</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: NEW.muted }} />
                    <input
                      placeholder="Buscar..."
                      className="pl-8 pr-3 py-1.5 text-xs rounded-md border bg-transparent focus:outline-none focus:ring-1"
                      style={{ borderColor: NEW.cardBorder, width: 180 }}
                    />
                  </div>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: NEW.mutedBg }}>
                    {["Nome", "Turma", "Status", "Frequência", "Idade"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: NEW.muted }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => {
                    const st = statusMap[row.status];
                    return (
                      <tr
                        key={i}
                        className="transition-colors cursor-pointer"
                        style={{
                          background: i % 2 === 0 ? "transparent" : "hsl(215 20% 97%)",
                          borderBottom: `1px solid ${NEW.cardBorder}`,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(215 20% 95%)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "hsl(215 20% 97%)")}
                      >
                        <td className="px-4 py-2.5 font-medium text-[13px]">{row.nome}</td>
                        <td className="px-4 py-2.5 text-[13px]" style={{ color: NEW.foregroundLight }}>{row.turma}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${st.className}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[13px] font-medium">{row.freq}</td>
                        <td className="px-4 py-2.5 text-[13px]" style={{ color: NEW.foregroundLight }}>{row.idade}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Quick action cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: ClipboardList, label: "Novo Planejamento", desc: "Criar planejamento de aula" },
                { icon: FileText, label: "Novo Relatório", desc: "Registrar atividade realizada" },
                { icon: Calendar, label: "Ver Cronograma", desc: "Escala semanal da equipe" },
              ].map((action) => (
                <div
                  key={action.label}
                  className="rounded-lg p-4 flex items-center gap-3 cursor-pointer transition-all duration-150 hover:shadow-md group"
                  style={{ background: NEW.card, border: `1px solid ${NEW.cardBorder}` }}
                >
                  <action.icon size={20} strokeWidth={1.5} style={{ color: NEW.primary }} className="shrink-0" />
                  <div>
                    <p className="text-sm font-semibold group-hover:underline">{action.label}</p>
                    <p className="text-[11px]" style={{ color: NEW.muted }}>{action.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
