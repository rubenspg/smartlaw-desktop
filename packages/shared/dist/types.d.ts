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
    classe?: {
        nome: string;
    };
    sistema?: {
        nome: string;
    };
    formato?: {
        nome: string;
    };
    tribunal?: string;
    dataAjuizamento?: string;
    orgaoJulgador?: {
        nome: string;
        codigo?: string;
    };
    movimentos?: Array<{
        nome: string;
        dataHora: string;
        complementosTabelados?: Array<{
            nome: string;
            valor?: string;
        }>;
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
//# sourceMappingURL=types.d.ts.map