import { useState, useEffect, useMemo } from "react";
import { Save, Loader2, Check } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isBairroSCFV, calcAge } from "@/lib/constants";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { useFormTimer } from "@/hooks/useFormTimer";
import { getParticipantesDaTurma } from "@/lib/participantesTurma";
import { Badge } from "@/components/ui/badge";

const FAIXAS: Record<string, [number, number]> = {
  "6-8": [6, 8],
  "9-11": [9, 11],
  "12-17": [12, 17],
  "idosos": [60, 120],
};

// calcAge imported from constants

const PresencaPage = () => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [bairros, setBairros] = useState<any[]>([]);
  const [participantes, setParticipantes] = useState<any[]>([]);

  const [selectedTurma, setSelectedTurma] = useState("");
  const [data, setData] = useState<Date | null>(new Date());
  const [filtroBairro, setFiltroBairro] = useState("todos");
  const [filtroFaixa, setFiltroFaixa] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");

  const [presenca, setPresenca] = useState<Record<string, boolean>>({});
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const [t, b] = await Promise.all([
        supabase.from("turmas").select("id, nome, bairro_id, faixa_etaria, periodo").eq("ativa", true).order("nome"),
        supabase.from("bairros").select("id, nome").order("nome"),
      ]);
      if (t.data) setTurmas(t.data);
      if (b.data) setBairros(b.data);
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedTurma) { setParticipantes([]); return; }
    const fetchParts = async () => {
      try {
        const elegiveis = await getParticipantesDaTurma(selectedTurma);
        // Hidrata dados de bairro/idade/periodo para os filtros
        const ids = elegiveis.map((e) => e.participante_id);
        const { data: extras } = ids.length
          ? await supabase
              .from("participantes")
              .select("id, data_nascimento, bairro_id, periodo")
              .in("id", ids)
          : { data: [] as any[] };
        const extrasMap = new Map((extras || []).map((p: any) => [p.id, p]));
        const list = elegiveis.map((e) => {
          const ex = extrasMap.get(e.participante_id) || {};
          return {
            id: e.participante_id,
            nome_completo: e.nome,
            status: e.status,
            marcador: e.marcador,
            bloqueado_chamada: e.bloqueado_chamada,
            data_nascimento: ex.data_nascimento,
            bairro_id: ex.bairro_id,
            periodo: ex.periodo,
          };
        });
        setParticipantes(list);
        const pres: Record<string, boolean> = {};
        list.forEach((p: any) => {
          // Bloqueados (desligado/transferido) entram desmarcados por padrão
          pres[p.id] = !p.bloqueado_chamada;
        });
        setPresenca(pres);
        setJustificativas({});
      } catch (e: any) {
        toast.error(e?.message || "Erro ao carregar participantes da turma");
      }
    };
    fetchParts();
  }, [selectedTurma]);

  const filteredParticipantes = useMemo(() => {
    return participantes.filter((p: any) => {
      if (filtroBairro !== "todos" && p.bairro_id !== filtroBairro) return false;
      if (filtroPeriodo !== "todos" && p.periodo !== filtroPeriodo) return false;
      if (filtroFaixa !== "todos" && p.data_nascimento) {
        const age = calcAge(p.data_nascimento);
        const range = FAIXAS[filtroFaixa];
        if (range && (age < range[0] || age > range[1])) return false;
      }
      return true;
    });
  }, [participantes, filtroBairro, filtroFaixa, filtroPeriodo]);

  const numPresentes = filteredParticipantes.filter(p => presenca[p.id]).length;
  const numAusentes = filteredParticipantes.length - numPresentes;

  const isDemo = useIsDemo();
  const { stop: stopTimer } = useFormTimer("presenca");

  const handleSave = async () => {
    if (guardDemo(isDemo)) return;
    if (!data) { toast.error("Selecione uma data"); return; }
    if (!selectedTurma) { toast.error("Selecione uma turma"); return; }
    setSaving(true);
    try {
      const dataStr = format(data, "yyyy-MM-dd");
      // Save ALL participants, not just filtered ones — filters are visual only
      const rows = participantes.map(p => ({
        turma_id: selectedTurma,
        participante_id: p.id,
        data: dataStr,
        presente: presenca[p.id] ?? false,
        justificativa: !presenca[p.id] ? (justificativas[p.id] || null) : null,
        registrado_por: user?.id || null,
      }));

      // Delete existing for same turma+data then insert
      await supabase.from("presenca").delete().eq("turma_id", selectedTurma).eq("data", dataStr);
      const { error } = await supabase.from("presenca").insert(rows);
      if (error) throw error;

      // Busca Ativa é 100% manual — sem auto-reversão ao registrar presença.
      const allPresentes = participantes.filter(p => presenca[p.id]).length;
      const allAusentes = participantes.length - allPresentes;
      toast.success(`Presença salva! ${allPresentes} presentes, ${allAusentes} ausentes.`);
      await stopTimer(selectedTurma);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar presença");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Presença Digital</h1>
        <p className="text-sm text-muted-foreground">Registrar frequência das turmas</p>
      </div>

      {/* Seleção de turma e data */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Turma e Data</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Turma *</Label>
              <Select value={selectedTurma} onValueChange={v => setSelectedTurma(v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar turma" /></SelectTrigger>
                <SelectContent>
                  {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !data && "text-muted-foreground")}>
                    {data ? format(data, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={data || undefined} onSelect={d => d && setData(d)} defaultMonth={new Date()} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros opcionais */}
      {selectedTurma && participantes.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Filtros (opcional)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Select value={filtroBairro} onValueChange={setFiltroBairro}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {bairros.filter(b => isBairroSCFV(b.nome)).map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Faixa Etária</Label>
                <Select value={filtroFaixa} onValueChange={setFiltroFaixa}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="6-8">6-8 anos</SelectItem>
                    <SelectItem value="9-11">9-11 anos</SelectItem>
                    <SelectItem value="12-17">12-17 anos</SelectItem>
                    <SelectItem value="idosos">Idosos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Período</Label>
                <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="manha">Manhã</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="integral">Integral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de presença */}
      {selectedTurma && filteredParticipantes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Lista de Presença ({numPresentes}/{filteredParticipantes.length})</CardTitle>
              <span className="text-xs text-muted-foreground">
                {filteredParticipantes.length > 0 ? `${((numPresentes / filteredParticipantes.length) * 100).toFixed(0)}% adesão` : ""}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {filteredParticipantes.map((p, idx) => {
                const presente = presenca[p.id] ?? false;
                return (
                  <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-xs text-muted-foreground w-6 text-right">{idx + 1}.</span>
                    <Checkbox
                      checked={presente}
                      disabled={p.bloqueado_chamada}
                      onCheckedChange={c => {
                        setPresenca(prev => ({ ...prev, [p.id]: !!c }));
                        if (c) setJustificativas(prev => { const n = { ...prev }; delete n[p.id]; return n; });
                      }}
                    />
                    <span className={cn("text-sm flex-1", !presente && "text-muted-foreground line-through")}>
                      {p.nome_completo}
                      {p.marcador && (
                        <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                          {p.marcador}
                        </Badge>
                      )}
                    </span>
                    {!presente && (
                      <Input
                        value={justificativas[p.id] || ""}
                        onChange={e => setJustificativas(prev => ({ ...prev, [p.id]: e.target.value.slice(0, 60) }))}
                        placeholder="Justificativa (opcional)"
                        className="max-w-[200px] h-7 text-xs"
                        maxLength={60}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTurma && filteredParticipantes.length === 0 && participantes.length > 0 && (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
          Nenhum participante encontrado com os filtros selecionados.
        </div>
      )}

      {!selectedTurma && (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Selecione uma turma para registrar presença.
        </div>
      )}

      {selectedTurma && filteredParticipantes.length > 0 && (
        <div className="flex gap-2 pb-4">
          <Button onClick={handleSave} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar Presença
          </Button>
        </div>
      )}
    </div>
  );
};

export default PresencaPage;
