import { createFileRoute, Link } from '@tanstack/react-router';
import { 
  Clock, 
  ExternalLink, 
  Calendar, 
  Plus, 
  ClipboardCheck,
  CheckCircle2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/_dashboard/')({
  component: HomeComponent,
});

const andamentos = [
  {
    tipo: 'ADMIN',
    numero: '#138.206.450-8',
    cliente: 'EUGENIO MARCA',
    descricao: 'ANÁLISE CONCLUIDA. AGUARDA EXPOR PARECER PARA O CLIENTE.',
    data: '13/02/2088',
    hora: '19:00:00',
    color: 'bg-green-100 text-green-700 hover:bg-green-100'
  },
  {
    tipo: 'JUDICIAL',
    numero: '#090/1.11.0002744-4',
    cliente: 'CRISTIANE BRUSTOLIN LOPES',
    descricao: 'DR MAURICIO LEVOU O CHEQUE PARA DEPOSITAR NO BANCO DO BRASIL. VAI SER FEITA NOTA NOS PRÓXIMOS DIAS.',
    data: '26/03/2026',
    hora: '20:00:00',
    color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
  },
  {
    tipo: 'JUDICIAL',
    numero: '#5001649-63.2020.4.04.7113',
    cliente: 'LUCAS RODRIGUES PINTO',
    descricao: 'CLIENTE VEIO RECEBER ALVARA, DINHEIRO ENTROU DIA 19 MARÇO, JÁ TIREI NOTA FISCAL',
    data: '26/03/2026',
    hora: '20:00:00',
    color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
  },
  {
    tipo: 'ADMIN',
    numero: '#',
    cliente: 'LORENA MARIA DE GODOIS DE ALMEIDA',
    descricao: 'CRIADO E-MAIL IVANIADEMARCO593@GMAIL.COM. MESMA SENHA GOV',
    data: '26/03/2026',
    hora: '20:00:00',
    color: 'bg-green-100 text-green-700 hover:bg-green-100'
  }
];

function HomeComponent() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-[#1e293b]">Início</h1>
        <p className="text-[#64748b] text-lg mt-1">Bem-vindo de volta. Veja o que há de novo hoje.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Andamentos Recentes */}
        <div className="lg:col-span-2">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#2563eb]" />
                <CardTitle className="text-xl font-bold text-[#1e293b]">Andamentos Recentes</CardTitle>
              </div>
              <Link to="/processos" className="text-xs font-bold text-[#2563eb] hover:underline">
                VER TODOS
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[#f1f5f9]">
                {andamentos.map((andamento, index) => (
                  <div key={index} className="p-6 hover:bg-[#f8fafc] transition-colors relative group">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge className={`${andamento.color} border-none px-2 py-0.5 text-[10px] font-bold`}>
                            {andamento.tipo}
                          </Badge>
                          <span className="text-xs text-[#94a3b8] font-medium">{andamento.numero}</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-[#1e293b]">{andamento.cliente}</h3>
                          <p className="text-sm text-[#64748b] italic mt-1 font-medium">
                            "{andamento.descricao}"
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{andamento.data}, {andamento.hora}</span>
                        </div>
                      </div>
                      <button className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#e2e8f0] text-[#64748b] hover:bg-white hover:text-[#2563eb] transition-all shadow-sm text-xs font-semibold">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-8">
          {/* Tarefas */}
          <Card className="border-none shadow-sm min-h-[400px] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#2563eb]" />
                <CardTitle className="text-xl font-bold text-[#1e293b]">Tarefas</CardTitle>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-[#2563eb] text-white hover:bg-[#1d4ed8] hover:text-white">
                <Plus className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="w-16 h-16 rounded-2xl bg-[#f1f5f9] flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-[#cbd5e1]" />
              </div>
              <p className="text-[#64748b] font-medium">Sem tarefas pendentes hoje.</p>
            </CardContent>
          </Card>

          {/* Dica do Dia */}
          <Card className="border-none shadow-sm bg-[#eff6ff]">
            <CardContent className="p-6 space-y-3">
              <h4 className="text-[10px] font-black text-[#2563eb] tracking-wider uppercase">DICA DO DIA</h4>
              <p className="text-sm text-[#1e3a8a] italic font-medium leading-relaxed">
                "Mantenha os cadastros de clientes sempre atualizados para garantir a agilidade nas consultas ao Datajud."
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
