import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  ArrowLeft,
  Search,
  Loader2,
  Check,
  AlertCircle,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDatajudSearch, useCreateProcessoJudicial, useSyncProcesso } from '@/hooks/use-processos';
import { useClientes } from '@/hooks/use-clientes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProcessoJudicialInput } from '@smartlaw/shared';
import type { DatajudBusca } from '@/lib/entities';
import { ProcessoJudicialForm } from '@/components/shared/processo-judicial-form';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_dashboard/processos/novo')({
  component: NewProcessoPage,
});

const GRAU_LABEL: Record<string, string> = {
  G1: '1º grau',
  G2: '2º grau',
  G3: 'Superior',
  JE: 'Juizado Especial',
  TR: 'Turma Recursal',
  SUP: 'Superior',
};

function NewProcessoPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [numero, setNumero] = useState('');
  const [step, setStep] = useState<'search' | 'confirm' | 'manual'>('search');
  const [busca, setBusca] = useState<DatajudBusca | null>(null);
  const [clienteId, setClienteId] = useState<string>('');
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchMutation = useDatajudSearch();
  const createMutation = useCreateProcessoJudicial();
  const syncMutation = useSyncProcesso();
  const { data: clientesData } = useClientes({ limit: 100 }); // Simple list for now

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero.trim()) return;

    setNotFound(false);
    setError(null);

    try {
      const res = await searchMutation.mutateAsync(numero);
      if (res.encontrado) {
        setBusca(res);
        setStep('confirm');
      } else {
        setNotFound(true);
      }
    } catch (err: any) {
      console.error('Datajud search error:', err);
      setError(err.message || 'Ocorreu um erro ao buscar o processo. Verifique sua conexão e a chave da API.');
    }
  };

  const handleCreate = async (data?: ProcessoJudicialInput) => {
    const input = data || (busca ? {
      clienteId: parseInt(clienteId),
      // Guardado com a máscara CNJ, como o restante do cadastro do escritório.
      numero: busca.numeroFormatado,
      juizo: busca.sugestao?.juizo,
      orgaoJulgador: busca.sugestao?.orgaoJulgador,
      justica: busca.sugestao?.justica,
      comarca: busca.sugestao?.comarca,
      situacao: busca.sugestao?.situacao ?? 'ATIVO',
      distribuicao: busca.sugestao?.distribuicao,
    } : null);

    if (!input) return;

    try {
      const result = await createMutation.mutateAsync(input);
      // Vindo do Datajud, já traz instâncias e movimentos para dentro; se
      // falhar, o processo existe e o botão "Sincronizar" resolve depois.
      if (!data && busca) {
        try {
          const sync = await syncMutation.mutateAsync(result.id);
          toast.success(`Processo cadastrado com ${sync.newMovements} andamentos do tribunal.`);
        } catch (err: any) {
          toast.error(`Processo cadastrado, mas a sincronização falhou: ${err.message}`);
        }
      }
      navigate({ to: '/processos/$id', params: { id: result.id.toString() } });
    } catch (err) {
      console.error('Creation error:', err);
    }
  };

  const isCreating = createMutation.isPending || syncMutation.isPending;
  const origem = busca?.instancias[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => step === 'manual' ? setStep('search') : navigate({ to: '/processos' })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{step === 'manual' ? 'Cadastro Manual' : 'Novo Processo'}</h1>
          <p className="text-muted-foreground">{step === 'manual' ? 'Preencha todos os campos do processo judicial.' : 'Cadastre um processo judicial via Datajud.'}</p>
        </div>
      </div>

      <div className={cn("max-w-3xl", step === 'manual' && "max-w-4xl")}>
        {step === 'manual' ? (
          <ProcessoJudicialForm
            onSubmit={handleCreate}
            isSubmitting={createMutation.isPending}
          />
        ) : step === 'search' ? (
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
                {notFound && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Processo não encontrado no Datajud.
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}
              </form>
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground mb-4 text-center">Ou, se preferir, cadastre os dados manualmente.</p>
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setStep('manual')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Cadastrar Manualmente
                  </Button>
                </div>
              </div>
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
                <CardTitle className="text-xl font-mono mt-2">{busca?.numeroFormatado}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Tribunal</p>
                    <p>{origem?.tribunal || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Classe</p>
                    <p>{origem?.classe || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Órgão de origem</p>
                    <p>{origem?.orgaoJulgador || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Data de ajuizamento</p>
                    <p>{origem?.dataAjuizamento ? new Date(origem.dataAjuizamento).toLocaleDateString('pt-BR') : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Sistema</p>
                    <p>{origem?.sistema || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Situação sugerida</p>
                    <p>{busca?.sugestao?.situacao || '-'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">
                    Instâncias no tribunal ({busca?.instancias.length})
                  </p>
                  <div className="space-y-2">
                    {busca?.instancias.map((i) => (
                      <div key={i.docId} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/60 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="shrink-0 font-bold">{i.grau} · {GRAU_LABEL[i.grau ?? ''] ?? i.grau}</Badge>
                          <span className="truncate text-xs text-muted-foreground">{i.orgaoJulgador}</span>
                        </div>
                        <div className="shrink-0 text-right text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{i.totalMovimentos}</span> movimentos
                          {i.ultimoMovimento && (
                            <span> · último em {new Date(i.ultimoMovimento.dataHora).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
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
                <Button onClick={() => handleCreate()} disabled={!clienteId || isCreating}>
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {syncMutation.isPending ? 'Importando andamentos…' : 'Cadastrar e Vincular'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
