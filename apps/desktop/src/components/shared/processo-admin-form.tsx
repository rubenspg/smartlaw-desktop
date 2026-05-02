import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { processoAdministrativoSchema, ProcessoAdministrativoInput, ProcessoAdministrativo } from '@smartlaw/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useClientes } from '@/hooks/use-clientes';
import { useEspeciesProcesso } from '@/hooks/use-lookups';
import { useRouter } from '@tanstack/react-router';

interface ProcessoAdminFormProps {
  initialData?: ProcessoAdministrativo;
  onSubmit: (data: ProcessoAdministrativoInput) => Promise<void>;
  isSubmitting: boolean;
}

export function ProcessoAdminForm({ initialData, onSubmit, isSubmitting }: ProcessoAdminFormProps) {
  const router = useRouter();
  const { register, handleSubmit, control, formState: { errors } } = useForm<ProcessoAdministrativoInput>({
    resolver: zodResolver(processoAdministrativoSchema),
    defaultValues: initialData ? {
      clienteId: initialData.clienteId || undefined,
      numero: initialData.numero,
      abertura: initialData.abertura,
      inicioBeneficio: initialData.inicioBeneficio,
      decisao: initialData.decisao,
      pasta: initialData.pasta,
      especieId: initialData.especieId,
    } : {},
  });

  const { data: clientesData } = useClientes({ limit: 100 });
  const { data: especies } = useEspeciesProcesso();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Informações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente Responsável</Label>
              <Controller
                name="clienteId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value?.toString()}
                    onValueChange={(val) => field.onChange(parseInt(val))}
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
                )}
              />
              {errors.clienteId && <p className="text-xs text-destructive">Selecione um cliente</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero">Número / Identificação</Label>
              <Input id="numero" {...register('numero')} placeholder="Ex: NB 123.456.789-0" />
              {errors.numero && <p className="text-xs text-destructive">{errors.numero.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="especie">Espécie do Processo</Label>
              <Controller
                name="especieId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="especie">
                      <SelectValue placeholder="Selecione a espécie..." />
                    </SelectTrigger>
                    <SelectContent>
                      {especies?.map((e: any) => (
                        <SelectItem key={e.codigo} value={e.codigo}>
                          {e.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pasta">Pasta / Referência</Label>
              <Input id="pasta" {...register('pasta')} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datas e Decisões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="abertura">Data de Abertura</Label>
              <Input id="abertura" type="date" {...register('abertura')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inicioBeneficio">Início do Benefício</Label>
              <Input id="inicioBeneficio" type="date" {...register('inicioBeneficio')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="decisao">Decisão / Status</Label>
              <Input id="decisao" {...register('decisao')} placeholder="Ex: Deferido, Indeferido..." />
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
