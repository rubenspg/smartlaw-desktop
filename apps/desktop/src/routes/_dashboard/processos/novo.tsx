import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Loader2, 
  Check, 
  AlertCircle,
  FileText,
  User as UserIcon,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDatajudSearch, useCreateProcessoJudicial } from '@/hooks/use-processos';
import { useClientes } from '@/hooks/use-clientes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatajudProcessData } from '@smartlaw/shared';

export const Route = createFileRoute('/_dashboard/processos/novo')({
  component: NewProcessoPage,
});

function NewProcessoPage() {
  const navigate = useNavigate();
  const [numero, setNumero] = useState('');
  const [step, setStep] = useState<'search' | 'confirm'>('search');
  const [processoData, setProcessoData] = useState<DatajudProcessData | null>(null);
  const [clienteId, setClienteId] = useState<string>('');
  
  const searchMutation = useDatajudSearch();
  const createMutation = useCreateProcessoJudicial();
  const { data: clientesData } = useClientes({ limit: 100 }); // Simple list for now

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero.trim()) return;

    try {
      const res = await searchMutation.mutateAsync(numero);
      const source = res.data.hits.hits[0]?._source;
      if (source) {
        setProcessoData(source);
        setStep('confirm');
      } else {
        alert('Processo não encontrado no Datajud.');
      }
    } catch (err) {
      console.error('Datajud search error:', err);
    }
  };

  const handleCreate = async () => {
    if (!clienteId || !processoData) return;

    try {
      const result = await createMutation.mutateAsync({
        clienteId: parseInt(clienteId),
        numero: processoData.numeroProcesso,
        juizo: processoData.orgaoJulgador?.nome,
        justica: processoData.tribunal,
        situacao: 'Ativo', // Default
        distribuicao: processoData.dataAjuizamento,
      });
      navigate({ to: '/processos/$id', params: { id: result.id.toString() } });
    } catch (err) {
      console.error('Creation error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate({ to: '/processos' })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Processo</h1>
          <p className="text-muted-foreground">Cadastre um processo judicial via Datajud.</p>
        </div>
      </div>

      <div className="max-w-3xl">
        {step === 'search' ? (
          <Card>
            <CardHeader>
              <CardTitle>Busca no Datajud</CardTitle>
              <CardDescription>Insira o número CNJ do processo para importar os dados automaticamente.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="numero">Número do Processo (CNJ)</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="numero" 
                      placeholder="0000000-00.0000.0.00.0000" 
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      required
                    />
                    <Button type="submit" disabled={searchMutation.isPending}>
                      {searchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                      Buscar
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="success" className="bg-green-500 hover:bg-green-600">
                    <Check className="w-3 h-3 mr-1" /> Encontrado no Datajud
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => setStep('search')}>Trocar Número</Button>
                </div>
                <CardTitle className="text-xl font-mono mt-2">{processoData?.numeroProcesso}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">Tribunal</p>
                  <p>{processoData?.tribunal || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">Órgão Julgador</p>
                  <p>{processoData?.orgaoJulgador?.nome || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">Data Ajuizamento</p>
                  <p>{processoData?.dataAjuizamento ? new Date(processoData.dataAjuizamento).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">Sistema</p>
                  <p>{processoData?.sistema?.nome || '-'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vincular a um Cliente</CardTitle>
                <CardDescription>Selecione o cliente responsável por este processo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="cliente">Cliente</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger id="cliente">
                      <SelectValue placeholder="Selecione um cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientesData?.data.map((c: any) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.nome} {c.cpfCnpj ? `(${c.cpfCnpj})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t pt-6">
                <Button onClick={handleCreate} disabled={!clienteId || createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Cadastrar e Vincular
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
