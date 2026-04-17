import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clienteSchema, ClienteInput, Cliente } from '@smartlaw/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface ClienteFormProps {
  initialData?: Cliente;
  onSubmit: (data: ClienteInput) => Promise<void>;
  isSubmitting: boolean;
}

export function ClienteForm({ initialData, onSubmit, isSubmitting }: ClienteFormProps) {
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: initialData ? {
      tipo: initialData.tipo as 'F' | 'J',
      nome: initialData.nome,
      fantasia: initialData.fantasia,
      cpfCnpj: initialData.cpfCnpj,
      rg: initialData.rg,
      email: initialData.email,
      celular: initialData.celular,
      telefone1: initialData.telefone1,
      endereco: initialData.endereco,
      endNumero: initialData.endNumero,
      bairro: initialData.bairro,
      municipio: initialData.municipio,
      estado: initialData.estado,
      situacao: initialData.situacao,
    } : {
      tipo: 'F',
      situacao: 'A',
    },
  });

  const tipo = watch('tipo');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Tipo de Pessoa</Label>
              <RadioGroup 
                defaultValue={tipo} 
                onValueChange={(val) => setValue('tipo', val as 'F' | 'J')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="F" id="pf" />
                  <Label htmlFor="pf" className="font-normal">Física</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="J" id="pj" />
                  <Label htmlFor="pj" className="font-normal">Jurídica</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="situacao">Situação</Label>
              <Select 
                defaultValue={initialData?.situacao || 'A'} 
                onValueChange={(val) => setValue('situacao', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Ativo</SelectItem>
                  <SelectItem value="I">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="nome">{tipo === 'F' ? 'Nome Completo' : 'Razão Social'}</Label>
              <Input id="nome" {...register('nome')} placeholder="Ex: João da Silva" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fantasia">Nome Fantasia / Apelido</Label>
              <Input id="fantasia" {...register('fantasia')} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="cpfCnpj">{tipo === 'F' ? 'CPF' : 'CNPJ'}</Label>
              <Input id="cpfCnpj" {...register('cpfCnpj')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rg">{tipo === 'F' ? 'RG' : 'Inscrição Estadual'}</Label>
              <Input id="rg" {...register('rg')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="celular">Celular / WhatsApp</Label>
              <Input id="celular" {...register('celular')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone1">Telefone Fixo</Label>
              <Input id="telefone1" {...register('telefone1')} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold">Endereço</h3>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="endereco">Logradouro</Label>
              <Input id="endereco" {...register('endereco')} placeholder="Rua, Avenida, etc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endNumero">Número</Label>
              <Input id="endNumero" {...register('endNumero')} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" {...register('bairro')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="municipio">Cidade</Label>
              <Input id="municipio" {...register('municipio')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado (UF)</Label>
              <Input id="estado" {...register('estado')} maxLength={2} placeholder="Ex: SP" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" type="button" onClick={() => window.history.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {initialData ? 'Salvar Alterações' : 'Cadastrar Cliente'}
        </Button>
      </div>
    </form>
  );
}

// Missing import for CardHeader
import { CardHeader } from '@/components/ui/card';
