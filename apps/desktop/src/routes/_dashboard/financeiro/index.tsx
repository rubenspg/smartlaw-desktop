import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { 
  DollarSign, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal,
  Loader2,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import { useHonorarios } from '@/hooks/use-honorarios';

export const Route = createFileRoute('/_dashboard/financeiro/')({
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const [status, setStatus] = useState<string>('all');
  const { data: honorarios, isLoading, isError } = useHonorarios({ 
    status: status === 'all' ? undefined : status 
  });

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
  };

  const totalPendente = honorarios?.reduce((acc: number, curr: any) => {
    return curr.status === 'PENDENTE' ? acc + Number(curr.valor) : acc;
  }, 0) || 0;

  const totalRecebido = honorarios?.reduce((acc: number, curr: any) => {
    return curr.status === 'PAGO' ? acc + Number(curr.valorPago || curr.valor) : acc;
  }, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">Controle de honorários e pagamentos.</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Lançar Honorário
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRecebido)}</div>
            <p className="text-xs text-muted-foreground">Mês atual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalPendente)}</div>
            <p className="text-xs text-muted-foreground">A receber</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">84%</div>
            <p className="text-xs text-muted-foreground">+2.1% em relação ao mês anterior</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Faturas e Honorários</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDENTE">Pendentes</SelectItem>
                  <SelectItem value="PAGO">Pagos</SelectItem>
                  <SelectItem value="CANCELADO">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : honorarios?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhum lançamento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              honorarios?.map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.descricao}</TableCell>
                  <TableCell>{h.cliente?.nome || '-'}</TableCell>
                  <TableCell>{new Date(h.dataVenc).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>{formatCurrency(h.valor)}</TableCell>
                  <TableCell>
                    <Badge variant={h.status === 'PAGO' ? 'success' : h.status === 'CANCELADO' ? 'destructive' : 'warning'} className={cn(
                      h.status === 'PAGO' && "bg-green-500 hover:bg-green-600",
                      h.status === 'PENDENTE' && "bg-amber-500 hover:bg-amber-600"
                    )}>
                      {h.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
