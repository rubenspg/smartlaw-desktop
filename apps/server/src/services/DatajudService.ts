import { DatajudProcessData } from './ComparisonService';

export class DatajudService {
  static formatCnj(numero: string) {
    const clean = numero.replace(/\D/g, '');
    if (clean.length !== 20) return numero;
    return `${clean.substring(0, 7)}-${clean.substring(7, 9)}.${clean.substring(9, 13)}.${clean.substring(13, 14)}.${clean.substring(14, 16)}.${clean.substring(16, 20)}`;
  }

  static async fetchFromDatajud(numero: string): Promise<DatajudProcessData | null> {
    const cnjFormatado = this.formatCnj(numero);
    const numeroLimpo = cnjFormatado.replace(/\D/g, '');
    const parts = cnjFormatado.split('.');
    if (parts.length < 5) {
      throw new Error('Número CNJ inválido.');
    }

    const tribunalSet = parts[3];
    const justiceType = parts[2];
    let alias = 'api_publica_trf4';

    if (justiceType === '4') {
      alias = `api_publica_trf${parseInt(tribunalSet)}`;
    } else if (justiceType === '8') {
      const tjCode = tribunalSet.padStart(2, '0');
      alias = `api_publica_tj${tjCode.toLowerCase()}`;
    } else if (justiceType === '5') {
      alias = 'api_publica_tst';
    }

    const response = await fetch(`https://api-publica.datajud.cnj.jus.br/${alias}/_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${process.env.DATAJUD_API_KEY || ''}`
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: numeroLimpo } }
      })
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as any;
      throw new Error(errorData.error?.reason || `Erro do servidor Datajud (Status ${response.status})`);
    }

    const result = await response.json() as any;
    return result.hits?.hits[0]?._source || null;
  }
}
