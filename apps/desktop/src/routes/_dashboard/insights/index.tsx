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
  DollarSign,
  CheckSquare,
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
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { useDashboardStats } from '@/hooks/use-dashboard';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_dashboard/insights/')({
  component: InsightsPage,
});

type TimeSlice = 'all' | '1y' | '6m' | '1m';

const PRIORITY_COLORS: Record<string, string> = {
  ALTA: '#dc2626',
  MEDIA: '#d97706',
  BAIXA: '#16a34a',
  'Sem prioridade': '#94a3b8',
};

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  'Sem status': 'Sem status',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function InsightsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [timeSlice, setTimeSlice] = useState<TimeSlice>('all');
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: stats, isLoading, error } = useDashboardStats(selectedYear);

  useEffect(() => {
    if (user?.perfil === 'usuario') {
      navigate({ to: '/' });
    }
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-[#64748b] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#2563eb]" />
        <p className="font-medium">Carregando painel de insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-[#991b1b] gap-4">
        <AlertCircle className="w-10 h-10" />
        <p className="font-medium">{(error as Error).message}</p>
      </div>
    );
  }

  const getFilteredData = () => {
    if (!stats?.aquisicaoClientes) return [];
    const data = [...stats.aquisicaoClientes];
    if (timeSlice === 'all') return data;

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
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
  };

  const filtered = getFilteredData();
  const last12 = getLast12MonthsData();
  const availableYears = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[#1e293b]">Insights</h1>
          <p className="text-[#64748b] mt-1 text-lg">
            Análise de desempenho e métricas estratégicas.
          </p>
        </div>
        <div className="relative">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="appearance-none pl-4 pr-10 py-2 bg-white border border-[#e2e8f0] rounded-xl text-sm font-bold text-[#1e293b] shadow-sm cursor-pointer hover:border-[#2563eb] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b] pointer-events-none" />
        </div>
      </div>

      {/* KPIs gerais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Clientes"
          value={stats?.totais.clientes ?? 0}
          icon={Users}
          description="Base total de clientes"
          color="blue"
        />
        <StatCard
          title="Processos Judiciais"
          value={stats?.totais.processosJudiciais ?? 0}
          icon={FileText}
          description="Ações em curso"
          color="amber"
        />
        <StatCard
          title="Processos Administrativos"
          value={stats?.totais.processosAdministrativos ?? 0}
          icon={Clock}
          description="Processos INSS/Outros"
          color="emerald"
        />
      </div>

      {/* Financeiro */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[#1e293b]">
          <DollarSign className="w-6 h-6 text-[#2563eb]" />
          Financeiro — {selectedYear}
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Recebido"
            value={stats?.financeiro.totalRecebido ?? 0}
            icon={DollarSign}
            description={`Honorários pagos em ${selectedYear}`}
            color="emerald"
            currency
          />
          <StatCard
            title="A Receber"
            value={stats?.financeiro.totalPendente ?? 0}
            icon={Calendar}
            description="Pendentes com venc. futuro"
            color="amber"
            currency
          />
          <StatCard
            title="Em Atraso"
            value={stats?.financeiro.totalAtrasado ?? 0}
            icon={AlertCircle}
            description="Pendentes com venc. passado"
            color="red"
            currency
          />
        </div>

        <div className="p-6 bg-white rounded-2xl border border-[#f1f5f9] shadow-sm">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 text-[#1e293b] mb-1">
              <TrendingUp className="w-5 h-5 text-[#2563eb]" />
              Receita Mensal
            </h3>
            <p className="text-xs text-[#64748b] mb-4">Recebido, a receber e em atraso por mês em {selectedYear}</p>
          </div>
          <div className="h-[280px] w-full">
            {(stats?.financeiro.mensais ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.financeiro.mensais ?? []} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="mes"
                    tickFormatter={formatMonth}
                    fontSize={9}
                    fontWeight="bold"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8' }}
                  />
                  <YAxis
                    fontSize={9}
                    fontWeight="bold"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8' }}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    labelFormatter={formatMonth}
                    formatter={(value, name) => [
                      formatCurrency(Number(value)),
                      name === 'recebido' ? 'Recebido' : name === 'pendente' ? 'A Receber' : 'Em Atraso',
                    ]}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}
                  />
                  <Legend
                    formatter={(value) =>
                      value === 'recebido' ? 'Recebido' : value === 'pendente' ? 'A Receber' : 'Em Atraso'
                    }
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '8px' }}
                  />
                  <Bar dataKey="recebido" fill="#16a34a" radius={[3, 3, 0, 0]} barSize={18} />
                  <Bar dataKey="pendente" fill="#d97706" radius={[3, 3, 0, 0]} barSize={18} />
                  <Bar dataKey="atrasado" fill="#dc2626" radius={[3, 3, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={`Sem lançamentos financeiros em ${selectedYear}.`} />
            )}
          </div>
        </div>
      </div>

      {/* Tarefas */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[#1e293b]">
          <CheckSquare className="w-6 h-6 text-[#2563eb]" />
          Tarefas
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            title="Tarefas Ativas"
            value={stats?.tarefas.total ?? 0}
            icon={CheckSquare}
            description="Pendentes e em andamento"
            color="blue"
          />
          <StatCard
            title="Em Atraso"
            value={stats?.tarefas.atrasadas ?? 0}
            icon={AlertCircle}
            description="Com prazo vencido"
            color="red"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="p-6 bg-white rounded-2xl border border-[#f1f5f9] shadow-sm flex flex-col h-[320px]">
            <h3 className="text-sm font-bold text-[#64748b] uppercase mb-4 tracking-wider">
              Por Prioridade (ativas)
            </h3>
            <div className="flex-1">
              {(stats?.tarefas.porPrioridade ?? []).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.tarefas.porPrioridade ?? []}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="total"
                      nameKey="prioridade"
                    >
                      {(stats?.tarefas.porPrioridade ?? []).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PRIORITY_COLORS[entry.prioridade] ?? '#94a3b8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontWeight: 'bold',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="Sem tarefas ativas." />
              )}
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#f1f5f9] shadow-sm">
            <h3 className="text-sm font-bold text-[#64748b] uppercase mb-4 tracking-wider">
              Por Status
            </h3>
            <BarList
              rows={(stats?.tarefas.porStatus ?? []).map((r) => ({
                ...r,
                label: STATUS_LABEL[r.status] ?? r.status,
              }))}
              labelKey="label"
              total={(stats?.tarefas.porStatus ?? []).reduce((acc, r) => acc + r.total, 0)}
              barColor="bg-[#2563eb]"
            />
          </div>
        </div>
      </div>

      {/* Aquisição de Clientes */}
      <div className="p-6 bg-white rounded-2xl border border-[#f1f5f9] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-[#1e293b]">
              <TrendingUp className="w-5 h-5 text-[#2563eb]" />
              Aquisição de Clientes
            </h2>
            <p className="text-xs text-[#64748b]">Novos clientes cadastrados no período</p>
          </div>
          <div className="flex items-center bg-[#f1f5f9] p-1 rounded-lg">
            {(['all', '1y', '6m', '1m'] as const).map((slice) => (
              <button
                key={slice}
                onClick={() => setTimeSlice(slice)}
                className={cn(
                  'px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase',
                  timeSlice === slice
                    ? 'bg-white shadow-sm text-[#2563eb]'
                    : 'text-[#64748b] hover:text-[#1e293b]',
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
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="mes"
                  tickFormatter={formatMonth}
                  fontSize={10}
                  fontWeight="bold"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8' }}
                />
                <YAxis
                  fontSize={10}
                  fontWeight="bold"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8' }}
                />
                <Tooltip
                  labelFormatter={formatMonth}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Novos Clientes"
                  stroke="#2563eb"
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
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[#1e293b]">
          <UserIcon className="w-6 h-6 text-[#2563eb]" />
          Demografia dos Clientes
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          <DemographicsCard
            title="Distribuição por Idade"
            data={stats?.demografia.idade ?? []}
            dataKey="total"
            nameKey="faixa"
            palette={['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#e2e8f0']}
            donut
          />
          <DemographicsCard
            title="Principais Cidades"
            data={stats?.demografia.cidades ?? []}
            dataKey="total"
            nameKey="cidade"
            palette={['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0']}
          />
          <DemographicsCard
            title="Principais Profissões"
            data={stats?.demografia.profissoes ?? []}
            dataKey="total"
            nameKey="profissao"
            palette={['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']}
          />
        </div>
      </div>

      {/* Distribuição Judicial */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-6 bg-white rounded-2xl border border-[#f1f5f9] shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-[#1e293b]">
              <Calendar className="w-5 h-5 text-[#2563eb]" />
              Volume Mensal (12 Meses)
            </h2>
            <p className="text-xs text-[#64748b]">Comparativo de captação mensal</p>
          </div>
          <div className="h-[250px] w-full">
            {last12.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last12}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="mes"
                    tickFormatter={formatMonth}
                    fontSize={9}
                    fontWeight="bold"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8' }}
                  />
                  <YAxis
                    fontSize={9}
                    fontWeight="bold"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8' }}
                  />
                  <Tooltip
                    labelFormatter={formatMonth}
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '11px',
                      fontWeight: 'bold',
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

        <div className="p-6 bg-white rounded-2xl border border-[#f1f5f9] shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-[#f1f5f9] pb-2 text-[#1e293b]">
            <FileText className="w-5 h-5 text-[#2563eb]" /> Distribuição por Comarca
          </h2>
          <BarList
            rows={stats?.judiciaisPorComarca ?? []}
            labelKey="comarca"
            total={stats?.totais.processosJudiciais ?? 0}
            barColor="bg-[#3b82f6]"
          />
        </div>

        <div className="p-6 bg-white rounded-2xl border border-[#f1f5f9] shadow-sm md:col-span-2">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-[#f1f5f9] pb-2 text-[#1e293b]">
            <AlertCircle className="w-5 h-5 text-[#2563eb]" /> Situação da Carteira Judicial
          </h2>
          <BarList
            rows={stats?.judiciaisPorSituacao ?? []}
            labelKey="situacao"
            total={stats?.totais.processosJudiciais ?? 0}
            barColor="bg-[#f59e0b]"
          />
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center text-[#94a3b8] italic border border-dashed border-[#e2e8f0] rounded-xl bg-[#f8fafc]/40">
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
    blue: 'text-[#2563eb] bg-[#eff6ff] border-[#dbeafe]',
    amber: 'text-[#b45309] bg-[#fffbeb] border-[#fef3c7]',
    emerald: 'text-[#047857] bg-[#ecfdf5] border-[#d1fae5]',
    purple: 'text-[#7c3aed] bg-[#f5f3ff] border-[#ede9fe]',
    red: 'text-[#b91c1c] bg-[#fef2f2] border-[#fecaca]',
  };
  return (
    <div className="p-6 bg-white rounded-2xl border border-[#f1f5f9] shadow-sm space-y-3 hover:shadow-md transition-all group">
      <div className="flex items-center justify-between">
        <div className={cn('p-2 rounded-xl border', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-[#64748b] uppercase tracking-wider">{title}</h3>
        <div className="text-2xl font-black mt-1 text-[#1e293b] group-hover:scale-105 transition-transform truncate">
          {currency ? formatCurrency(value) : value}
        </div>
      </div>
      <p className="text-xs text-[#94a3b8] font-medium">{description}</p>
    </div>
  );
}

type DemographicsCardProps = {
  title: string;
  data: Array<Record<string, any>>;
  dataKey: string;
  nameKey: string;
  palette: string[];
  donut?: boolean;
};

function DemographicsCard({ title, data, dataKey, nameKey, palette, donut }: DemographicsCardProps) {
  return (
    <div className="p-6 bg-white rounded-2xl border border-[#f1f5f9] shadow-sm flex flex-col h-[350px]">
      <h3 className="text-sm font-bold text-[#64748b] uppercase mb-4 tracking-wider">{title}</h3>
      <div className="flex-1">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={donut ? 60 : 0}
                outerRadius={donut ? 80 : 85}
                paddingAngle={donut ? 5 : 0}
                dataKey={dataKey}
                nameKey={nameKey}
                stroke={donut ? undefined : 'none'}
              >
                {data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  fontWeight: 'bold',
                  fontSize: '12px',
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }}
              />
            </PieChart>
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
  if (rows.length === 0) {
    return <p className="text-xs text-[#94a3b8] italic">Sem dados registrados.</p>;
  }
  return (
    <div className="space-y-4">
      {rows.map((r, i) => (
        <div key={`${r[labelKey]}-${i}`} className="space-y-1">
          <div className="flex justify-between text-xs font-bold uppercase text-[#64748b]">
            <span>{r[labelKey]}</span>
            <span>{r.total}</span>
          </div>
          <div className="h-2 w-full bg-[#f1f5f9] rounded-full overflow-hidden">
            <div
              className={cn('h-full', barColor)}
              style={{ width: `${total ? (r.total / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
