import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  despesa: any | null;
  onSaved: () => void;
}

export default function RegularizarSitDialog({ open, onOpenChange, despesa, onSaved }: Props) {
  const [form, setForm] = useState<any>({});
  const [codigos, setCodigos] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (despesa) {
      setForm({
        sit_codigo_tipo_despesa: despesa.sit_codigo_tipo_despesa || "",
        sit_tipo_doc_despesa: despesa.sit_tipo_doc_despesa || 1,
        sit_numero_doc_despesa: despesa.sit_numero_doc_despesa || despesa.numero_documento || "",
        sit_data_doc_despesa: despesa.sit_data_doc_despesa || despesa.data_lancamento || "",
        sit_nome_favorecido: despesa.sit_nome_favorecido || despesa.fornecedor || "",
        sit_tipo_doc_favorecido: despesa.sit_tipo_doc_favorecido || (despesa.cnpj_cpf?.replace(/\D/g, "").length === 14 ? "CNPJ" : "CPF"),
        sit_numero_empenho: despesa.sit_numero_empenho || "",
        sit_data_debito: despesa.sit_data_debito || despesa.data_lancamento || "",
      });
      setFile(null);
    }
  }, [despesa]);

  useEffect(() => {
    supabase.from("sit_codigos" as any).select("*").eq("ativo", true).order("codigo")
      .then(({ data }) => setCodigos(data || []));
  }, []);

  const tiposDespesa = codigos.filter(c => c.categoria === "tipo_despesa");

  async function handleSave() {
    if (!despesa) return;
    setSaving(true);
    try {
      let comprovanteUrl = despesa.comprovante_url;
      if (file) {
        const path = `despesas/${despesa.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("prestacao-contas").upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        comprovanteUrl = path;
      }

      const payload: any = {
        ...form,
        sit_codigo_tipo_despesa: form.sit_codigo_tipo_despesa ? Number(form.sit_codigo_tipo_despesa) : null,
        sit_tipo_doc_despesa: form.sit_tipo_doc_despesa ? Number(form.sit_tipo_doc_despesa) : null,
        comprovante_url: comprovanteUrl,
        pendente_comprovante: !comprovanteUrl,
        sit_completo: !!(form.sit_codigo_tipo_despesa && form.sit_nome_favorecido && comprovanteUrl),
      };
      const { error } = await supabase.from("despesas").update(payload).eq("id", despesa.id);
      if (error) throw error;
      toast.success("Despesa regularizada para SIT!");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Regularizar para SIT</DialogTitle>
          <DialogDescription className="text-xs">
            Preencha os campos exigidos pelo TCE-PR e anexe o comprovante.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted/40 rounded p-2 text-xs">
            <div className="font-medium">{despesa?.descricao}</div>
            <div className="text-muted-foreground">
              R$ {Number(despesa?.valor || 0).toFixed(2)} · {despesa?.fornecedor || "—"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Tipo de Despesa (código SIT) *</Label>
              <Select value={String(form.sit_codigo_tipo_despesa || "")} onValueChange={v => setForm({ ...form, sit_codigo_tipo_despesa: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {tiposDespesa.map(c => (
                    <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} — {c.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Nome do Favorecido *</Label>
              <Input className="h-8 text-xs" value={form.sit_nome_favorecido || ""} onChange={e => setForm({ ...form, sit_nome_favorecido: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Tipo Doc. Favorecido</Label>
              <Select value={form.sit_tipo_doc_favorecido || "CNPJ"} onValueChange={v => setForm({ ...form, sit_tipo_doc_favorecido: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="EXT">Estrangeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo Doc. Despesa</Label>
              <Select value={String(form.sit_tipo_doc_despesa || 1)} onValueChange={v => setForm({ ...form, sit_tipo_doc_despesa: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — Nota Fiscal</SelectItem>
                  <SelectItem value="2">2 — Recibo</SelectItem>
                  <SelectItem value="3">3 — Cupom Fiscal</SelectItem>
                  <SelectItem value="4">4 — Boleto</SelectItem>
                  <SelectItem value="5">5 — DARF/GPS</SelectItem>
                  <SelectItem value="9">9 — Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Nº Documento</Label>
              <Input className="h-8 text-xs" value={form.sit_numero_doc_despesa || ""} onChange={e => setForm({ ...form, sit_numero_doc_despesa: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Data do Documento</Label>
              <Input type="date" className="h-8 text-xs" value={form.sit_data_doc_despesa || ""} onChange={e => setForm({ ...form, sit_data_doc_despesa: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Nº Empenho</Label>
              <Input className="h-8 text-xs" value={form.sit_numero_empenho || ""} onChange={e => setForm({ ...form, sit_numero_empenho: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Data do Débito (pagamento)</Label>
              <Input type="date" className="h-8 text-xs" value={form.sit_data_debito || ""} onChange={e => setForm({ ...form, sit_data_debito: e.target.value })} />
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Comprovante (PDF/JPG) {!despesa?.comprovante_url && <span className="text-rose-600">*</span>}
            </Label>
            {despesa?.comprovante_url && !file && (
              <p className="text-[10px] text-emerald-700 mt-1">✓ Já anexado. Envie um novo arquivo apenas para substituir.</p>
            )}
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="h-8 text-xs mt-1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Salvar regularização
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}