#!/usr/bin/env bash
# Re-verifies every external endpoint referenced in docs/INTEGRACAO_TRIBUNAIS_INSS.md.
# Read-only: only GET/POST _search requests. Safe to run anywhere; prints one line per probe.
#
#   ./scripts/probe-court-apis.sh                # uses DATAJUD_API_KEY from apps/server/.env or the CNJ public key
#   DATAJUD_API_KEY=... ./scripts/probe-court-apis.sh
#   DJEN_OAB=62492 DJEN_UF=RS ./scripts/probe-court-apis.sh   # OAB to query in DJEN (default: firm partner, verified 2026-09-18)
# DJEN only answers to Brazilian IPs: run from Brazil (or a BR VPN) to see anything but 403.
set -u
cd "$(dirname "$0")/.."
if [ -z "${DATAJUD_API_KEY:-}" ] && [ -f apps/server/.env ]; then
  DATAJUD_API_KEY=$(grep -E '^DATAJUD_API_KEY=' apps/server/.env | cut -d= -f2-)
fi
# Chave pública publicada pelo CNJ em datajud-wiki.cnj.jus.br/api-publica/acesso (pode ser rotacionada).
CNJ_PUBLIC_KEY='cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='
KEY="${DATAJUD_API_KEY:-$CNJ_PUBLIC_KEY}"
case "$KEY" in your-datajud-api-key|"") KEY="$CNJ_PUBLIC_KEY";; esac
DJ='https://api-publica.datajud.cnj.jus.br'
NUM='50192100820214047100'   # processo real da firma (TRF4), tem documento G1 e G2 no Datajud

probe() { # label url [curl args...]
  local label=$1 url=$2; shift 2
  local code; code=$(curl -s -m 25 -o /dev/null -w '%{http_code}' "$@" "$url")
  printf '%-52s HTTP %s\n' "$label" "$code"
}
dj() { # label alias body
  local label=$1 alias=$2 body=$3
  local out; out=$(curl -s -m 30 -X POST "$DJ/$alias/_search" -H "Authorization: APIKey $KEY" -H 'Content-Type: application/json' -d "$body")
  printf '%-52s %s\n' "$label" "$(printf '%s' "$out" | python3 -c '
import sys,json
try:
    d=json.load(sys.stdin)
except Exception:
    print("non-json"); sys.exit()
if "error" in d: print("ERR", d["error"].get("type"), d.get("status")); sys.exit()
h=d["hits"]; t=h["total"]["value"]; ids=[x["_id"] for x in h["hits"]]
print("ok total=%s hits=%s %s" % (t, len(ids), ids[:3]))')"
}

echo "== egress: $(curl -s -m 10 https://ipinfo.io/country || echo '?')  (DJEN/TJRS/PDPJ only answer from Brazil)"
echo "== Datajud (chave: ${KEY:0:6}…)"
dj "trf4 match numeroProcesso (espera G1+G2)" api_publica_trf4 "{\"size\":10,\"query\":{\"match\":{\"numeroProcesso\":\"$NUM\"}},\"_source\":[\"grau\"]}"
dj "trf4 terms batch"                              api_publica_trf4 "{\"size\":10,\"query\":{\"terms\":{\"numeroProcesso\":[\"$NUM\",\"50006488520114047104\"]}},\"_source\":[\"grau\"]}"
dj "trf4 range+search_after"                       api_publica_trf4 '{"size":2,"track_total_hits":true,"query":{"range":{"dataHoraUltimaAtualizacao":{"gte":"now-7d"}}},"sort":[{"@timestamp":"asc"}],"_source":["numeroProcesso"]}'
for a in api_publica_tjrs api_publica_trt4 api_publica_tjdft api_publica_tre-rs api_publica_tjmrs api_publica_stj; do
  dj "alias $a" "$a" '{"size":0,"track_total_hits":true}'
done
dj "alias api_publica_cnj (espera index_not_found)" api_publica_cnj '{"size":0}'
echo "== DJEN / Comunica (403 CloudFront fora do Brasil)"
probe "comunicaapi GET /api/v1/comunicacao" "https://comunicaapi.pje.jus.br/api/v1/comunicacao?siglaTribunal=TRF4&dataDisponibilizacaoInicio=$(date -v-1d +%F 2>/dev/null || date -d yesterday +%F)&dataDisponibilizacaoFim=$(date +%F)&itensPorPagina=5&pagina=1" -H 'Accept: application/json'
probe "comunicaapi swagger (swaggerhub, sem geobloqueio)" "https://api.swaggerhub.com/apis/cnj/pcp/1.0.0"
OAB="${DJEN_OAB:-62492}"; UF="${DJEN_UF:-RS}"
printf '%-52s ' "comunicaapi por OAB $UF $OAB (últimos 7 dias)"
curl -s -m 40 "https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroOab=$OAB&ufOab=$UF&dataDisponibilizacaoInicio=$(date -v-7d +%F 2>/dev/null || date -d '7 days ago' +%F)&dataDisponibilizacaoFim=$(date +%F)&itensPorPagina=100&pagina=1" -H 'Accept: application/json' | python3 -c '
import sys,json,collections
try: d=json.load(sys.stdin)
except Exception: print("HTTP 403 / non-json (fora do Brasil?)"); sys.exit()
it=d.get("items",[]); print("ok items=%d count=%s tribunais=%s" % (len(it), d.get("count"), dict(collections.Counter(i["siglaTribunal"] for i in it))))'
printf '%-52s ' "comunicaapi por numeroProcesso (caso da firma)"
curl -s -m 40 "https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroProcesso=50118697420254047104&itensPorPagina=10&pagina=1" -H 'Accept: application/json' | python3 -c '
import sys,json
try: d=json.load(sys.stdin)
except Exception: print("HTTP 403 / non-json (fora do Brasil?)"); sys.exit()
it=d.get("items",[]); print("ok items=%d newest=%s" % (len(it), max((i["data_disponibilizacao"] for i in it), default=None)))'
[ -n "${BR_RELAY_URL:-}" ] && probe "BR relay -> comunicacao" "$BR_RELAY_URL/comunicacao?siglaTribunal=TRF4&itensPorPagina=1&pagina=1" -H "Authorization: Bearer ${BR_RELAY_TOKEN:-}"
echo "== Outros (registro de resultados negativos)"
probe "eproc TRF4 MNI wsdl (200 corpo vazio)" "https://eproc.trf4.jus.br/eproc2trf4/ws/controlador_ws.php?srv=intercomunicacao2.2&wsdl"
probe "eproc TJRS 1g (403 fora do Brasil)" "https://eproc1g.tjrs.jus.br/eproc/"
probe "PDPJ consulta API (401 sem token)" "https://consultaprocessual.pdpj.jus.br/api/v1/processos?numeroProcesso=$NUM" -A 'Mozilla/5.0'
probe "PDPJ portal de serviços (429 fora do Brasil)" "https://portaldeservicos.pdpj.jus.br/"
probe "SSO pje openid-configuration" "https://sso.cloud.pje.jus.br/auth/realms/pje/.well-known/openid-configuration"
probe "CNJ SGT tabelas unificadas wsdl" "https://www.cnj.jus.br/sgt/sgt_ws.php?wsdl"
probe "Meu INSS (sem API pública)" "https://meu.inss.gov.br/"
