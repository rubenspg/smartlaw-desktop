import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clienteSchema, ClienteInput, Cliente } from '@smartlaw/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { CheckCircle2, Loader2, Search, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from '@tanstack/react-router';

// ── Formatters ────────────────────────────────────────────────────────────────

function formatCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function formatCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function formatCelular(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function formatTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
}

function formatCEP(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatDateForInput(v: string | null | undefined) {
  if (!v) return '';
  // If it's already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // If it's ISO string
  try {
    const date = new Date(v);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

// ── Validators (for inline feedback) ─────────────────────────────────────────

function cpfComplete(v: string) { return v.replace(/\D/g, '').length === 11; }
function cnpjComplete(v: string) { return v.replace(/\D/g, '').length === 14; }
function celularComplete(v: string) { return v.replace(/\D/g, '').length === 11; }
function telefoneComplete(v: string) { return v.replace(/\D/g, '').length === 10; }

// ── Component ─────────────────────────────────────────────────────────────────

interface ClienteFormProps {
  initialData?: Cliente;
  onSubmit: (data: ClienteInput) => Promise<void>;
  isSubmitting: boolean;
}

export function ClienteForm({ initialData, onSubmit, isSubmitting }: ClienteFormProps) {
  const router = useRouter();
  const [isSearchingCEP, setIsSearchingCEP] = useState(false);
  const { register, handleSubmit, control, formState: { errors }, setValue, watch } = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: initialData ? {
      tipo: initialData.tipo as 'F' | 'J',
      nome: initialData.nome,
      fantasia: initialData.fantasia,
      cpfCnpj: initialData.cpfCnpj,
      rg: initialData.rg,
      nascimento: formatDateForInput(initialData.nascimento),
      sexo: initialData.sexo,
      estCivil: initialData.estCivil,
      profissao: initialData.profissao,
      email: initialData.email,
      celular: initialData.celular,
      telefone1: initialData.telefone1,
      telefone2: initialData.telefone2,
      endereco: initialData.endereco,
      endNumero: initialData.endNumero,
      complemento: initialData.complemento,
      bairro: initialData.bairro,
      municipio: initialData.municipio,
      estado: initialData.estado,
      cep: initialData.cep,
      nomePai: initialData.nomePai,
      nomeMae: initialData.nomeMae,
      nomeConjuge: initialData.nomeConjuge,
      observacoes: initialData.observacoes,
      situacao: initialData.situacao || 'A',
    } : {
      tipo: 'F',
      situacao: 'A',
    },
  });

  const handleCEPLookup = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setIsSearchingCEP(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setValue('endereco', data.logradouro, { shouldValidate: true });
        setValue('bairro', data.bairro, { shouldValidate: true });
        setValue('municipio', data.localidade, { shouldValidate: true });
        setValue('estado', data.uf, { shouldValidate: true });

        // Resolve IBGE → código interno do municipio (FK em clientes.municipio_codigo)
        let municipioCodigo: string | null = null;
        if (data.ibge) {
          try {
            const muniRes = await api.lookups.municipios['by-ibge'][':ibge'].$get({
              param: { ibge: data.ibge },
            });
            if (muniRes.ok) {
              const muni = await muniRes.json();
              municipioCodigo = (muni as { codigo: string }).codigo;
            }
          } catch (err) {
            console.error('Erro ao resolver código do município:', err);
          }
        }
        setValue('municipioCodigo', municipioCodigo, { shouldValidate: true });

        // Set focus to Number field after finding the address
        document.getElementById('endNumero')?.focus();
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setIsSearchingCEP(false);
    }
  };

  const tipo = watch('tipo');
  const cpfCnpjValue = watch('cpfCnpj') ?? '';
  const celularValue = watch('celular') ?? '';
  const telefoneValue = watch('telefone1') ?? '';

  const cpfCnpjDone = tipo === 'F' ? cpfComplete(cpfCnpjValue) : cnpjComplete(cpfCnpjValue);
  const celularDone = celularComplete(celularValue);
  const telefoneDone = telefoneComplete(telefoneValue);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold">Informações Básicas</h3>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Tipo de Pessoa</Label>
              <Controller
                name="tipo"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={(val) => field.onChange(val as 'F' | 'J')}
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
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="situacao">Situação</Label>
              <Controller
                name="situacao"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a situação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Ativo</SelectItem>
                      <SelectItem value="I">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="nome">{tipo === 'F' ? 'Nome Completo' : 'Razão Social'}</Label>
              <Input id="nome" {...register('nome')} placeholder="Ex: João da Silva" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fantasia">{tipo === 'F' ? 'Apelido' : 'Nome Fantasia'}</Label>
              <Input id="fantasia" {...register('fantasia')} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* CPF / CNPJ */}
            <div className="space-y-2">
              <Label htmlFor="cpfCnpj">{tipo === 'F' ? 'CPF' : 'CNPJ'}</Label>
              <div className="relative">
                <Controller
                  name="cpfCnpj"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="cpfCnpj"
                      placeholder={tipo === 'F' ? '000.000.000-00' : '00.000.000/0000-00'}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const formatted = tipo === 'F'
                          ? formatCPF(e.target.value)
                          : formatCNPJ(e.target.value);
                        field.onChange(formatted);
                      }}
                      className={cpfCnpjDone ? 'pr-8' : ''}
                    />
                  )}
                />
                {cpfCnpjValue.replace(/\D/g, '').length > 0 && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {cpfCnpjDone
                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-amber-400" />
                    }
                  </span>
                )}
              </div>
              {errors.cpfCnpj && <p className="text-xs text-destructive">{errors.cpfCnpj.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rg">{tipo === 'F' ? 'RG' : 'Inscrição Estadual'}</Label>
              <Input id="rg" {...register('rg')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...register('email')} placeholder="exemplo@email.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          {tipo === 'F' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nascimento">Data de Nascimento</Label>
                <Input id="nascimento" type="date" {...register('nascimento')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sexo">Sexo</Label>
                <Controller
                  name="sexo"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger id="sexo">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Feminino</SelectItem>
                        <SelectItem value="O">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estCivil">Estado Civil</Label>
                <Controller
                  name="estCivil"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger id="estCivil">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                        <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                        <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                        <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                        <SelectItem value="União Estável">União Estável</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profissao">Profissão</Label>
                <Input id="profissao" {...register('profissao')} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {tipo === 'F' && (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="text-lg font-semibold">Filiação e Cônjuge</h3>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nomeMae">Nome da Mãe</Label>
                <Input id="nomeMae" {...register('nomeMae')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nomePai">Nome do Pai</Label>
                <Input id="nomePai" {...register('nomePai')} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nomeConjuge">Nome do Cônjuge</Label>
                <Input id="nomeConjuge" {...register('nomeConjuge')} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold">Contato e Endereço</h3>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Celular */}
            <div className="space-y-2">
              <Label htmlFor="celular">Celular / WhatsApp</Label>
              <div className="relative">
                <Controller
                  name="celular"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="celular"
                      placeholder="(51) 99999-9999"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(formatCelular(e.target.value))}
                      className={celularDone ? 'pr-8' : ''}
                    />
                  )}
                />
                {celularValue.replace(/\D/g, '').length > 0 && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {celularDone
                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-amber-400" />
                    }
                  </span>
                )}
              </div>
              {errors.celular && <p className="text-xs text-destructive">{errors.celular.message}</p>}
            </div>

            {/* Telefone fixo 1 */}
            <div className="space-y-2">
              <Label htmlFor="telefone1">Telefone Fixo 1</Label>
              <div className="relative">
                <Controller
                  name="telefone1"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="telefone1"
                      placeholder="(51) 3333-3333"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(formatTelefone(e.target.value))}
                      className={telefoneDone ? 'pr-8' : ''}
                    />
                  )}
                />
                {telefoneValue.replace(/\D/g, '').length > 0 && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {telefoneDone
                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-amber-400" />
                    }
                  </span>
                )}
              </div>
              {errors.telefone1 && <p className="text-xs text-destructive">{errors.telefone1.message}</p>}
            </div>

            {/* Telefone fixo 2 */}
            <div className="space-y-2">
              <Label htmlFor="telefone2">Telefone Fixo 2</Label>
              <Controller
                name="telefone2"
                control={control}
                render={({ field }) => (
                  <Input
                    id="telefone2"
                    placeholder="(51) 3333-3333"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(formatTelefone(e.target.value))}
                  />
                )}
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <div className="relative">
                <Controller
                  name="cep"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="cep"
                      placeholder="00000-000"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(formatCEP(e.target.value))}
                      onBlur={(e) => {
                        field.onBlur();
                        handleCEPLookup(e.target.value);
                      }}
                      className="pr-8"
                    />
                  )}
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  {isSearchingCEP ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Search className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
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
              <Label htmlFor="complemento">Complemento</Label>
              <Input id="complemento" {...register('complemento')} placeholder="Apto, Sala, etc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" {...register('bairro')} />
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="municipio">Cidade</Label>
                  <Input id="municipio" {...register('municipio')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">UF</Label>
                  <Input id="estado" {...register('estado')} maxLength={2} placeholder="SP" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold">Observações</h3>
        </CardHeader>
        <CardContent>
          <Textarea 
            id="observacoes" 
            {...register('observacoes')} 
            placeholder="Informações adicionais sobre o cliente..."
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" type="button" onClick={() => router.history.back()}>
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

export default ClienteForm;
