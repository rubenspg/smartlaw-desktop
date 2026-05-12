import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  Users,
  FileText,
  Clock,
  TrendingUp,
  AlertCircle,
  Calendar,
  User as UserIcon,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { useDashboardStats } from '@/hooks/use-dashboard';
import { useAuth } from '@/lib/auth';
import { useRegional } from '@/components/regional-provider';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_dashboard/insights/')({
  component: InsightsPage,
});

type TimeSlice = 'all' | '1y' | '6m' | '1m';

function InsightsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatDate } = useRegional();
  const currentYear = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [timeSlice, setTimeSlice] = useState<TimeSlice>('all');

  const { data: stats, isLoading, error } = useDashboardStats(
    selectedYear,
    selectedMonth > 0 ? selectedMonth : undefined
  );

  useEffect(() => {
    if (user?.perfil === 'usuario' || user?.perfil === 'secretaria') {
      navigate({ to: '/' });
    }
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-muted-foreground gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="font-medium">Carregando painel de insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-destructive gap-4">
        <AlertCircle className="w-10 h-10" />
        <p className="font-medium">{(error as Error).message}</p>
      </div>
    );
  }

  if (!stats) return null;

  const getFilteredData = () => {
    if (!stats?.aquisicaoClientes) return [];
    const data = [...stats.aquisicaoClientes];
    if (timeSlice === 'all' && selectedMonth === 0) return data;

    const now = new Date();
    const months = timeSlice === '1y' ? 12 : timeSlice === '6m' ? 6 : 1;
    const limitDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const limitStr = `${limitDate.getFullYear()}-${String(limitDate.getMonth() + 1).padStart(2, '0')}`;
    return data.filter((d) => d.mes >= limitStr);
  };

  const getLast12MonthsData = () => {
    if (!stats?.aquisicaoClientes) return [];
    const data = [...stats.aquisicaoClientes];
    const now = new Date();
    const limitDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const limitStr = `${limitDate.getFullYear()}-${String(limitDate.getMonth() + 1).padStart(2, '0')}`;
    return data.filter((d) => d.mes >= limitStr);
  };

  const formatMonth = (monthStr: unknown) => {
    if (!monthStr || typeof monthStr !== 'string') return String(monthStr ?? '');
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const date = new Date(year, month - 1);
    return formatDate(date, { month: 'short', year: '2-digit' }).toUpperCase();
  };

  const filtered = getFilteredData();
  const last12 = getLast12MonthsData();
  const availableYears = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  const monthsList = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Insights</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Análise de desempenho e métricas estratégicas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="appearance-none pl-4 pr-10 py-2 bg-card border border-input rounded-xl text-sm font-bold text-foreground shadow-sm cursor-pointer hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value={0}>Ano Inteiro</option>
              {monthsList.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none pl-4 pr-10 py-2 bg-card border border-input rounded-xl text-sm font-bold text-foreground shadow-sm cursor-pointer hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* KPIs gerais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Clientes"
          value={stats?.totais?.clientes || 0}
          icon={Users}
          description="Base total de clientes"
          color="blue"
        />
        <StatCard
          title="Processos Judiciais"
          value={stats?.totais?.processosJudiciais || 0}
          icon={FileText}
          description="Ações em curso"
          color="amber"
        />
        <StatCard
          title="Processos Administrativos"
          value={stats?.totais?.processosAdministrativos || 0}
          icon={Clock}
          description="Processos INSS/Outros"
          color="emerald"
        />
      </div>

      {/* Aquisição de Clientes */}
      <div className="p-6 bg-card rounded-2xl border border-border shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <TrendingUp className="w-5 h-5 text-primary" />
              Aquisição de Clientes
            </h2>
            <p className="text-xs text-muted-foreground">Novos clientes cadastrados no período</p>
          </div>
          <div className="flex items-center bg-muted p-1 rounded-lg">
            {(['all', '1y', '6m', '1m'] as const).map((slice) => (
              <button
                key={slice}
                onClick={() => setTimeSlice(slice)}
                className={cn(
                  'px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase',
                  timeSlice === slice
                    ? 'bg-card shadow-sm text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {slice === 'all' ? 'Tudo' : slice === '1y' ? '1 Ano' : slice === '6m' ? '6 Meses' : '1 Mês'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[300px] w-full pt-4">
          {filtered.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filtered}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="mes"
                  tickFormatter={formatMonth}
                  fontSize={10}
                  fontWeight="bold"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  fontSize={10}
                  fontWeight="bold"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  labelFormatter={formatMonth}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderRadius: '12px',
                    border: '1px solid hsl(var(--border))',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'hsl(var(--card-foreground))',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Novos Clientes"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Nenhum dado encontrado para o período selecionado." />
          )}
        </div>
      </div>

      {/* Demografia */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
          <UserIcon className="w-6 h-6 text-primary" />
          Demografia dos Clientes
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          <DemographicsCard
            title="Distribuição por Idade"
            data={stats.demografia.idade ?? []}
            dataKey="total"
            nameKey="faixa"
            palette={['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#e2e8f0']}
          />
          <DemographicsCard
            title="Principais Cidades"
            data={stats.demografia.cidades ?? []}
            dataKey="total"
            nameKey="cidade"
            palette={['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0']}
          />
          <DemographicsCard
            title="Principais Profissões"
            data={stats.demografia.profissoes ?? []}
            dataKey="total"
            nameKey="profissao"
            palette={['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']}
          />
        </div>
      </div>

      {/* Distribuição Judicial */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-6 bg-card rounded-2xl border border-border shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Calendar className="w-5 h-5 text-primary" />
              Volume Mensal (12 Meses)
            </h2>
            <p className="text-xs text-muted-foreground">Comparativo de captação mensal</p>
          </div>
          <div className="h-[250px] w-full">
            {last12.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last12}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="mes"
                    tickFormatter={formatMonth}
                    fontSize={9}
                    fontWeight="bold"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    fontSize={9}
                    fontWeight="bold"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    labelFormatter={formatMonth}
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderRadius: '12px',
                      border: '1px solid hsl(var(--border))',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: 'hsl(var(--card-foreground))',
                    }}
                  />
                  <Bar dataKey="total" name="Novos Clientes" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30}>
                    {last12.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === last12.length - 1 ? '#2563eb' : '#93c5fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="Sem dados nos últimos 12 meses." />
            )}
          </div>
        </div>

        <div className="p-6 bg-card rounded-2xl border border-border shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-border pb-2 text-foreground">
            <FileText className="w-5 h-5 text-primary" /> Distribuição por Comarca
          </h2>
          <BarList
            rows={stats.judiciaisPorComarca ?? []}
            labelKey="comarca"
            total={stats.totais.processosJudiciais || 1}
            barColor="bg-primary"
          />
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground italic border border-dashed border-border rounded-xl bg-muted/40">
      {label}
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: 'blue' | 'amber' | 'emerald' | 'purple' | 'red';
  currency?: boolean;
};

function StatCard({ title, value, icon: Icon, description, color, currency }: StatCardProps) {
  const colors: Record<StatCardProps['color'], string> = {
    blue: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900/30',
    amber: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900/30',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/30',
    purple: 'text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/30 dark:border-purple-900/30',
    red: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900/30',
  };
  return (
    <div className="p-6 bg-card rounded-2xl border border-border shadow-sm space-y-3 hover:shadow-md transition-all group">
      <div className="flex items-center justify-between">
        <div className={cn('p-2 rounded-xl border', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{title}</h3>
        <div className="text-2xl font-black mt-1 text-foreground group-hover:scale-105 transition-transform truncate">
          {value || 0}
        </div>
      </div>
      <p className="text-xs text-muted-foreground font-medium">{description}</p>
    </div>
  );
}

type DemographicsCardProps = {
  title: string;
  data: Array<Record<string, any>>;
  dataKey: string;
  nameKey: string;
  palette: string[];
};

function DemographicsCard({ title, data, dataKey, nameKey, palette }: DemographicsCardProps) {
  return (
    <div className="p-6 bg-card rounded-2xl border border-border shadow-sm flex flex-col h-[350px]">
      <h3 className="text-sm font-bold text-muted-foreground uppercase mb-4 tracking-wider">{title}</h3>
      <div className="flex-1">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 30, right: 30 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey={nameKey}
                type="category"
                width={80}
                fontSize={10}
                fontWeight="bold"
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderRadius: '12px',
                  border: '1px solid hsl(var(--border))',
                  fontSize: '11px',
                  fontWeight: 'bold',
                }}
              />
              <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} barSize={20}>
                {data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label="Sem dados." />
        )}
      </div>
    </div>
  );
}

function BarList({
  rows,
  labelKey,
  total,
  barColor,
}: {
  rows: Array<Record<string, any>>;
  labelKey: string;
  total: number;
  barColor: string;
}) {
  if (!rows || rows.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Sem dados registrados.</p>;
  }
  const safeTotal = total || 1;
  return (
    <div className="space-y-4">
      {rows.map((r, i) => {
        const value = Number(r.total || 0);
        const percentage = Math.min(100, (value / safeTotal) * 100);
        return (
          <div key={`${r[labelKey] || i}-${i}`} className="space-y-1">
            <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground">
              <span>{r[labelKey] || '—'}</span>
              <span>{value}</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full transition-all duration-500', barColor)}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
