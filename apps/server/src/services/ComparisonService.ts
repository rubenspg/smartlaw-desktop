import type { DatajudProcessData } from '@smartlaw/shared';

export type { DatajudProcessData };

export interface DriftResult {
  hasDrift: boolean;
  fields: Array<{
    field: string;
    local: any;
    remote: any;
  }>;
  newMovements: number;
}

export class ComparisonService {
  /**
   * Compara um processo local com os dados brutos do Datajud
   */
  static checkDrift(local: any, remote: DatajudProcessData): DriftResult {
    const fields: DriftResult['fields'] = [];
    let newMovements = 0;

    // 1. Compara Juízo/Órgão Julgador
    const remoteJuizo = remote.orgaoJulgador?.nome;
    const localJuizo = local.juizo || local.orgaoJulgador;
    if (remoteJuizo && localJuizo !== remoteJuizo) {
      fields.push({
        field: 'juizo',
        local: localJuizo,
        remote: remoteJuizo
      });
    }

    // 2. Compara Tribunal/Justiça
    const remoteJustica = remote.tribunal;
    const localJustica = local.justica;
    if (remoteJustica && localJustica !== remoteJustica) {
      fields.push({
        field: 'justica',
        local: localJustica,
        remote: remoteJustica
      });
    }

    // 3. Compara Movimentações
    const localAndamentosDatajud = local.andamentos?.filter((a: any) => a.tipo === 'DATAJUD' || a.tipo === 'SISTEMA') || [];
    const remoteMovimentos = remote.movimentos || [];

    if (remoteMovimentos.length > localAndamentosDatajud.length) {
      newMovements = remoteMovimentos.length - localAndamentosDatajud.length;
      fields.push({
        field: 'andamentos',
        local: localAndamentosDatajud.length,
        remote: remoteMovimentos.length
      });
    }

    return {
      hasDrift: fields.length > 0,
      fields,
      newMovements
    };
  }
}
