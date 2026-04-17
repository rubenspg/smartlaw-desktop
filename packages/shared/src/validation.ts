import { z } from 'zod';

// Existing schemas...
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const clienteSchema = z.object({
  tipo: z.enum(['F', 'J']).default('F'),
  nome: z.string().min(1, 'Nome é obrigatório'),
  fantasia: z.string().optional().nullable(),
  cpfCnpj: z.string().optional().nullable(),
  rg: z.string().optional().nullable(),
  nascimento: z.string().optional().nullable(),
  sexo: z.string().optional().nullable(),
  estCivil: z.string().optional().nullable(),
  profissao: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  endNumero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  municipio: z.string().optional().nullable(),
  municipioCodigo: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  pais: z.string().optional().nullable(),
  telefone1: z.string().optional().nullable(),
  telefone2: z.string().optional().nullable(),
  celular: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  nomePai: z.string().optional().nullable(),
  nomeMae: z.string().optional().nullable(),
  nomeConjuge: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  situacao: z.string().default('A'),
  bloqueado: z.boolean().default(false),
});

export type ClienteInput = z.infer<typeof clienteSchema>;

export const clienteNotaSchema = z.object({
  clienteId: z.number(),
  texto: z.string().min(1, 'O texto da nota é obrigatório'),
});

export type ClienteNotaInput = z.infer<typeof clienteNotaSchema>;

export const processoJudicialSchema = z.object({
  clienteId: z.number(),
  numero: z.string().min(1, 'Número do processo é obrigatório'),
  distribuicao: z.string().optional().nullable(),
  juizo: z.string().optional().nullable(),
  justica: z.string().optional().nullable(),
  comarca: z.string().optional().nullable(),
  orgaoJulgador: z.string().optional().nullable(),
  recurso: z.string().optional().nullable(),
  situacao: z.string().optional().nullable(),
  pasta: z.string().optional().nullable(),
  ritoId: z.string().optional().nullable(),
  tipoAcaoId: z.string().optional().nullable(),
  localizacaoId: z.string().optional().nullable(),
});

export type ProcessoJudicialInput = z.infer<typeof processoJudicialSchema>;

export const processoAdministrativoSchema = z.object({
  clienteId: z.number(),
  numero: z.string().min(1, 'Número ou Identificação é obrigatório'),
  dataCadastro: z.string().optional().nullable(),
  abertura: z.string().optional().nullable(),
  inicioBeneficio: z.string().optional().nullable(),
  decisao: z.string().optional().nullable(),
  pasta: z.string().optional().nullable(),
  especieId: z.string().optional().nullable(),
});

export type ProcessoAdministrativoInput = z.infer<typeof processoAdministrativoSchema>;

export const honorarioSchema = z.object({
  clienteId: z.number(),
  processoJudicialId: z.number().optional().nullable(),
  processoAdminId: z.number().optional().nullable(),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  valor: z.string().min(1, 'Valor é obrigatório'),
  valorPago: z.string().optional().nullable(),
  dataVenc: z.string().min(1, 'Vencimento é obrigatório'),
  dataPagto: z.string().optional().nullable(),
  status: z.enum(['PENDENTE', 'PAGO', 'CANCELADO']).default('PENDENTE'),
  tipo: z.string().default('HONORARIO'),
  observacoes: z.string().optional().nullable(),
});

export type HonorarioInput = z.infer<typeof honorarioSchema>;
