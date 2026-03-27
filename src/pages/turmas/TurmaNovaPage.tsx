import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const diasOptions = [
  { value: "seg", label: "Segunda" }, { value: "ter", label: "Terça" }, { value: "qua", label: "Quarta" },
  { value: "qui", label: "Quinta" }, { value: "sex", label: "Sexta" }, { value: "sab", label: "Sábado" },
];

const TurmaNovaPage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [educadores, setEducadores] = useState<Tables<"profiles">[]>([]);
  const [nome, setNome] = useState("");
  const [periodo, setPeriodo] = useState("manha");
  const [faixaEtaria, setFaixaEtaria] = useState("");
  const [tipo, setTipo] = useState("ordinaria");
  const [bairroId, setBairroId] = useState("");
  const [educadorId, setEducadorId] = useState("");
  const [diasSemana, setDiasSemana] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("profiles").select("*").order("nome"),
    ]).then(([{ data: b }, { data: e }]) => {
      setBairros(b || []);
      setEducadores(e || []);
    });
  }, []);

  const toggleDia = (dia: string) => {
    setDiasSemana((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Nome da turma é obrigatório"); return; }
    setSaving(true);
    const payload: Record<string, unknown> = {
      nome, periodo, tipo, dias_semana: diasSemana,
    };
    if (faixaEtaria) payload.faixa_etaria = faixaEtaria;
    if (bairroId) payload.bairro_id = bairroId;
    if (educadorId) payload.educador_id = educadorId;
    const { error } = await supabase.from("turmas").insert(payload as any);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Turma criada!");
    navigate("/turmas");
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/turmas"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-xl font-semibold text-foreground">Nova Turma</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Informações da Turma</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-medium">Nome da Turma *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Turma A - Manhã" className="h-9 text-sm mt-1" required />
            </div>
            <div>
              <Label className="text-xs font-medium">Período</Label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="integral">Integral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Faixa Etária</Label>
              <Select value={faixaEtaria} onValueChange={setFaixaEtaria}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6-8">6-8 anos</SelectItem>
                  <SelectItem value="9-11">9-11 anos</SelectItem>
                  <SelectItem value="12-17">12-17 anos</SelectItem>
                  <SelectItem value="idosos">Idosos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordinaria">Ordinária</SelectItem>
                  <SelectItem value="extraordinaria">Extraordinária</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Bairro</Label>
              <Select value={bairroId} onValueChange={setBairroId}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{bairros.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium">Educador</Label>
              <Select value={educadorId} onValueChange={setEducadorId}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar educador" /></SelectTrigger>
                <SelectContent>{educadores.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium mb-2 block">Dias da Semana</Label>
              <div className="flex flex-wrap gap-3">
                {diasOptions.map((d) => (
                  <label key={d.value} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={diasSemana.includes(d.value)} onCheckedChange={() => toggleDia(d.value)} />
                    <span className="text-sm">{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild><Link to="/turmas">Cancelar</Link></Button>
          <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "Salvando..." : "Criar Turma"}</Button>
        </div>
      </form>
    </div>
  );
};

export default TurmaNovaPage;
