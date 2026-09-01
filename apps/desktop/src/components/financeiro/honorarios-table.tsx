import { Receipt, Search, Loader2, Filter, Check, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { useRegional } from '@/components/regional-provider';
import type { HonorarioListItem } from '@/lib/entities';
import { cn } from '@/lib/utils';

const today = new Date().toISOString().split('T')[0];

interface HonorariosTableProps {
  rows: HonorarioListItem[] | undefined;
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onEdit: (h: HonorarioListItem) => void;
  onQuitar: (h: HonorarioListItem) => void;
  onDelete: (h: HonorarioListItem) => void;
}

export function HonorariosTable({
  rows,
  isLoading,
  search,
  onSearchChange,
  status,
  onStatusChange,
  onEdit,
  onQuitar,
  onDelete,
}: HonorariosTableProps) {
  const { formatCurrency, formatDate } = useRegional();

  return (
    <Card className="border-none shadow-sm bg-card">
      <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Lançamentos</h2>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 flex-1 max-w-2xl justify-end">
          <div className="relative w-full max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Buscar cliente ou descrição..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 h-11 bg-muted/50 border-input focus:border-primary focus:ring-primary/10 rounded-lg"
            />
          </div>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="w-[180px] h-11 bg-muted/50 border-input font-medium text-muted-foreground">
              <SelectValue placeholder="Todos Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="PENDENTE">Pendente</SelectItem>
              <SelectItem value="PAGO">Pago</SelectItem>
              <SelectItem value="CANCELADO">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest px-6">CLIENTE / DESCRIÇÃO</TableHead>
              <TableHead className="py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">VENCIMENTO</TableHead>
              <TableHead className="py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">VALOR TOTAL</TableHead>
              <TableHead className="py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">SALDO PAGO</TableHead>
              <TableHead className="py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">STATUS</TableHead>
              <TableHead className="py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right px-6">AÇÕES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary opacity-20" />
                </TableCell>
              </TableRow>
            ) : rows?.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-64 text-center py-12">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                      <Filter className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-muted-foreground font-medium italic">
                      Nenhum lançamento financeiro encontrado.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows?.map((h) => (
                <TableRow key={h.id} className="group hover:bg-muted/50 transition-colors border-b border-border">
                  <TableCell className="px-6 py-5">
                    <div className="font-bold text-foreground">{h.cliente?.nome || '-'}</div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5 truncate max-w-[200px]">
                      {h.descricao}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div
                      className={cn(
                        'font-bold',
                        h.status === 'PENDENTE' && h.dataVenc < today ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {formatDate(h.dataVenc + 'T00:00:00')}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="font-black text-foreground">{formatCurrency(h.valor)}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(h.valorPago || 0)}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={cn(
                        'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border-none shadow-sm',
                        h.status === 'PAGO' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
                        h.status === 'PENDENTE' && h.dataVenc >= today && 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
                        h.status === 'PENDENTE' && h.dataVenc < today && 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400',
                        h.status === 'CANCELADO' && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {h.status === 'PENDENTE' && h.dataVenc < today ? 'ATRASADO' : h.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex items-center justify-end gap-1">
                      {h.status !== 'PAGO' && (
                        <button
                          onClick={() => onQuitar(h)}
                          className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 transition-all"
                          title="Quitar"
                        >
                          <Check className="w-4 h-4 stroke-[3px]" />
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(h)}
                        className="p-2 rounded-lg text-muted-foreground hover:bg-blue-50 hover:text-primary dark:hover:bg-blue-950/30 transition-all"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(h)}
                        className="p-2 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-destructive dark:hover:bg-red-950/30 transition-all"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
