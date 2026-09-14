import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface LookupOption {
  codigo: string;
  descricao: string;
}

interface LookupComboboxProps {
  id?: string;
  options: LookupOption[] | undefined;
  value: string | null | undefined;
  onChange: (codigo: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  /** Cadastra a opção digitada e devolve o código gerado. */
  onCreate?: (descricao: string) => Promise<string>;
  createLabel?: string;
}

/**
 * Combobox pesquisável para as tabelas de domínio de processos.
 *
 * Diferente de um <Select> puro, continua utilizável quando a tabela de
 * lookup está vazia ou não tem a opção que o escritório usa: o texto digitado
 * pode ser cadastrado na hora via `onCreate`.
 */
export function LookupCombobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  onCreate,
  createLabel = 'Cadastrar',
}: LookupComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const lista = options ?? [];
  const selecionado = lista.find((o) => o.codigo === value);

  const termo = search.trim();
  const filtrados = termo
    ? lista.filter((o) => o.descricao.toLowerCase().includes(termo.toLowerCase()))
    : lista;

  const jaExiste = lista.some((o) => o.descricao.toLowerCase() === termo.toLowerCase());
  const podeCriar = !!onCreate && termo.length > 0 && !jaExiste;

  const handleCreate = async () => {
    if (!onCreate || !termo) return;
    setIsCreating(true);
    setErro(null);
    try {
      const codigo = await onCreate(termo);
      onChange(codigo);
      setSearch('');
      setOpen(false);
    } catch (err: any) {
      setErro(err.message ?? 'Falha ao cadastrar.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full flex items-center justify-between p-2 border rounded-lg text-sm text-left bg-card transition-colors',
              open ? 'border-primary ring-2 ring-primary/20' : 'border-input hover:border-muted-foreground/50',
            )}
          >
            <span className={selecionado ? 'text-foreground' : 'text-muted-foreground'}>
              {selecionado?.descricao ?? placeholder}
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
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={(v) => {
                setSearch(v);
                setErro(null);
              }}
            />
            <CommandList>
              {filtrados.length === 0 && !podeCriar && (
                <CommandEmpty>
                  {lista.length === 0
                    ? 'Nenhuma opção cadastrada. Digite para criar a primeira.'
                    : 'Nenhum resultado.'}
                </CommandEmpty>
              )}

              {filtrados.length > 0 && (
                <CommandGroup>
                  {filtrados.map((o) => (
                    <CommandItem
                      key={o.codigo}
                      value={o.descricao}
                      onSelect={() => {
                        onChange(o.codigo);
                        setSearch('');
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'w-4 h-4 mr-2 shrink-0',
                          o.codigo === value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      {o.descricao}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {podeCriar && (
                <CommandGroup>
                  <CommandItem value={`__criar__${termo}`} onSelect={handleCreate} disabled={isCreating}>
                    {isCreating ? (
                      <Loader2 className="w-4 h-4 mr-2 shrink-0 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2 shrink-0" />
                    )}
                    {createLabel} "{termo}"
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {erro && <p className="text-xs font-medium text-destructive">{erro}</p>}
    </div>
  );
}
