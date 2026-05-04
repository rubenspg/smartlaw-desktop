#!/usr/bin/env bash
#
# Provisions PostgreSQL 16 inside a fresh Debian 12 LXC for smartlaw.
# Run as root inside the LXC: bash setup-postgres-lxc.sh
#
# Idempotent: safe to re-run. Won't recreate role/db if they already exist.

set -euo pipefail

# ---- Configuration ---------------------------------------------------------
PG_VERSION="16"
DB_NAME="${DB_NAME:-smartlaw}"
DB_USER="${DB_USER:-smartlaw}"
DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD env var before running}"
ALLOWED_CIDR="${ALLOWED_CIDR:-192.168.1.0/24}"   # LAN allowed to connect
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

# ---- Helpers ---------------------------------------------------------------
log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }

require_root() {
  [[ $EUID -eq 0 ]] || { echo "Run as root" >&2; exit 1; }
}

# ---- Steps -----------------------------------------------------------------
install_postgres() {
  log "Installing PostgreSQL ${PG_VERSION} from PGDG"
  apt-get update
  apt-get install -y curl ca-certificates gnupg lsb-release

  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc

  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list

  apt-get update
  apt-get install -y "postgresql-${PG_VERSION}"
  systemctl enable --now postgresql
}

configure_remote_access() {
  log "Configuring remote access (${ALLOWED_CIDR})"

  # listen_addresses = '*'
  if grep -qE "^#?listen_addresses" "$PG_CONF"; then
    sed -i "s|^#\?listen_addresses.*|listen_addresses = '*'|" "$PG_CONF"
  else
    echo "listen_addresses = '*'" >> "$PG_CONF"
  fi

  # pg_hba: append rule once
  local hba_rule="host    ${DB_NAME}    ${DB_USER}    ${ALLOWED_CIDR}    scram-sha-256"
  if ! grep -Fxq "$hba_rule" "$PG_HBA"; then
    echo "$hba_rule" >> "$PG_HBA"
  fi

  systemctl restart postgresql
}

create_role_and_db() {
  log "Creating role '${DB_USER}' and database '${DB_NAME}' (if missing)"

  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SQL

  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
  fi
}

setup_backups() {
  log "Setting up daily pg_dump to ${BACKUP_DIR}"
  mkdir -p "$BACKUP_DIR"
  chown postgres:postgres "$BACKUP_DIR"

  cat > /etc/cron.daily/pg-backup-${DB_NAME} <<EOF
#!/bin/bash
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR}"
TS=\$(date +%Y%m%d-%H%M%S)
sudo -u postgres pg_dump -Fc "${DB_NAME}" -f "\${BACKUP_DIR}/${DB_NAME}-\${TS}.dump"
find "\${BACKUP_DIR}" -name "${DB_NAME}-*.dump" -mtime +${BACKUP_RETENTION_DAYS} -delete
EOF
  chmod +x /etc/cron.daily/pg-backup-${DB_NAME}
}

print_summary() {
  local ip
  ip=$(hostname -I | awk '{print $1}')
  log "Done."
  cat <<EOF

  Connect string:
    postgresql://${DB_USER}:<password>@${ip}:5432/${DB_NAME}

  Test from another host:
    psql -h ${ip} -U ${DB_USER} -d ${DB_NAME}

  Backups: ${BACKUP_DIR} (kept ${BACKUP_RETENTION_DAYS} days)

EOF
}

# ---- Main ------------------------------------------------------------------
require_root
install_postgres
configure_remote_access
create_role_and_db
setup_backups
print_summary
