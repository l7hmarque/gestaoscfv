import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

interface Categoria { id: string; nome: string; descricao: string | null }

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Combobox que sugere categorias padrão de vulnerabilidade
 * mas aceita texto livre (LGPD-friendly e compatível com dados antigos).
 */
export function CategoriaVulnerabilidadeCombobox({ value, onChange, placeholder = "Ex.: Bolsa Família (PBF)", className }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [list, setList] = useState<Categoria[]>([]);

  useEffect(() => {
    supabase
      .from("categorias_vulnerabilidade_padrao")
      .select("id, nome, descricao")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .then(({ data }) => setList((data as any) || []));
  }, []);

  const trimmed = search.trim();
  const showCreate = trimmed.length > 0 && !list.some((c) => c.nome.toLowerCase() === trimmed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-9 w-full justify-between font-normal text-sm", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Buscar ou digitar..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nenhuma sugestão.</CommandEmpty>
            <CommandGroup heading="Sugestões padrão">
              {list.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.nome}
                  onSelect={() => { onChange(c.nome); setOpen(false); setSearch(""); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c.nome ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span>{c.nome}</span>
                    {c.descricao && <span className="text-[11px] text-muted-foreground">{c.descricao}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreate && (
              <CommandGroup heading="Texto livre">
                <CommandItem
                  value={`__free__${trimmed}`}
                  onSelect={() => { onChange(trimmed); setOpen(false); setSearch(""); }}
                >
                  Usar "{trimmed}"
                </CommandItem>
              </CommandGroup>
            )}
            {value && (
              <CommandGroup heading="Ações">
                <CommandItem value="__clear__" onSelect={() => { onChange(""); setOpen(false); setSearch(""); }}>
                  Limpar valor
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}