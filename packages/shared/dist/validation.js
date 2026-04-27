import { z } from 'zod';
function validateCPF(value) {
    const d = value.replace(/\D/g, '');
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d))
        return false;
    let sum = 0;
    for (let i = 0; i < 9; i++)
        sum += parseInt(d[i]) * (10 - i);
    let rem = (sum * 10) % 11;
    if (rem >= 10)
        rem = 0;
    if (rem !== parseInt(d[9]))
        return false;
    sum = 0;
    for (let i = 0; i < 10; i++)
        sum += parseInt(d[i]) * (11 - i);
    rem = (sum * 10) % 11;
    if (rem >= 10)
        rem = 0;
    return rem === parseInt(d[10]);
}
function validateCNPJ(value) {
    const d = value.replace(/\D/g, '');
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d))
        return false;
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = w1.reduce((acc, w, i) => acc + parseInt(d[i]) * w, 0);
    let rem = sum % 11;
    if ((rem < 2 ? 0 : 11 - rem) !== parseInt(d[12]))
        return false;
    sum = w2.reduce((acc, w, i) => acc + parseInt(d[i]) * w, 0);
    rem = sum % 11;
    return (rem < 2 ? 0 : 11 - rem) === parseInt(d[13]);
}
// Existing schemas...
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});
export const clienteSchema = z.object({
    tipo: z.enum(['F', 'J']),
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
    situacao: z.string().optional(),
    bloqueado: z.boolean().optional(),
}).superRefine((data, ctx) => {
    if (data.cpfCnpj) {
        const digits = data.cpfCnpj.replace(/\D/g, '');
        if (data.tipo === 'F') {
            if (digits.length > 0 && digits.length !== 11) {
                ctx.addIssue({ code: 'custom', path: ['cpfCnpj'], message: 'CPF deve ter 11 dígitos' });
            }
            else if (digits.length === 11 && !validateCPF(data.cpfCnpj)) {
                ctx.addIssue({ code: 'custom', path: ['cpfCnpj'], message: 'CPF inválido' });
            }
        }
        else {
            if (digits.length > 0 && digits.length !== 14) {
                ctx.addIssue({ code: 'custom', path: ['cpfCnpj'], message: 'CNPJ deve ter 14 dígitos' });
            }
            else if (digits.length === 14 && !validateCNPJ(data.cpfCnpj)) {
                ctx.addIssue({ code: 'custom', path: ['cpfCnpj'], message: 'CNPJ inválido' });
            }
        }
    }
    if (data.celular) {
        const digits = data.celular.replace(/\D/g, '');
        if (digits.length > 0 && digits.length !== 11) {
            ctx.addIssue({ code: 'custom', path: ['celular'], message: 'Celular deve ter DDD + 9 dígitos. Ex: (51) 99999-9999' });
        }
    }
    if (data.telefone1) {
        const digits = data.telefone1.replace(/\D/g, '');
        if (digits.length > 0 && digits.length !== 10) {
            ctx.addIssue({ code: 'custom', path: ['telefone1'], message: 'Telefone deve ter DDD + 8 dígitos. Ex: (51) 3333-3333' });
        }
    }
});
export const clienteNotaSchema = z.object({
    clienteId: z.number().min(1, 'Cliente é obrigatório'),
    texto: z.string().min(1, 'O texto da nota é obrigatório'),
});
export const processoJudicialSchema = z.object({
    clienteId: z.number().min(1, 'Cliente é obrigatório'),
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
export const processoAdministrativoSchema = z.object({
    clienteId: z.number().min(1, 'Cliente é obrigatório'),
    numero: z.string().min(1, 'Número ou Identificação é obrigatório'),
    dataCadastro: z.string().optional().nullable(),
    abertura: z.string().optional().nullable(),
    inicioBeneficio: z.string().optional().nullable(),
    decisao: z.string().optional().nullable(),
    pasta: z.string().optional().nullable(),
    especieId: z.string().optional().nullable(),
});
export const honorarioSchema = z.object({
    clienteId: z.number().min(1, 'Cliente é obrigatório'),
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
export const usuarioSchema = z.object({
    nome: z.string().min(1, 'Nome é obrigatório'),
    email: z.string().email('E-mail inválido'),
    senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    perfil: z.enum(['admin', 'usuario', 'secretaria']).default('usuario'),
});
export const usuarioUpdateSchema = z.object({
    nome: z.string().min(1).optional(),
    perfil: z.enum(['admin', 'usuario', 'secretaria']).optional(),
    ativo: z.boolean().optional(),
});
export const tarefaSchema = z.object({
    usuarioId: z.string().uuid('Usuário inválido'),
    clienteId: z.number().optional().nullable(),
    processoJudicialId: z.number().optional().nullable(),
    processoAdminId: z.number().optional().nullable(),
    titulo: z.string().min(1, 'Título é obrigatório'),
    descricao: z.string().optional().nullable(),
    dataLimite: z.string().optional().nullable(),
    prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA']),
    status: z.enum(['PENDENTE', 'CONCLUIDA', 'CANCELADA']),
});
