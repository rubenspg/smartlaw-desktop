export interface User {
  id: string;
  email: string;
  nome: string;
  perfil: string;
  firmId: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface Profile {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  firmId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Tarefa {
  id: number;
  firmId: string | null;
  usuarioId: string;
  clienteId: number | null;
  processoJudicialId: number | null;
  processoAdminId: number | null;
  titulo: string;
  descricao: string | null;
  dataLimite: string | null;
  prioridade: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  usuario: {
    id: string;
    nome: string;
    email: string;
  } | null;
  cliente: {
    id: number;
    nome: string;
  } | null;
}

export interface Cliente {
  id: number;
  firmId: string | null;
  tipo: string;
  nome: string;
  fantasia: string | null;
  cpfCnpj: string | null;
  rg: string | null;
  nascimento: string | null;
  sexo: string | null;
  estCivil: string | null;
  profissao: string | null;
  endereco: string | null;
  endNumero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  municipioCodigo: string | null;
  cep: string | null;
  estado: string | null;
  pais: string | null;
  telefone1: string | null;
  telefone2: string | null;
  celular: string | null;
  email: string | null;
  nomePai: string | null;
  nomeMae: string | null;
  nomeConjuge: string | null;
  observacoes: string | null;
  situacao: string | null;
  bloqueado: boolean | null;
  dataCadastro: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProcessoJudicial {
  id: number;
  firmId: string | null;
  clienteId: number | null;
  numero: string;
  dataCadastro: string | null;
  distribuicao: string | null;
  juizo: string | null;
  justica: string | null;
  comarca: string | null;
  orgaoJulgador: string | null;
  recurso: string | null;
  situacao: string | null;
  pasta: string | null;
  ritoId: string | null;
  tipoAcaoId: string | null;
  localizacaoId: string | null;
  lastSync: string | null;
  syncStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  cliente: Cliente | null;
  andamentos?: any[];
  partes?: any[];
}

export interface ProcessoAdministrativo {
  id: number;
  firmId: string | null;
  clienteId: number | null;
  numero: string;
  dataCadastro: string | null;
  abertura: string | null;
  inicioBeneficio: string | null;
  decisao: string | null;
  pasta: string | null;
  especieId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  cliente?: Cliente;
}

export interface DatajudProcessData {
  numeroProcesso: string;
  classe?: { nome: string };
  sistema?: { nome: string };
  formato?: { nome: string };
  tribunal?: string;
  dataAjuizamento?: string;
  orgaoJulgador?: { nome: string; codigo?: string };
  movimentos?: Array<{
    nome: string;
    dataHora: string;
    complementosTabelados?: Array<{ nome: string; valor?: string }>;
  }>;
}

export interface DriftResult {
  hasDrift: boolean;
  fields: Array<{
    field: string;
    local: any;
    remote: any;
  }>;
  newMovements: number;
}

export interface DashboardStats {
  totais: {
    clientes: number;
    processosJudiciais: number;
    processosAdministrativos: number;
  };
  aquisicaoClientes: Array<{ mes: string; total: number }>;
  demografia: {
    idade: Array<{ faixa: string; total: number }>;
    cidades: Array<{ cidade: string; total: number }>;
    profissoes: Array<{ profissao: string; total: number }>;
  };
  judiciaisPorComarca: Array<{ comarca: string; total: number }>;
  judiciaisPorSituacao: Array<{ situacao: string; total: number }>;
  financeiro: {
    mensais: Array<{ mes: string; recebido: number; pendente: number; atrasado: number }>;
    totalRecebido: number;
    totalPendente: number;
    totalAtrasado: number;
  };
  tarefas: {
    total: number;
    atrasadas: number;
    porPrioridade: Array<{ prioridade: string; total: number }>;
    porStatus: Array<{ status: string; total: number }>;
  };
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: string | null;
  ativo: boolean | null;
  firmId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AuditLog {
  id: number;
  tableName: string;
  recordId: string;
  action: string;
  oldData: any;
  newData: any;
  userId: string | null;
  firmId: string | null;
  createdAt: string | null;
  usuario: { id: string; nome: string } | null;
}

export interface AndamentoRecente {
  id: number;
  historico: string | null;
  tipo: string | null;
  inclusao: string;
  data: string;
  processoJudicialId: number | null;
  processoAdminId: number | null;
  processoJudicial: { id: number; numero: string; cliente: { id: number; nome: string } | null } | null;
  processoAdmin: { id: number; numero: string; cliente: { id: number; nome: string } | null } | null;
}

export interface Honorario {
  id: number;
  firmId: string | null;
  clienteId: number | null;
  processoJudicialId: number | null;
  processoAdminId: number | null;
  descricao: string;
  valor: string;
  valorPago: string | null;
  dataVenc: string;
  dataPagto: string | null;
  status: string | null;
  tipo: string | null;
  observacoes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  cliente: { id: number; nome: string } | null;
}

export interface HonorarioSummary {
  totalRecebido: number;
  totalPendente: number;
  totalAtrasado: number;
}

