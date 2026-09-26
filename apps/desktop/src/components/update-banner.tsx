import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Download, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EVENTO_APP_DESATUALIZADO } from '@/lib/api';

/** Com o app aberto o dia todo, procura de novo a cada 6 horas. */
const INTERVALO_VERIFICACAO_MS = 6 * 60 * 60 * 1000;

const PAGINA_RELEASES = 'https://github.com/rubenspg/smartlaw-desktop/releases/latest';

type Estado =
  | { fase: 'ocioso' }
  | { fase: 'disponivel'; update: Update }
  | { fase: 'baixando'; update: Update; baixado: number; total: number | null }
  | { fase: 'reiniciando' }
  | { fase: 'erro'; update: Update; mensagem: string };

/**
 * Aviso de nova versão, no estilo "Atualizar e reiniciar" do VS Code.
 *
 * O atualizador lê `latest.json` da última release publicada no GitHub
 * (tauri.conf.json → plugins.updater). Releases em rascunho não contam, então
 * nada chega aos usuários antes de alguém publicar a release.
 *
 * Normalmente é um cartão discreto que pode ser adiado. Quando a API responde
 * 426 (versão abaixo da mínima), vira uma tela que bloqueia o app: seguir
 * usando uma versão que o servidor já não entende só produziria erros.
 */
export function UpdateBanner() {
  const [estado, setEstado] = useState<Estado>({ fase: 'ocioso' });
  const [obrigatoria, setObrigatoria] = useState(false);
  const [adiada, setAdiada] = useState<string | null>(null);
  const verificando = useRef(false);

  const verificar = useCallback(async () => {
    if (!isTauri() || import.meta.env.DEV || verificando.current) return;
    verificando.current = true;
    try {
      const update = await check();
      if (update) {
        setEstado((atual) =>
          atual.fase === 'ocioso' || atual.fase === 'disponivel'
            ? { fase: 'disponivel', update }
            : atual,
        );
      }
    } catch (err) {
      // Sem rede ou GitHub fora do ar: tenta de novo no próximo ciclo.
      console.error('Falha ao verificar atualizações:', err);
    } finally {
      verificando.current = false;
    }
  }, []);

  useEffect(() => {
    verificar();
    const timer = setInterval(verificar, INTERVALO_VERIFICACAO_MS);
    return () => clearInterval(timer);
  }, [verificar]);

  useEffect(() => {
    const aoRecusar = () => {
      setObrigatoria(true);
      verificar();
    };
    window.addEventListener(EVENTO_APP_DESATUALIZADO, aoRecusar);
    return () => window.removeEventListener(EVENTO_APP_DESATUALIZADO, aoRecusar);
  }, [verificar]);

  const atualizar = async (update: Update) => {
    setEstado({ fase: 'baixando', update, baixado: 0, total: null });
    try {
      let baixado = 0;
      await update.downloadAndInstall((evento) => {
        if (evento.event === 'Started') {
          setEstado({ fase: 'baixando', update, baixado: 0, total: evento.data.contentLength ?? null });
        } else if (evento.event === 'Progress') {
          baixado += evento.data.chunkLength;
          setEstado((atual) => (atual.fase === 'baixando' ? { ...atual, baixado } : atual));
        }
      });
      // No Windows o instalador fecha o app sozinho e esta linha não chega a rodar.
      setEstado({ fase: 'reiniciando' });
      await relaunch();
    } catch (err) {
      console.error('Falha ao instalar atualização:', err);
      setEstado({
        fase: 'erro',
        update,
        mensagem: 'Não foi possível baixar a atualização. Verifique a conexão e tente de novo.',
      });
    }
  };

  const baixarManualmente = () => openUrl(PAGINA_RELEASES);

  if (obrigatoria) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur-sm p-6">
        <div className="max-w-md w-full rounded-2xl border bg-card p-8 shadow-premium text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Download className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Atualização obrigatória</h2>
          <p className="text-sm text-muted-foreground">
            Esta versão do SmartLaw ({__APP_VERSION__}) não é mais compatível com o servidor.
            Atualize para continuar usando o sistema.
          </p>
          <ConteudoAcao
            estado={estado}
            onAtualizar={atualizar}
            onBaixarManualmente={baixarManualmente}
          />
        </div>
      </div>
    );
  }

  if (estado.fase === 'ocioso') return null;
  if (estado.fase === 'disponivel' && adiada === estado.update.version) return null;

  const versao = estado.fase === 'reiniciando' ? null : estado.update.version;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm rounded-xl border bg-card px-4 py-3 shadow-premium animate-fade-in-up"
    >
      <div className="flex items-start gap-3">
        <Download className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {versao ? `Nova versão ${versao} disponível` : 'Reiniciando o SmartLaw…'}
          </p>
          <ConteudoAcao
            estado={estado}
            onAtualizar={atualizar}
            onBaixarManualmente={baixarManualmente}
          />
        </div>
        {estado.fase === 'disponivel' && (
          <button
            onClick={() => setAdiada(estado.update.version)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Depois"
            title="Depois"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ConteudoAcao({
  estado,
  onAtualizar,
  onBaixarManualmente,
}: {
  estado: Estado;
  onAtualizar: (update: Update) => void;
  onBaixarManualmente: () => void;
}) {
  switch (estado.fase) {
    case 'ocioso':
      // Só alcançado na tela obrigatória, quando a busca ainda não achou a
      // release (rede fora, ou release ainda em rascunho).
      return (
        <Button variant="outline" onClick={onBaixarManualmente}>
          Baixar no site
        </Button>
      );
    case 'disponivel':
      return (
        <Button size="sm" onClick={() => onAtualizar(estado.update)}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Atualizar e reiniciar
        </Button>
      );
    case 'baixando': {
      const pct = estado.total ? Math.min(100, Math.round((estado.baixado / estado.total) * 100)) : null;
      return (
        <div className="space-y-1.5 text-left">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: pct === null ? '100%' : `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            {pct === null ? 'Baixando…' : `Baixando… ${pct}%`}
          </p>
        </div>
      );
    }
    case 'reiniciando':
      return (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Instalado. Reiniciando…
        </p>
      );
    case 'erro':
      return (
        <div className="space-y-2 text-left">
          <p className="text-xs text-destructive">{estado.mensagem}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onAtualizar(estado.update)}>
              Tentar de novo
            </Button>
            <Button size="sm" variant="outline" onClick={onBaixarManualmente}>
              Baixar no site
            </Button>
          </div>
        </div>
      );
  }
}
