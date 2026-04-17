import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { 
  Plus, 
  Search, 
  MoreHorizontal,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import { useHonorarios } from '@/hooks/use-honorarios';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_dashboard/financeiro/')({
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  
  const { data: honorarios, isLoading } = useHonorarios({ 
    status: status === 'all' ? undefined : status 
  });

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
  };

  const totalRecebido = honorarios?.reduce((acc: number, curr: any) => {
    return curr.status === 'PAGO' ? acc + Number(curr.valorPago || curr.valor) : acc;
  }, 0) || 0;

  const totalPendente = honorarios?.reduce((acc: number, curr: any) => {
    return curr.status === 'PENDENTE' ? acc + Number(curr.valor) : acc;
  }, 0) || 0;

  const totalAtrasado = 0; // Assuming 0 as per image for now

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#1e293b]">Financeiro</h1>
          <p className="text-[#64748b] text-lg mt-1 font-medium">Controle de honorários e pagamentos do escritório.</p>
        </div>
        <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-6 py-6 rounded-xl font-bold gap-2 shadow-lg shadow-blue-200 uppercase tracking-wide">
          <Plus className="w-5 h-5 stroke-[3px]" />
          Novo Lançamento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-[#f0fdf4]">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-black text-[#166534] uppercase tracking-widest">TOTAL RECEBIDO</span>
              <div className="w-8 h-8 rounded-full bg-[#dcfce7] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[#166534]" />
              </div>
            </div>
            <div className="text-4xl font-black text-[#166534] tracking-tight">{formatCurrency(totalRecebido)}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-[#fffbeb]">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-black text-[#92400e] uppercase tracking-widest">PENDENTE</span>
              <div className="w-8 h-8 rounded-full bg-[#fef3c7] flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#92400e]" />
              </div>
            </div>
            <div className="text-4xl font-black text-[#92400e] tracking-tight">{formatCurrency(totalPendente)}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-[#fef2f2]">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-black text-[#991b1b] uppercase tracking-widest">ATRASADO</span>
              <div className="w-8 h-8 rounded-full bg-[#fee2e2] flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-[#991b1b]" />
              </div>
            </div>
            <div className="text-4xl font-black text-[#991b1b] tracking-tight">{formatCurrency(totalAtrasado)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <div className="p-6 border-b border-[#f1f5f9] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#eff6ff] flex items-center justify-center">
              <Receipt className="w-5 h-5 text-[#2563eb]" />
            </div>
            <h2 className="text-xl font-black text-[#1e293b] uppercase tracking-tight">Lançamentos</h2>
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
                <TableHead className="py-4 text-[10px] font-black text-[#94a3b8] uppercase tracking-widest px-6">CLIENTE / PROCESSO</TableHead>
                <TableHead className="py-4 text-[10px] font-black text-[#94a3b8] uppercase tracking-widest">VENCIMENTO</TableHead>
                <TableHead className="py-4 text-[10px] font-black text-[#94a3b8] uppercase tracking-widest text-center">VALOR TOTAL</TableHead>
                <TableHead className="py-4 text-[10px] font-black text-[#94a3b8] uppercase tracking-widest text-center">SALDO PAGO</TableHead>
                <TableHead className="py-4 text-[10px] font-black text-[#94a3b8] uppercase tracking-widest text-center">STATUS</TableHead>
                <TableHead className="py-4 text-[10px] font-black text-[#94a3b8] uppercase tracking-widest text-right px-6">AÇÃO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#2563eb] opacity-20" />
                  </TableCell>
                </TableRow>
              ) : honorarios?.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-64 text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-[#f8fafc] flex items-center justify-center">
                        <Filter className="w-8 h-8 text-[#cbd5e1]" />
                      </div>
                      <p className="text-[#64748b] font-medium italic">Nenhum lançamento financeiro encontrado.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                honorarios?.map((h: any) => (
                  <TableRow key={h.id} className="group hover:bg-[#f8fafc] transition-colors border-b border-[#f1f5f9]">
                    <TableCell className="px-6 py-5">
                      <div className="font-bold text-[#1e293b]">{h.cliente?.nome || '-'}</div>
                      <div className="text-xs text-[#94a3b8] font-medium mt-0.5 truncate max-w-[200px]">{h.descricao}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-[#475569]">{new Date(h.dataVenc).toLocaleDateString('pt-BR')}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-black text-[#1e293b]">{formatCurrency(h.valor)}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-bold text-[#10b981]">{formatCurrency(h.valorPago || 0)}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border-none",
                        h.status === 'PAGO' && "bg-[#dcfce7] text-[#166534]",
                        h.status === 'PENDENTE' && "bg-[#fef3c7] text-[#92400e]",
                        h.status === 'CANCELADO' && "bg-[#fee2e2] text-[#991b1b]"
                      )}>
                        {h.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-[#64748b] hover:text-[#2563eb] hover:bg-[#eff6ff] transition-all">
                        <MoreHorizontal className="w-5 h-5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
