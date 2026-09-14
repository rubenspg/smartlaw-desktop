/**
 * Popula as tabelas de lookup de processos (tipos de ação, ritos e
 * localizações) com os valores padrão, sem tocar em firms/profiles.
 *
 * Seguro de rodar em uma base existente: cada tabela só recebe os defaults
 * quando está vazia.
 *
 *   npm run seed:lookups
 */
import { ensureLookupDefaults } from '../apps/server/src/db/lookup-defaults';

ensureLookupDefaults()
  .then((inseridos) => {
    console.log(
      inseridos > 0
        ? `✅ Concluído: ${inseridos} registros inseridos.`
        : '✅ Nada a fazer: as tabelas já tinham registros.',
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Falha ao popular lookups:', err);
    process.exit(1);
  });
