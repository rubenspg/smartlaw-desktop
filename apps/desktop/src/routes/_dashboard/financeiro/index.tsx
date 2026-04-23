import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Plus,
  Search,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Filter,
  Pencil,
  Trash2,
  X,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  useHonorarios,
  useCreateHonorario,
  useUpdateHonorario,
  useDeleteHonorario,
  useHonorarioSummary,
} from '@/hooks/use-honorarios';
import { useClientes } from '@/hooks/use-clientes';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { Honorario, HonorarioInput } from '@smartlaw/shared';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export const Route = createFileRoute('/_dashboard/financeiro/')({
  component: FinanceiroPage,
});

const today = new Date().toISOString().split('T')[0];

function FinanceiroPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Honorario | null>(null);

  const { user } = useAuth();
  const isAdmin = user?.perfil === 'admin';

  console.log('DEBUG - Perfil atual:', user?.perfil, 'isAdmin:', isAdmin);

  const { data: honorarios, isLoading } = useHonorarios({
    status: status === 'all' ? undefined : status,
    limit: 100,
    month: selectedMonth,
    year: selectedYear,
  });
  const { data: summary } = useHonorarioSummary({
    month: selectedMonth,
    year: selectedYear,
  });

  console.log('Financeiro summary:', summary);

  const createHonorario = useCreateHonorario();
  const updateHonorario = useUpdateHonorario();
  const deleteHonorario = useDeleteHonorario();

  const formatCurrency = (value: string | number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

  const filtered = honorarios?.filter((h) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const nomeCliente = h.cliente?.nome?.toLowerCase() || '';
    const descricao = h.descricao?.toLowerCase() || '';
    
    return nomeCliente.includes(term) || descricao.includes(term);
  });

  const totalRecebido = summary?.totalRecebido ?? 0;
  const totalPendente = summary?.totalPendente ?? 0;
  const totalAtrasado = summary?.totalAtrasado ?? 0;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (h: Honorario) => {
    setEditing(h);
    setDialogOpen(true);
  };

  const handleDelete = async (h: Honorario) => {
    if (!confirm(`Excluir o lançamento "${h.descricao}"?`)) return;
    try {
      await deleteHonorario.mutateAsync(h.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleQuitar = async (h: Honorario) => {
    if (!confirm(`Marcar o lançamento "${h.descricao}" como PAGO?`)) return;
    try {
      await updateHonorario.mutateAsync({
        id: h.id,
        data: {
          clienteId: h.clienteId!,
          processoJudicialId: h.processoJudicialId,
          processoAdminId: h.processoAdminId,
          descricao: h.descricao,
          valor: h.valor,
          valorPago: h.valor, // Quita o valor total
          dataVenc: h.dataVenc,
          dataPagto: today, // Data de hoje
          status: 'PAGO',
          tipo: h.tipo ?? 'HONORARIO',
          observacoes: h.observacoes,
        },
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmit = async (data: HonorarioInput) => {
    try {
      if (editing) {
        await updateHonorario.mutateAsync({ id: editing.id, data });
      } else {
        await createHonorario.mutateAsync(data);
      }
      setDialogOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const isPending = createHonorario.isPending || updateHonorario.isPending;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col md:flex-row md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-bold text-[#1e293b]">Financeiro</h1>
            <p className="text-[#64748b] text-lg mt-1 font-medium">
              Controle de honorários e pagamentos.
            </p>
          </div>
          
          <div className="flex items-center gap-2 pb-1">
            <Select 
              value={selectedMonth.toString()} 
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-[140px] h-10 bg-white border-[#e2e8f0] font-bold text-[#1e293b]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                  <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={selectedYear.toString()} 
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[100px] h-10 bg-white border-[#e2e8f0] font-bold text-[#1e293b]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-6 py-6 rounded-xl font-bold gap-2 shadow-lg shadow-blue-200 uppercase tracking-wide"
        >
          <Plus className="w-5 h-5 stroke-[3px]" />
          Novo Lançamento
        </Button>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm bg-[#f0fdf4]">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] font-black text-[#166534] uppercase tracking-widest">
                  TOTAL RECEBIDO
                </span>
                <div className="w-8 h-8 rounded-full bg-[#dcfce7] flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-[#166534]" />
                </div>
              </div>
              <div className="text-4xl font-black text-[#166534] tracking-tight">
                {formatCurrency(totalRecebido)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-[#fffbeb]">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] font-black text-[#92400e] uppercase tracking-widest">
                  PENDENTE
                </span>
                <div className="w-8 h-8 rounded-full bg-[#fef3c7] flex items-center justify-center">
                  <Clock className="w-5 h-5 text-[#92400e]" />
                </div>
              </div>
              <div className="text-4xl font-black text-[#92400e] tracking-tight">
                {formatCurrency(totalPendente)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-[#fef2f2]">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] font-black text-[#991b1b] uppercase tracking-widest">
                  ATRASADO
                </span>
                <div className="w-8 h-8 rounded-full bg-[#fee2e2] flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-[#991b1b]" />
                </div>
              </div>
              <div className="text-4xl font-black text-[#991b1b] tracking-tight">
                {formatCurrency(totalAtrasado)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-none shadow-sm">
        <div className="p-6 border-b border-[#f1f5f9] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#eff6ff] flex items-center justify-center">
              <Receipt className="w-5 h-5 text-[#2563eb]" />
            </div>
            <h2 className="text-xl font-black text-[#1e293b] uppercase tracking-tight">
              Lançamentos
            </h2>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3 flex-1 max-w-2xl justify-end">
            <div className="relative w-full max-w-sm group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8] group-focus-within:text-[#2563eb] transition-colors" />
              <Input
                placeholder="Buscar cliente ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 bg-[#f8fafc] border-[#e2e8f0] focus:border-[#2563eb] focus:ring-[#2563eb]/10 rounded-lg"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px] h-11 bg-[#f8fafc] border-[#e2e8f0] font-medium text-[#64748b]">
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
            <TableHeader className="bg-[#f8fafc]">
              <TableRow className="hover:bg-transparent border-b border-[#f1f5f9]">
                <TableHead className="py-4 text-[10px] font-black text-[#94a3b8] uppercase tracking-widest px-6">
                  CLIENTE / DESCRIÇÃO
                </TableHead>
                <TableHead className="py-4 text-[10px] font-black text-[#94a3b8] uppercase tracking-widest">
                  VENCIMENTO
                </TableHead>
                <TableHead className="py-4 text-[10px] font-black text-[#94a3b8] uppercase tracking-widest text-center">
                  VALOR TOTAL
                </TableHead>
                <TableHead className="py-4 text-[10px] font-black text-[#94a3b8] uppercase tracking-widest text-center">
                  SALDO PAGO
                </TableHead>
                <TableHead className="py-4 text-[10px] font-black text-[#94a3b8] uppercase tracking-widest text-center">
                  STATUS
                </TableHead>
                <TableHead className="py-4 text-[10px] font-black text-[#94a3b8] uppercase tracking-widest text-right px-6">
                  AÇÕES
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#2563eb] opacity-20" />
                  </TableCell>
                </TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-64 text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-[#f8fafc] flex items-center justify-center">
                        <Filter className="w-8 h-8 text-[#cbd5e1]" />
                      </div>
                      <p className="text-[#64748b] font-medium italic">
                        Nenhum lançamento financeiro encontrado.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered?.map((h) => (
                  <TableRow
                    key={h.id}
                    className="group hover:bg-[#f8fafc] transition-colors border-b border-[#f1f5f9]"
                  >
                    <TableCell className="px-6 py-5">
                      <div className="font-bold text-[#1e293b]">{h.cliente?.nome || '-'}</div>
                      <div className="text-xs text-[#94a3b8] font-medium mt-0.5 truncate max-w-[200px]">
                        {h.descricao}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className={cn(
                          'font-bold',
                          h.status === 'PENDENTE' && h.dataVenc < today
                            ? 'text-[#dc2626]'
                            : 'text-[#475569]',
                        )}
                      >
                        {new Date(h.dataVenc + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-black text-[#1e293b]">{formatCurrency(h.valor)}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-bold text-[#10b981]">
                        {formatCurrency(h.valorPago || 0)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={cn(
                          'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border-none',
                          h.status === 'PAGO' && 'bg-[#dcfce7] text-[#166534]',
                          h.status === 'PENDENTE' && h.dataVenc >= today && 'bg-[#fef3c7] text-[#92400e]',
                          h.status === 'PENDENTE' && h.dataVenc < today && 'bg-[#fee2e2] text-[#991b1b]',
                          h.status === 'CANCELADO' && 'bg-[#f1f5f9] text-[#64748b]',
                        )}
                      >
                        {h.status === 'PENDENTE' && h.dataVenc < today ? 'ATRASADO' : h.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex items-center justify-end gap-1">
                        {h.status !== 'PAGO' && (
                          <button
                            onClick={() => handleQuitar(h)}
                            className="p-2 rounded-lg text-[#10b981] hover:bg-[#dcfce7] transition-all"
                            title="Quitar"
                          >
                            <Check className="w-4 h-4 stroke-[3px]" />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(h)}
                          className="p-2 rounded-lg text-[#64748b] hover:bg-[#eff6ff] hover:text-[#2563eb] transition-all"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(h)}
                          className="p-2 rounded-lg text-[#64748b] hover:bg-[#fef2f2] hover:text-[#dc2626] transition-all"
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

      {dialogOpen && (
        <HonorarioDialog
          honorario={editing}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleSubmit}
          isSubmitting={isPending}
        />
      )}
    </div>
  );
}

function HonorarioDialog({
  honorario,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  honorario: Honorario | null;
  onClose: () => void;
  onSubmit: (data: HonorarioInput) => void;
  isSubmitting: boolean;
}) {
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteOpen, setClienteOpen] = useState(false);
  const [selectedClienteNome, setSelectedClienteNome] = useState(
    honorario?.cliente?.nome ?? '',
  );

  const { data: clientesResult } = useClientes({
    q: clienteSearch || undefined,
    limit: 50,
  });
  const clientesList: Array<{ id: number; nome: string }> =
    (clientesResult as any)?.data ?? [];

  const [form, setForm] = useState<HonorarioInput>(() => ({
    clienteId: honorario?.clienteId ?? 0,
    processoJudicialId: honorario?.processoJudicialId ?? null,
    processoAdminId: honorario?.processoAdminId ?? null,
    descricao: honorario?.descricao ?? '',
    valor: honorario?.valor ?? '',
    valorPago: honorario?.valorPago ?? null,
    dataVenc: honorario?.dataVenc ?? '',
    dataPagto: honorario?.dataPagto ?? null,
    status: (honorario?.status as HonorarioInput['status']) ?? 'PENDENTE',
    tipo: honorario?.tipo ?? 'HONORARIO',
    observacoes: honorario?.observacoes ?? null,
  }));

  const set = (field: keyof HonorarioInput, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-[#f1f5f9] flex items-center justify-between bg-[#f8fafc]">
          <h2 className="text-xl font-bold text-[#1e293b] flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#2563eb]" />
            {honorario ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[#f1f5f9] rounded-full transition-colors">
            <X className="w-5 h-5 text-[#64748b]" />
          </button>
        </div>

        <form
          className="p-6 space-y-4 overflow-y-auto"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-bold text-[#64748b] uppercase">Cliente *</label>
              <Popover open={clienteOpen} onOpenChange={setClienteOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'w-full flex items-center justify-between p-2 border rounded-lg text-sm text-left bg-white transition-colors',
                      clienteOpen ? 'border-[#2563eb] ring-2 ring-[#2563eb]/20' : 'border-[#e2e8f0] hover:border-[#94a3b8]',
                    )}
                  >
                    <span className={selectedClienteNome ? 'text-[#1e293b]' : 'text-[#94a3b8]'}>
                      {selectedClienteNome || 'Selecione um cliente...'}
                    </span>
                    <ChevronsUpDown className="w-4 h-4 text-[#94a3b8] shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 z-[200]"
                  style={{ width: 'var(--radix-popover-trigger-width)' }}
                  align="start"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar cliente..."
                      onValueChange={setClienteSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        {clientesList.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.nome}
                            data-checked={form.clienteId === c.id}
                            onSelect={() => {
                              set('clienteId', c.id);
                              setSelectedClienteNome(c.nome);
                              setClienteOpen(false);
                            }}
                          >
                            {c.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-xs font-bold text-[#64748b] uppercase">Descrição *</label>
              <input
                type="text"
                required
                placeholder="Ex: Honorários contratuais - Janeiro/2025"
                className="w-full p-2 border border-[#e2e8f0] rounded-lg outline-none focus:ring-2 focus:ring-[#2563eb]/20 text-sm"
                value={form.descricao}
                onChange={(e) => set('descricao', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#64748b] uppercase">Tipo</label>
              <select
                className="w-full p-2 border border-[#e2e8f0] rounded-lg outline-none focus:ring-2 focus:ring-[#2563eb]/20 bg-white text-sm"
                value={form.tipo ?? 'HONORARIO'}
                onChange={(e) => set('tipo', e.target.value)}
              >
                <option value="HONORARIO">Honorário</option>
                <option value="DESPESA">Despesa</option>
                <option value="REEMBOLSO">Reembolso</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#64748b] uppercase">Status</label>
              <select
                className="w-full p-2 border border-[#e2e8f0] rounded-lg outline-none focus:ring-2 focus:ring-[#2563eb]/20 bg-white text-sm"
                value={form.status ?? 'PENDENTE'}
                onChange={(e) => {
                  const newStatus = e.target.value as HonorarioInput['status'];
                  set('status', newStatus);
                  // Se mudar para PAGO e não tiver data de pagamento, coloca hoje automaticamente
                  if (newStatus === 'PAGO' && !form.dataPagto) {
                    set('dataPagto', today);
                  }
                  // Se mudar para PAGO e não tiver valor pago, sugere o valor total
                  if (newStatus === 'PAGO' && !form.valorPago) {
                    set('valorPago', form.valor);
                  }
                }}
              >
                <option value="PENDENTE">Pendente</option>
                <option value="PAGO">Pago</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#64748b] uppercase">Valor Total (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0,00"
                className="w-full p-2 border border-[#e2e8f0] rounded-lg outline-none focus:ring-2 focus:ring-[#2563eb]/20 text-sm"
                value={form.valor}
                onChange={(e) => set('valor', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#64748b] uppercase">Valor Pago (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                className="w-full p-2 border border-[#e2e8f0] rounded-lg outline-none focus:ring-2 focus:ring-[#2563eb]/20 text-sm"
                value={form.valorPago ?? ''}
                onChange={(e) => set('valorPago', e.target.value || null)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#64748b] uppercase">Vencimento *</label>
              <input
                type="date"
                required
                className="w-full p-2 border border-[#e2e8f0] rounded-lg outline-none focus:ring-2 focus:ring-[#2563eb]/20 text-sm"
                value={form.dataVenc}
                onChange={(e) => set('dataVenc', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#64748b] uppercase">Data de Pagamento</label>
              <input
                type="date"
                className="w-full p-2 border border-[#e2e8f0] rounded-lg outline-none focus:ring-2 focus:ring-[#2563eb]/20 text-sm"
                value={form.dataPagto ?? ''}
                onChange={(e) => set('dataPagto', e.target.value || null)}
              />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-xs font-bold text-[#64748b] uppercase">Observações</label>
              <textarea
                rows={3}
                placeholder="Observações adicionais..."
                className="w-full p-2 border border-[#e2e8f0] rounded-lg outline-none focus:ring-2 focus:ring-[#2563eb]/20 text-sm resize-none"
                value={form.observacoes ?? ''}
                onChange={(e) => set('observacoes', e.target.value || null)}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-[#e2e8f0] rounded-lg text-sm font-bold text-[#64748b] hover:bg-[#f8fafc] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !form.clienteId}
              className="flex-1 py-2.5 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-[#1d4ed8] shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : honorario ? (
                'SALVAR ALTERAÇÕES'
              ) : (
                'CRIAR LANÇAMENTO'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
