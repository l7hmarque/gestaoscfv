import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  FileText,
  Filter,
  Info,
  Loader2,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import {
  validateDespesa,
  missingFieldLabel,
  type ValidatedDespesa,
  type DespesaWarning,
} from "@/lib/despesaImportValidation";
import {
  SIT_TIPO_DOC_DESPESA,
  SIT_TIPO_DOC_PAGAMENTO,
} from "@/lib/sitCodeMappings";

export interface ReviewDocFile {
  fileName: string;
  storageUrl?: string;
  extractedList: any[];
}

interface ImportReviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  docs: ReviewDocFile[];
  mesRef: string;
  saving: boolean;
  isCoordenacao: boolean;
  onUpdateField: (docIdx: number, despIdx: number, field: string, value: any) => void;
  onRemoveDespesa: (docIdx: number, despIdx: number) => void;
  onConfirm: (opts: { allowPendentes: boolean }) => Promise<void> | void;
}

const FIELD_MAX: Record<string, number> = {
  sit_numero_doc_despesa: 10,
  sit_numero_doc_pagamento: 15,
  sit_numero_instrumento: 20,
  sit_numero_empenho: 15,
  sit_numero_processo: 10,
  sit_placa_veiculo: 7,
  sit_nome_favorecido: 250,
};

function severityClass(sev: DespesaWarning["severity"]) {
  return sev === "error"
    ? "text-destructive"
    : sev === "warn"
    ? "text-amber-700"
    : "text-muted-foreground";
}

function copyDiagnostic(payload: unknown) {
  try {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success("Diagnóstico copiado");
  } catch {
    toast.error("Não foi possível copiar");
  }
}

export default function ImportReviewDialog({
  open,
  onOpenChange,
  docs,
  mesRef,
  saving,
  isCoordenacao,
  onUpdateField,
  onRemoveDespesa,
  onConfirm,
}: ImportReviewDialogProps) {
  const [filterPendentes, setFilterPendentes] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [allowPendentes, setAllowPendentes] = useState(false);

  const validated = useMemo(
    () =>
      docs.map((d, docIdx) => ({
        docIdx,
        fileName: d.fileName,
        storageUrl: d.storageUrl,
        items: d.extractedList.map((e, despIdx) => ({
          despIdx,
          original: e,
          ...validateDespesa(e, { mesRef, storageUrl: d.storageUrl }),
        })),
      })),
    [docs, mesRef]
  );

  const totals = useMemo(() => {
    let total = 0;
    let bloqueadas = 0;
    let ajustes = 0;
    let ok = 0;
    for (const d of validated) {
      for (const it of d.items) {
        total++;
        if (it.missing.length > 0) bloqueadas++;
        else if (it.warnings.length > 0) ajustes++;
        else ok++;
      }
    }
    return { total, bloqueadas, ajustes, ok };
  }, [validated]);

  // Ordenação: bloqueadas > ajustes > OK
  const ordered = useMemo(() => {
    return validated.map((d) => {
      const items = [...d.items].sort((a, b) => {
        const sev = (it: ValidatedDespesa & { despIdx: number }) =>
          it.missing.length > 0 ? 0 : it.warnings.length > 0 ? 1 : 2;
        return sev(a as any) - sev(b as any);
      });
      const fileBloqueadas = items.filter((i) => i.missing.length > 0).length;
      const fileAjustes = items.filter(
        (i) => i.warnings.length > 0 && i.missing.length === 0
      ).length;
      const fileOk = items.length - fileBloqueadas - fileAjustes;
      return { ...d, items, fileBloqueadas, fileAjustes, fileOk };
    });
  }, [validated]);

  const blocked = totals.bloqueadas > 0 && !allowPendentes;
  const canConfirm = totals.total > 0 && !blocked;

  const copyFullDiagnostic = () => {
    const payload = ordered.map((d) => ({
      fileName: d.fileName,
      storageUrl: d.storageUrl,
      items: d.items.map((it) => ({
        idx: it.despIdx + 1,
        descricao: it.row.descricao,
        valor: it.row.valor,
        missing: it.missing,
        warnings: it.warnings.map((w) => ({
          field: w.field,
          rule: w.rule,
          severity: w.severity,
          source: w.source,
          matchedAlias: w.matchedAlias,
          original: w.original,
          applied: w.applied,
          message: w.message,
        })),
      })),
    }));
    copyDiagnostic({ mesRef, totals, docs: payload });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Revisar despesas antes de lançar</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          {/* Banner de bloqueio */}
          {blocked && (
            <div className="rounded border border-destructive bg-destructive/10 p-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="text-destructive">
                  Lançamento bloqueado: {totals.bloqueadas} despesa(s) com campos obrigatórios ausentes.
                </strong>
                <p className="text-[11px] text-destructive/80 mt-0.5">
                  Edite os campos faltantes diretamente nas despesas marcadas em vermelho.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] gap-1"
                onClick={() => setFilterPendentes((v) => !v)}
              >
                <Filter className="h-3 w-3" />
                {filterPendentes ? "Ver todas" : "Só pendências"}
              </Button>
            </div>
          )}

          {/* Resumo */}
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline">Total: {totals.total}</Badge>
            {totals.bloqueadas > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {totals.bloqueadas} bloqueada(s)
              </Badge>
            )}
            {totals.ajustes > 0 && (
              <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700">
                <Info className="h-3 w-3" /> {totals.ajustes} com ajuste(s)
              </Badge>
            )}
            {totals.ok > 0 && (
              <Badge variant="outline" className="gap-1 border-emerald-400 text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> {totals.ok} OK
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] gap-1"
                onClick={copyFullDiagnostic}
              >
                <ClipboardCopy className="h-3 w-3" />
                Copiar diagnóstico
              </Button>
            </div>
          </div>

          {/* Lista por arquivo */}
          <div className="space-y-3">
            {ordered.map((d) => {
              const visibleItems = filterPendentes
                ? d.items.filter((i) => i.missing.length > 0)
                : d.items;
              if (filterPendentes && visibleItems.length === 0) return null;
              return (
                <div key={d.docIdx} className="border rounded">
                  <div className="px-2 py-1 bg-muted/40 text-[11px] font-medium flex items-center gap-2 flex-wrap">
                    <FileText className="h-3 w-3" />
                    <span className="truncate max-w-[280px]">{d.fileName}</span>
                    <span className="text-muted-foreground">— {d.items.length} despesa(s)</span>
                    {d.fileBloqueadas > 0 && (
                      <Badge variant="destructive" className="text-[9px] h-4 px-1">
                        {d.fileBloqueadas} bloq.
                      </Badge>
                    )}
                    {d.fileAjustes > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-400 text-amber-700">
                        {d.fileAjustes} ajuste(s)
                      </Badge>
                    )}
                    {d.fileOk > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 border-emerald-400 text-emerald-700">
                        {d.fileOk} OK
                      </Badge>
                    )}
                  </div>
                  <ul className="divide-y">
                    {visibleItems.map((it) => {
                      const key = `${d.docIdx}:${it.despIdx}`;
                      const isOpen = !!expanded[key] || it.missing.length > 0;
                      const desc = it.row.descricao || "—";
                      const valor = Number(it.row.valor || 0);
                      const original = it.original;
                      return (
                        <li key={it.despIdx} className="px-2 py-1.5">
                          <Collapsible
                            open={isOpen}
                            onOpenChange={(v) =>
                              setExpanded((prev) => ({ ...prev, [key]: v }))
                            }
                          >
                            <div className="flex items-center justify-between gap-2">
                              <CollapsibleTrigger className="flex items-center gap-1 min-w-0 flex-1 text-left hover:bg-muted/30 rounded px-1">
                                {isOpen ? (
                                  <ChevronDown className="h-3 w-3 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate">
                                    #{it.despIdx + 1} — {desc}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    R$ {valor.toFixed(2)} • {it.row.fornecedor || "sem fornecedor"} •{" "}
                                    {it.row.data_lancamento || "sem data"}
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              {it.missing.length > 0 ? (
                                <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                  {it.missing.length} faltando
                                </Badge>
                              ) : it.warnings.length > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 px-1 border-amber-400 text-amber-700"
                                >
                                  {it.warnings.length} ajuste(s)
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 px-1 border-emerald-400 text-emerald-700"
                                >
                                  OK
                                </Badge>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                title="Remover esta despesa"
                                onClick={() => onRemoveDespesa(d.docIdx, it.despIdx)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>

                            <CollapsibleContent className="pt-2">
                              {(it.missing.length > 0 || it.warnings.length > 0) && (
                                <ul className="mb-2 ml-3 space-y-0.5 text-[10px]">
                                  {it.missing.map((m) => (
                                    <li key={`m-${m}`} className="text-destructive">
                                      • <strong>{missingFieldLabel(m)}</strong> — campo obrigatório ausente
                                    </li>
                                  ))}
                                  {it.warnings.map((w, wi) => (
                                    <li key={`w-${wi}`} className={severityClass(w.severity)}>
                                      • <strong>{w.label}:</strong> {w.message}
                                      <span className="text-muted-foreground ml-1">
                                        [{w.rule}
                                        {w.source ? ` • src: ${w.source}` : ""}
                                        {w.matchedAlias ? ` • alias: ${w.matchedAlias}` : ""}
                                        ]
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}

                              {/* Editor inline */}
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-muted/20 p-2 rounded border">
                                <div className="col-span-2 md:col-span-3">
                                  <Label className="text-[10px]">Descrição</Label>
                                  <Input
                                    className="h-7 text-xs"
                                    value={original.descricao || ""}
                                    onChange={(e) =>
                                      onUpdateField(d.docIdx, it.despIdx, "descricao", e.target.value)
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">Fornecedor</Label>
                                  <Input
                                    className="h-7 text-xs"
                                    value={original.fornecedor || ""}
                                    onChange={(e) =>
                                      onUpdateField(d.docIdx, it.despIdx, "fornecedor", e.target.value)
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">CNPJ/CPF</Label>
                                  <Input
                                    className="h-7 text-xs"
                                    value={original.cnpj_cpf || ""}
                                    onChange={(e) =>
                                      onUpdateField(d.docIdx, it.despIdx, "cnpj_cpf", e.target.value)
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">Valor (R$) *</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-7 text-xs"
                                    value={original.valor ?? ""}
                                    onChange={(e) =>
                                      onUpdateField(d.docIdx, it.despIdx, "valor", e.target.value)
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">Data lançamento *</Label>
                                  <Input
                                    type="date"
                                    className="h-7 text-xs"
                                    value={original.data_lancamento || ""}
                                    onChange={(e) =>
                                      onUpdateField(d.docIdx, it.despIdx, "data_lancamento", e.target.value)
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">
                                    Nome favorecido (SIT){" "}
                                    <span className="text-muted-foreground">
                                      {(original.sit_nome_favorecido || original.fornecedor || "").length}/
                                      {FIELD_MAX.sit_nome_favorecido}
                                    </span>
                                  </Label>
                                  <Input
                                    className="h-7 text-xs"
                                    maxLength={FIELD_MAX.sit_nome_favorecido}
                                    value={original.sit_nome_favorecido || ""}
                                    onChange={(e) =>
                                      onUpdateField(
                                        d.docIdx,
                                        it.despIdx,
                                        "sit_nome_favorecido",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">Tipo doc favorecido *</Label>
                                  <Select
                                    value={String(original.sit_tipo_doc_favorecido || "")}
                                    onValueChange={(v) =>
                                      onUpdateField(d.docIdx, it.despIdx, "sit_tipo_doc_favorecido", v)
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                                      <SelectItem value="CPF">CPF</SelectItem>
                                      <SelectItem value="EXT">Estrangeiro</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-[10px]">Tipo doc despesa *</Label>
                                  <Select
                                    value={String(original.sit_tipo_doc_despesa || "")}
                                    onValueChange={(v) =>
                                      onUpdateField(d.docIdx, it.despIdx, "sit_tipo_doc_despesa", v)
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(SIT_TIPO_DOC_DESPESA).map(([code, info]) => (
                                        <SelectItem key={code} value={code}>
                                          {code} — {info.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-[10px]">
                                    Nº doc despesa{" "}
                                    <span className="text-muted-foreground">
                                      {(original.sit_numero_doc_despesa || original.numero_documento || "")
                                        .length}
                                      /{FIELD_MAX.sit_numero_doc_despesa}
                                    </span>
                                  </Label>
                                  <Input
                                    className="h-7 text-xs"
                                    maxLength={FIELD_MAX.sit_numero_doc_despesa}
                                    value={original.sit_numero_doc_despesa || original.numero_documento || ""}
                                    onChange={(e) =>
                                      onUpdateField(
                                        d.docIdx,
                                        it.despIdx,
                                        "sit_numero_doc_despesa",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">Data do doc despesa</Label>
                                  <Input
                                    type="date"
                                    className="h-7 text-xs"
                                    value={original.sit_data_doc_despesa || ""}
                                    onChange={(e) =>
                                      onUpdateField(
                                        d.docIdx,
                                        it.despIdx,
                                        "sit_data_doc_despesa",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">Tipo pagamento *</Label>
                                  <Select
                                    value={String(original.sit_tipo_doc_pagamento || "")}
                                    onValueChange={(v) =>
                                      onUpdateField(d.docIdx, it.despIdx, "sit_tipo_doc_pagamento", v)
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(SIT_TIPO_DOC_PAGAMENTO).map(([code, info]) => (
                                        <SelectItem key={code} value={code}>
                                          {code} — {info.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-[10px]">
                                    Nº doc pagamento{" "}
                                    <span className="text-muted-foreground">
                                      {(original.sit_numero_doc_pagamento || "").length}/
                                      {FIELD_MAX.sit_numero_doc_pagamento}
                                    </span>
                                  </Label>
                                  <Input
                                    className="h-7 text-xs"
                                    maxLength={FIELD_MAX.sit_numero_doc_pagamento}
                                    value={original.sit_numero_doc_pagamento || ""}
                                    onChange={(e) =>
                                      onUpdateField(
                                        d.docIdx,
                                        it.despIdx,
                                        "sit_numero_doc_pagamento",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">Data débito (pagamento)</Label>
                                  <Input
                                    type="date"
                                    className="h-7 text-xs"
                                    value={original.sit_data_debito || ""}
                                    onChange={(e) =>
                                      onUpdateField(d.docIdx, it.despIdx, "sit_data_debito", e.target.value)
                                    }
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end gap-1 pt-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] gap-1"
                                  onClick={() =>
                                    copyDiagnostic({
                                      fileName: d.fileName,
                                      idx: it.despIdx + 1,
                                      original,
                                      missing: it.missing,
                                      warnings: it.warnings,
                                    })
                                  }
                                >
                                  <ClipboardCopy className="h-3 w-3" />
                                  Diagnóstico
                                </Button>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
            {isCoordenacao && totals.bloqueadas > 0 && (
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Checkbox
                  checked={allowPendentes}
                  onCheckedChange={(v) => setAllowPendentes(!!v)}
                />
                <span className="flex items-center gap-1">
                  <Wand2 className="h-3 w-3" />
                  Lançar mesmo assim como pendentes (apenas Coordenação)
                </span>
              </label>
            )}
            <div className="flex justify-end gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Voltar e ajustar
              </Button>
              <Button
                onClick={() => onConfirm({ allowPendentes })}
                disabled={saving || !canConfirm}
                title={
                  blocked
                    ? `Resolva as ${totals.bloqueadas} despesa(s) com campos obrigatórios ausentes antes de lançar.`
                    : undefined
                }
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Confirmar e lançar {totals.total}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}