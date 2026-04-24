import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface SitCfg {
  id?: string;
  cnpj_concedente: string;
  numero_instrumento_padrao: string;
  ano_transferencia_padrao: number;
  tipo_transferencia_padrao: number;
  tipo_doc_pagamento_padrao: number;
  modalidade_compra_padrao: number;
  observacoes?: string;
}

const REQUIRED: (keyof SitCfg)[] = [
  "cnpj_concedente", "numero_instrumento_padrao", "ano_transferencia_padrao",
];

export default function ConfiguracoesSitTab() {
  const [cfg, setCfg] = useState<SitCfg>({
    cnpj_concedente: "",
    numero_instrumento_padrao: "",
    ano_transferencia_padrao: new Date().getFullYear(),
    tipo_transferencia_padrao: 1,
    tipo_doc_pagamento_padrao: 3,
    modalidade_compra_padrao: 7,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("sit_configuracao" as any).select("*").maybeSingle();
      if (data) setCfg(data as any);
      setLoading(false);
    })();
  }, []);

  const faltantes = REQUIRED.filter(k => !String((cfg as any)[k] || "").trim());

  const save = async () => {
    setSaving(true);
    const payload = { ...cfg };
    let res;
    if (cfg.id) {
      res = await supabase.from("sit_configuracao" as any).update(payload as any).eq("id", cfg.id);
    } else {
      res = await supabase.from("sit_configuracao" as any).insert(payload as any).select().single();
      if (!res.error && res.data) setCfg(res.data as any);
    }
    setSaving(false);
    if (res.error) toast.error("Erro ao salvar: " + res.error.message);
    else toast.success("Configuração SIT salva!");
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Configuração SIT / TCE-PR</CardTitle>
          <CardDescription>
            Dados que serão aplicados a todas as despesas exportadas no arquivo Despesa.txt.
          </CardDescription>
        </div>
        {faltantes.length === 0 ? (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Pronto para exportar
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 gap-1">
            <AlertTriangle className="h-3 w-3" /> {faltantes.length} campo(s) faltando
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">CNPJ do Concedente *</Label>
            <Input
              placeholder="00.000.000/0001-00"
              value={cfg.cnpj_concedente}
              onChange={e => setCfg({ ...cfg, cnpj_concedente: e.target.value })}
              className="mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Órgão público que repassa o recurso (Município/Estado).</p>
          </div>
          <div>
            <Label className="text-xs">Nº do Termo / Instrumento *</Label>
            <Input
              placeholder="Ex: 001/2022"
              value={cfg.numero_instrumento_padrao}
              onChange={e => setCfg({ ...cfg, numero_instrumento_padrao: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Ano da Transferência *</Label>
            <Input
              type="number"
              value={cfg.ano_transferencia_padrao}
              onChange={e => setCfg({ ...cfg, ano_transferencia_padrao: Number(e.target.value) })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Tipo de Transferência</Label>
            <Input
              type="number"
              value={cfg.tipo_transferencia_padrao}
              onChange={e => setCfg({ ...cfg, tipo_transferencia_padrao: Number(e.target.value) })}
              className="mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Código SIT: 1=Convênio, 2=Termo Colab., 3=Termo Fomento.</p>
          </div>
          <div>
            <Label className="text-xs">Tipo Doc. Pagamento (padrão)</Label>
            <Input
              type="number"
              value={cfg.tipo_doc_pagamento_padrao}
              onChange={e => setCfg({ ...cfg, tipo_doc_pagamento_padrao: Number(e.target.value) })}
              className="mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">3 = Transferência bancária (mais comum).</p>
          </div>
          <div>
            <Label className="text-xs">Modalidade de Compra (padrão)</Label>
            <Input
              type="number"
              value={cfg.modalidade_compra_padrao}
              onChange={e => setCfg({ ...cfg, modalidade_compra_padrao: Number(e.target.value) })}
              className="mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">7 = Dispensa por valor (até R$ 17.600,00).</p>
          </div>
        </div>

        <div>
          <Label className="text-xs">Observações</Label>
          <Input
            value={cfg.observacoes || ""}
            onChange={e => setCfg({ ...cfg, observacoes: e.target.value })}
            className="mt-1"
          />
        </div>

        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configuração SIT
        </Button>
      </CardContent>
    </Card>
  );
}