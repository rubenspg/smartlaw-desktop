import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { processoJudicialSchema, ProcessoJudicialInput } from '@smartlaw/shared';
import { ProcessoJudicial } from '@/lib/entities';
import { useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useClientes } from '@/hooks/use-clientes';
import { useTiposAcao, useRitosProcessuais, useLocalizacoesProcesso } from '@/hooks/use-lookups';

interface ProcessoJudicialFormProps {
  initialData?: ProcessoJudicial;
  onSubmit: (data: ProcessoJudicialInput) => Promise<void>;
  isSubmitting: boolean;
}

export function ProcessoJudicialForm({ initialData, onSubmit, isSubmitting }: ProcessoJudicialFormProps) {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ProcessoJudicialInput>({
    resolver: zodResolver(processoJudicialSchema),
    defaultValues: initialData ? {
      clienteId: initialData.clienteId || 0,
      numero: initialData.numero,
      distribuicao: initialData.distribuicao ? new Date(initialData.distribuicao).toISOString().split('T')[0] : null,
      juizo: initialData.juizo,
      justica: initialData.justica,
      comarca: initialData.comarca,
      orgaoJulgador: initialData.orgaoJulgador,
      recurso: initialData.recurso,
      situacao: initialData.situacao,
      pasta: initialData.pasta,
      ritoId: initialData.ritoId,
      tipoAcaoId: initialData.tipoAcaoId,
      localizacaoId: initialData.localizacaoId,
    } : {
      clienteId: 0,
    },
  });

  const { data: clientesData } = useClientes({ limit: 100 });
  const { data: tiposAcao } = useTiposAcao();
  const { data: ritos } = useRitosProcessuais();
  const { data: localizacoes } = useLocalizacoesProcesso();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente Responsável</Label>
              <Select 
                defaultValue={initialData?.clienteId?.toString()} 
                onValueChange={(val) => setValue('clienteId', parseInt(val))}
              >
                <SelectTrigger id="cliente">
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clientesData?.data.map((c: any) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.clienteId && <p className="text-xs text-destructive">Selecione um cliente</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero">Número do Processo (CNJ)</Label>
              <Input id="numero" {...register('numero')} placeholder="0000000-00.0000.0.00.0000" />
              {errors.numero && <p className="text-xs text-destructive">{errors.numero.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados Processuais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tipoAcaoId">Tipo de Ação</Label>
              <Select 
                defaultValue={initialData?.tipoAcaoId || undefined} 
                onValueChange={(val) => setValue('tipoAcaoId', val)}
              >
                <SelectTrigger id="tipoAcaoId">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {tiposAcao?.map((t: any) => (
                    <SelectItem key={t.codigo} value={t.codigo}>
                      {t.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ritoId">Rito</Label>
              <Select 
                defaultValue={initialData?.ritoId || undefined} 
                onValueChange={(val) => setValue('ritoId', val)}
              >
                <SelectTrigger id="ritoId">
                  <SelectValue placeholder="Selecione o rito..." />
                </SelectTrigger>
                <SelectContent>
                  {ritos?.map((r: any) => (
                    <SelectItem key={r.codigo} value={r.codigo}>
                      {r.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="distribuicao">Data de Distribuição</Label>
              <Input id="distribuicao" type="date" {...register('distribuicao')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pasta">Pasta / Referência Interna</Label>
              <Input id="pasta" {...register('pasta')} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
              <Label htmlFor="justica">Justiça / Tribunal</Label>
              <Input id="justica" {...register('justica')} placeholder="Ex: TJSP, TRF4..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comarca">Comarca / Cidade</Label>
              <Input id="comarca" {...register('comarca')} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="juizo">Juízo / Vara</Label>
              <Input id="juizo" {...register('juizo')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgaoJulgador">Órgão Julgador</Label>
              <Input id="orgaoJulgador" {...register('orgaoJulgador')} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="localizacaoId">Localização Atual</Label>
              <Select 
                defaultValue={initialData?.localizacaoId || undefined} 
                onValueChange={(val) => setValue('localizacaoId', val)}
              >
                <SelectTrigger id="localizacaoId">
                  <SelectValue placeholder="Selecione a localização..." />
                </SelectTrigger>
                <SelectContent>
                  {localizacoes?.map((l: any) => (
                    <SelectItem key={l.codigo} value={l.codigo}>
                      {l.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="situacao">Situação Atual</Label>
              <Input id="situacao" {...register('situacao')} placeholder="Ex: Ativo, Suspenso..." />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" type="button" onClick={() => router.history.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {initialData ? 'Salvar Alterações' : 'Cadastrar Processo'}
        </Button>
      </div>
    </form>
  );
}
