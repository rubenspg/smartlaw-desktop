import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useRegional } from '@/components/regional-provider';

interface HonorariosSummaryCardsProps {
  totalRecebido: number;
  totalPendente: number;
  totalAtrasado: number;
}

export function HonorariosSummaryCards({ totalRecebido, totalPendente, totalAtrasado }: HonorariosSummaryCardsProps) {
  const { formatCurrency } = useRegional();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="border-none shadow-sm bg-emerald-50 dark:bg-emerald-950/20">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">
              TOTAL RECEBIDO
            </span>
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />
            </div>
          </div>
          <div className="text-4xl font-black text-emerald-800 dark:text-emerald-400 tracking-tight">
            {formatCurrency(totalRecebido)}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[11px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">
              PENDENTE
            </span>
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-800 dark:text-amber-400" />
            </div>
          </div>
          <div className="text-4xl font-black text-amber-800 dark:text-amber-400 tracking-tight">
            {formatCurrency(totalPendente)}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-red-50 dark:bg-red-950/20">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[11px] font-black text-red-800 dark:text-red-400 uppercase tracking-widest">
              ATRASADO
            </span>
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-800 dark:text-red-400" />
            </div>
          </div>
          <div className="text-4xl font-black text-red-800 dark:text-red-400 tracking-tight">
            {formatCurrency(totalAtrasado)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
