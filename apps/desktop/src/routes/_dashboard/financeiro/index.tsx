import { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Plus,
  Loader2,
  Receipt,
  X,
  ChevronsUpDown,
} from 'lucide-react';
import type { HonorarioInput } from '@smartlaw/shared';
import type { HonorarioListItem } from '@/lib/entities';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';


import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  useHonorarios,
  useCreateHonorario,
  useUpdateHonorario,
  useDeleteHonorario,
  useHonorarioSummary,
} from '@/hooks/use-honorarios';
import { useClientes } from '@/hooks/use-clientes';
import { useAuth } from '@/lib/auth';
import { useRegional } from '@/components/regional-provider';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { HonorariosSummaryCards } from '@/components/financeiro/honorarios-summary-cards';
import { HonorariosTable } from '@/components/financeiro/honorarios-table';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_dashboard/financeiro/')({
  component: FinanceiroPage,
});

const today = new Date().toISOString().split('T')[0];

function FinanceiroPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency, formatDate } = useRegional();
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (user?.perfil === 'usuario' || user?.perfil === 'secretaria') {
      navigate({ to: '/' });
    }
  }, [user, navigate]);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HonorarioListItem | null>(null);

  const isAdmin = user?.perfil === 'admin';

  const { data: honorariosResult, isLoading } = useHonorarios({
    status: status === 'all' ? undefined : status,
    limit: 100,
    month: selectedMonth,
    year: selectedYear,
  });
  const honorarios = honorariosResult?.data;

  const { data: summary } = useHonorarioSummary({
    month: selectedMonth,
    year: selectedYear,
  });

  const createHonorario = useCreateHonorario();
  const updateHonorario = useUpdateHonorario();
  const deleteHonorario = useDeleteHonorario();

  const filtered = honorarios?.filter((h: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const nomeCliente = h.cliente?.nome?.toLowerCase() || '';
    const descricao = h.descricao?.toLowerCase() || '';
    const numJudicial = h.processoJudicial?.numero?.toLowerCase() || '';
    const numAdmin = h.processoAdmin?.numero?.toLowerCase() || '';
    
    return nomeCliente.includes(term) || 
           descricao.includes(term) || 
           numJudicial.includes(term) || 
           numAdmin.includes(term);
  });

  const totalRecebido = summary?.totalRecebido ?? 0;
  const totalPendente = summary?.totalPendente ?? 0;
  const totalAtrasado = summary?.totalAtrasado ?? 0;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (h: HonorarioListItem) => {
    setEditing(h);
    setDialogOpen(true);
  };

  const handleDelete = async (h: HonorarioListItem) => {
    if (!(await confirm({ description: `Excluir o lançamento "${h.descricao}"?`, destructive: true, confirmText: 'Excluir' }))) return;
    try {
      await deleteHonorario.mutateAsync(h.id);
    } catch (err: any) {
      console.error('Action error:', err);
      toast.error(err.message || 'Erro inesperado ao realizar operação');
    }
  };

  const handleQuitar = async (h: HonorarioListItem) => {
    if (!(await confirm({ description: `Marcar o lançamento "${h.descricao}" como PAGO?`, confirmText: 'Marcar como pago' }))) return;
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
      console.error('Action error:', err);
      toast.error(err.message || 'Erro inesperado ao realizar operação');
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
      console.error('Action error:', err);
      toast.error(err.message || 'Erro inesperado ao realizar operação');
    }
  };

  const isPending = createHonorario.isPending || updateHonorario.isPending;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col md:flex-row md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Financeiro</h1>
            <p className="text-muted-foreground text-lg mt-1 font-medium">
              Controle de honorários e pagamentos.
            </p>
          </div>
          
          <div className="flex items-center gap-2 pb-1">
            <Select 
              value={selectedMonth.toString()} 
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-[140px] h-10 bg-card border-input font-bold text-foreground">
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
              <SelectTrigger className="w-[100px] h-10 bg-card border-input font-bold text-foreground">
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
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-6 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20 uppercase tracking-wide"
        >
          <Plus className="w-5 h-5 stroke-[3px]" />
          Novo Lançamento
        </Button>
      </div>

      {isAdmin && (
        <HonorariosSummaryCards
          totalRecebido={totalRecebido}
          totalPendente={totalPendente}
          totalAtrasado={totalAtrasado}
        />
      )}

      <HonorariosTable
        rows={filtered}
        isLoading={isLoading}
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        onEdit={openEdit}
        onQuitar={handleQuitar}
        onDelete={handleDelete}
      />

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
  honorario: HonorarioListItem | null;
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col border border-border">
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/50">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            {honorario ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
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
              <label className="text-xs font-bold text-muted-foreground uppercase">Cliente *</label>
              <Popover open={clienteOpen} onOpenChange={setClienteOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'w-full flex items-center justify-between p-2 border rounded-lg text-sm text-left bg-card transition-colors',
                      clienteOpen ? 'border-primary ring-2 ring-primary/20' : 'border-input hover:border-muted-foreground/50',
                    )}
                  >
                    <span className={selectedClienteNome ? 'text-foreground' : 'text-muted-foreground'}>
                      {selectedClienteNome || 'Selecione um cliente...'}
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
              <label className="text-xs font-bold text-muted-foreground uppercase">Descrição *</label>
              <input
                type="text"
                required
                placeholder="Ex: Honorários contratuais - Janeiro/2025"
                className="w-full p-2 border border-input rounded-lg outline-none focus:ring-2 focus:ring-primary/20 bg-card text-foreground text-sm"
                value={form.descricao}
                onChange={(e) => set('descricao', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Tipo</label>
              <select
                className="w-full p-2 border border-input rounded-lg outline-none focus:ring-2 focus:ring-primary/20 bg-card text-foreground text-sm"
                value={form.tipo ?? 'HONORARIO'}
                onChange={(e) => set('tipo', e.target.value)}
              >
                <option value="HONORARIO">Honorário</option>
                <option value="DESPESA">Despesa</option>
                <option value="REEMBOLSO">Reembolso</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
              <select
                className="w-full p-2 border border-input rounded-lg outline-none focus:ring-2 focus:ring-primary/20 bg-card text-foreground text-sm"
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
              <label className="text-xs font-bold text-muted-foreground uppercase">Valor Total (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0,00"
                className="w-full p-2 border border-input rounded-lg outline-none focus:ring-2 focus:ring-primary/20 bg-card text-foreground text-sm"
                value={form.valor}
                onChange={(e) => set('valor', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Valor Pago (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                className="w-full p-2 border border-input rounded-lg outline-none focus:ring-2 focus:ring-primary/20 bg-card text-foreground text-sm"
                value={form.valorPago ?? ''}
                onChange={(e) => set('valorPago', e.target.value || null)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Vencimento *</label>
              <input
                type="date"
                required
                className="w-full p-2 border border-input rounded-lg outline-none focus:ring-2 focus:ring-primary/20 bg-card text-foreground text-sm"
                value={form.dataVenc}
                onChange={(e) => set('dataVenc', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Data de Pagamento</label>
              <input
                type="date"
                className="w-full p-2 border border-input rounded-lg outline-none focus:ring-2 focus:ring-primary/20 bg-card text-foreground text-sm"
                value={form.dataPagto ?? ''}
                onChange={(e) => set('dataPagto', e.target.value || null)}
              />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Observações</label>
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
              className="flex-1 py-2.5 border border-input rounded-lg text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !form.clienteId}
              className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
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
