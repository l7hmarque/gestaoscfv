import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  pageSize?: number;
  totalLabel?: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function DataTable<T extends Record<string, any>>({
  data, columns, searchPlaceholder = "Buscar...", pageSize = 50, totalLabel = "registros",
  selectable = false, selectedIds, onSelectionChange,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      columns.some(col => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      const cmp = String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const allPageSelected = selectable && paged.length > 0 && paged.every(r => selectedIds?.has(r.id));

  const toggleAll = () => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (allPageSelected) {
      paged.forEach(r => next.delete(r.id));
    } else {
      paged.forEach(r => next.add(r.id));
    }
    onSelectionChange(next);
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const selectAllFiltered = () => {
    if (!onSelectionChange) return;
    const next = new Set<string>();
    sorted.forEach(r => next.add(r.id));
    onSelectionChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          {selectable && selectedIds && selectedIds.size > 0 && (
            <span className="text-xs font-medium text-primary">{selectedIds.size} selecionado(s)</span>
          )}
          {selectable && sorted.length > pageSize && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllFiltered}>
              Selecionar todos ({sorted.length})
            </Button>
          )}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {sorted.length} {totalLabel}
          </span>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {selectable && (
                  <TableHead className="w-10 px-2">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Selecionar tudo"
                    />
                  </TableHead>
                )}
                {columns.map(col => (
                  <TableHead
                    key={col.key}
                    className={`text-[11px] font-semibold whitespace-nowrap uppercase tracking-wider ${col.sortable !== false ? "cursor-pointer select-none hover:bg-muted/50" : ""}`}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable !== false && (
                        sortKey === col.key
                          ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                          : <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="text-center text-muted-foreground py-8 text-sm">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((row, i) => (
                  <TableRow key={row.id || i} className={`text-sm hover:bg-muted/40 ${i % 2 === 1 ? "bg-muted/30" : ""} ${selectable && selectedIds?.has(row.id) ? "bg-primary/5" : ""}`}>
                    {selectable && (
                      <TableCell className="w-10 px-2 py-2">
                        <Checkbox
                          checked={selectedIds?.has(row.id) || false}
                          onCheckedChange={() => toggleOne(row.id)}
                        />
                      </TableCell>
                    )}
                    {columns.map(col => (
                      <TableCell key={col.key} className="py-2 px-4 whitespace-nowrap">
                        {col.render ? col.render(row) : (row[col.key] ?? "—")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(0)}>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
