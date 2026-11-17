import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useCliente, useClientes } from '@/hooks/use-clientes';
import { cn } from '@/lib/utils';

export interface ClienteSelecionado {
  id: number;
  nome: string;
}

interface ClienteComboboxProps {
  id?: string;
  value: number | null | undefined;
  onChange: (cliente: ClienteSelecionado | null) => void;
  placeholder?: string;
  /** Rótulo da opção "sem cliente"; sem ele, a opção não aparece. */
  noneLabel?: string;
  className?: string;
  disabled?: boolean;
}

const LIMITE_RESULTADOS = 30;

/**
 * Seletor de cliente com busca no servidor.
 *
 * Substitui os <Select> que carregavam só os 100 primeiros clientes em ordem
 * alfabética: com ~6.500 clientes, quase nenhum era alcançável. Busca por
 * nome, CPF/CNPJ ou e-mail (a mesma busca da lista de clientes).
 */
export function ClienteCombobox({
  id,
  value,
  onChange,
  placeholder = 'Selecione um cliente...',
  noneLabel,
  className,
  disabled,
}: ClienteComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [termo, setTermo] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setTermo(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isFetching } = useClientes({
    q: termo || undefined,
    limit: LIMITE_RESULTADOS,
  });
  const lista: Array<{ id: number; nome: string; cpfCnpj: string | null }> = data?.data ?? [];

  // O cliente já escolhido pode não estar entre os resultados da busca atual.
  const { data: selecionado } = useCliente(value ?? 0);
  const rotulo = value ? (lista.find((c) => c.id === value)?.nome ?? selecionado?.nome) : undefined;

  const escolher = (cliente: ClienteSelecionado | null) => {
    onChange(cliente);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full flex items-center justify-between gap-2 h-10 px-3 border rounded-md text-sm text-left bg-background transition-colors disabled:opacity-50',
            open ? 'border-primary ring-2 ring-primary/20' : 'border-input hover:border-muted-foreground/50',
            className,
          )}
        >
          <span className={cn('truncate', rotulo || (!value && noneLabel) ? 'text-foreground' : 'text-muted-foreground')}>
            {rotulo ?? (value ? 'Carregando…' : (noneLabel ?? placeholder))}
          </span>
          <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 z-[200]"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome, CPF/CNPJ ou e-mail..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isFetching && lista.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Buscando…
              </div>
            ) : (
              <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            )}
            <CommandGroup>
              {noneLabel && !termo && (
                <CommandItem value="__nenhum__" onSelect={() => escolher(null)}>
                  <Check className={cn('w-4 h-4 mr-2', !value ? 'opacity-100' : 'opacity-0')} />
                  {noneLabel}
                </CommandItem>
              )}
              {lista.map((c) => (
                <CommandItem key={c.id} value={String(c.id)} onSelect={() => escolher({ id: c.id, nome: c.nome })}>
                  <Check className={cn('w-4 h-4 mr-2 shrink-0', value === c.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 truncate">{c.nome}</span>
                  {c.cpfCnpj && <span className="ml-2 text-xs text-muted-foreground tabular-nums">{c.cpfCnpj}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
            {!termo && (data?.total ?? 0) > lista.length && (
              <p className="px-3 py-2 text-[11px] text-muted-foreground border-t">
                Mostrando {lista.length} de {data?.total}. Digite para buscar.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
