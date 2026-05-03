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
      const ufs: Record<string, string> = {
        '01': 'ac', '02': 'al', '03': 'ap', '04': 'am', '05': 'ba',
        '06': 'ce', '07': 'tjdft', '08': 'es', '09': 'go', '10': 'ma',
        '11': 'mt', '12': 'ms', '13': 'mg', '14': 'pa', '15': 'pb',
        '16': 'pr', '17': 'pe', '18': 'pi', '19': 'rj', '20': 'rn',
        '21': 'rs', '22': 'ro', '23': 'rr', '24': 'sc', '25': 'se',
        '26': 'sp', '27': 'to'
      };
      const uf = ufs[tribunalSet] || 'sp';
      alias = uf === 'tjdft' ? 'api_publica_tjdft' : `api_publica_tj${uf}`;
    } else if (justiceType === '5') {
      alias = `api_publica_trt${parseInt(tribunalSet)}`;
    } else if (justiceType === '1') {
      alias = 'api_publica_stf';
    } else if (justiceType === '2') {
      alias = 'api_publica_cnj';
    } else if (justiceType === '3') {
      alias = 'api_publica_stj';
    } else if (justiceType === '6') {
      alias = 'api_publica_tse';
    } else if (justiceType === '7') {
      alias = 'api_publica_stm';
    } else if (justiceType === '9') {
      throw new Error('Justiça Militar Estadual (tipo 9) não é suportada pelo Datajud público.');
    } else {
      throw new Error(`Tipo de justiça desconhecido: ${justiceType}. Verifique o número CNJ.`);
    }

    const apiKey = process.env.DATAJUD_API_KEY || '';
    const authHeader = apiKey.startsWith('APIKey') ? apiKey : `APIKey ${apiKey}`;

    const response = await fetch(`https://api-publica.datajud.cnj.jus.br/${alias}/_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
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
