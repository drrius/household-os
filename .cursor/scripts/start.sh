#!/usr/bin/env bash
set -euo pipefail

cd /workspace

ensure_docker_daemon() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi

  # Nested cloud VMs need fuse-overlayfs (overlay whiteouts fail) and
  # iptables-legacy (nft-backed Docker networking often cannot bridge containers).
  if command -v fuse-overlayfs >/dev/null 2>&1; then
    storage_driver=fuse-overlayfs
  else
    storage_driver=vfs
  fi

  sudo mkdir -p /etc/docker
  printf '{\n  "storage-driver": "%s",\n  "iptables": true,\n  "ip-forward": true\n}\n' \
    "$storage_driver" | sudo tee /etc/docker/daemon.json >/dev/null

  if [[ -x /usr/sbin/iptables-legacy ]]; then
    sudo update-alternatives --set iptables /usr/sbin/iptables-legacy >/dev/null 2>&1 || true
    sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy >/dev/null 2>&1 || true
  fi

  sudo sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || true
  sudo mkdir -p /var/run
  sudo rm -f /var/run/docker.pid
  sudo dockerd >/tmp/household-os-dockerd.log 2>&1 &

  for _ in $(seq 1 60); do
    if [[ -S /var/run/docker.sock ]]; then
      sudo chmod 666 /var/run/docker.sock || true
    fi
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Docker daemon failed to become ready. See /tmp/household-os-dockerd.log" >&2
  return 1
}

write_env_local() {
  local status_json api_url publishable vapid_env vapid_public vapid_private

  status_json="$(pnpm exec supabase status -o json)"
  api_url="$(
    printf '%s' "$status_json" | node -e "
      let s = '';
      process.stdin.on('data', (d) => (s += d));
      process.stdin.on('end', () => {
        const j = JSON.parse(s);
        process.stdout.write(j.API_URL);
      });
    "
  )"
  publishable="$(
    printf '%s' "$status_json" | node -e "
      let s = '';
      process.stdin.on('data', (d) => (s += d));
      process.stdin.on('end', () => {
        const j = JSON.parse(s);
        process.stdout.write(j.PUBLISHABLE_KEY || j.ANON_KEY);
      });
    "
  )"

  vapid_env="$(
    node --experimental-strip-types scripts/ensure-vapid-keys.mts
  )"

  cat >.env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=${api_url}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable}
${vapid_env}
EOF

  vapid_public="${vapid_env#NEXT_PUBLIC_VAPID_PUBLIC_KEY=}"
  vapid_public="${vapid_public%%$'\n'*}"
  vapid_private="${vapid_env##*$'\n'}"
  vapid_private="${vapid_private#VAPID_PRIVATE_KEY=}"

  cat >supabase/functions/.env <<EOF
VAPID_PUBLIC_KEY=${vapid_public}
VAPID_PRIVATE_KEY=${vapid_private}
EOF
  chmod 600 supabase/functions/.env

  node --experimental-strip-types scripts/inject-edge-vapid-env.mts
  node --experimental-strip-types scripts/seed-push-dispatch-vault.mts
}

ensure_docker_daemon

if ! pnpm exec supabase status >/dev/null 2>&1; then
  pnpm db:start
fi

write_env_local
