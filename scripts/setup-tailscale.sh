#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Tailscale setup for the CryptoBot trading dashboard (Proxmox LXC / Debian/Ubuntu)
# Run as root inside the container:  bash scripts/setup-tailscale.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ████████╗ █████╗ ██╗██╗     ███████╗ ██████╗ █████╗ ██╗     ███████╗"
echo "     ██╔══╝██╔══██╗██║██║     ██╔════╝██╔════╝██╔══██╗██║     ██╔════╝"
echo "     ██║   ███████║██║██║     ███████╗██║     ███████║██║     █████╗  "
echo "     ██║   ██╔══██║██║██║     ╚════██║██║     ██╔══██║██║     ██╔══╝  "
echo "     ██║   ██║  ██║██║███████╗███████║╚██████╗██║  ██║███████╗███████╗"
echo "     ╚═╝   ╚═╝  ╚═╝╚═╝╚══════╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝"
echo -e "${NC}"
echo -e "${CYAN}  CryptoBot Dashboard — Tailscale Setup${NC}"
echo "  ──────────────────────────────────────"
echo ""

# ── Check running as root ──────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}✗ Please run as root (sudo bash scripts/setup-tailscale.sh)${NC}"
  exit 1
fi

# ── Check OS ──────────────────────────────────────────────────────────────
if ! command -v apt-get &>/dev/null; then
  echo -e "${RED}✗ This script requires apt (Debian/Ubuntu). Adjust for your distro.${NC}"
  exit 1
fi

# ── Check if already installed ────────────────────────────────────────────
if command -v tailscale &>/dev/null; then
  echo -e "${YELLOW}⚠  Tailscale is already installed ($(tailscale version | head -1))${NC}"
  echo ""
  read -r -p "   Re-configure / re-authenticate? [y/N] " RECONFIGURE
  if [[ ! "$RECONFIGURE" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${GREEN}✓ Nothing to do. Current Tailscale IP: $(tailscale ip -4 2>/dev/null || echo 'not connected')${NC}"
    exit 0
  fi
else
  echo -e "${CYAN}▶ Installing Tailscale...${NC}"
  curl -fsSL https://tailscale.com/install.sh | sh
  echo -e "${GREEN}✓ Tailscale installed${NC}"
fi

echo ""

# ── Optional: hostname ─────────────────────────────────────────────────────
DEFAULT_HOSTNAME=$(hostname)
read -r -p "   Tailscale device name [${DEFAULT_HOSTNAME}]: " CUSTOM_HOSTNAME
HOSTNAME_ARG=""
if [ -n "$CUSTOM_HOSTNAME" ] && [ "$CUSTOM_HOSTNAME" != "$DEFAULT_HOSTNAME" ]; then
  HOSTNAME_ARG="--hostname=$CUSTOM_HOSTNAME"
fi

# ── Optional: advertise as exit node ──────────────────────────────────────
echo ""
read -r -p "   Advertise as exit node (route all traffic through this device)? [y/N] " EXIT_NODE
EXIT_NODE_ARG=""
if [[ "$EXIT_NODE" =~ ^[Yy]$ ]]; then
  EXIT_NODE_ARG="--advertise-exit-node"
  # Enable IP forwarding required for exit node
  echo 'net.ipv4.ip_forward = 1' >> /etc/sysctl.d/99-tailscale.conf
  echo 'net.ipv6.conf.all.forwarding = 1' >> /etc/sysctl.d/99-tailscale.conf
  sysctl -p /etc/sysctl.d/99-tailscale.conf &>/dev/null
  echo -e "${GREEN}  ✓ IP forwarding enabled${NC}"
fi

# ── Optional: auth key (unattended setup) ─────────────────────────────────
echo ""
echo -e "   ${YELLOW}Optional:${NC} Enter a Tailscale auth key for unattended setup."
echo "   (Leave blank to open a browser auth URL instead)"
read -r -p "   Auth key [blank = browser]: " AUTH_KEY
AUTH_KEY_ARG=""
if [ -n "$AUTH_KEY" ]; then
  AUTH_KEY_ARG="--authkey=$AUTH_KEY"
fi

# ── Start Tailscale ────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}▶ Starting Tailscale...${NC}"

# ── Check TUN device availability (required in Proxmox LXC) ──────────────
if [ ! -e /dev/net/tun ]; then
  echo ""
  echo -e "${RED}✗ /dev/net/tun not found — Tailscale requires TUN access.${NC}"
  echo ""
  echo -e "${YELLOW}  This is a Proxmox LXC container. Run these commands on the${NC}"
  echo -e "${YELLOW}  PROXMOX HOST to grant TUN access, then re-run this script:${NC}"
  echo ""
  VMID=$(hostname | grep -oP '\d+' | head -1 || echo "YOUR_VMID")
  echo -e "  ${CYAN}# Replace ${VMID} with your container's VMID (visible in Proxmox UI)${NC}"
  echo -e "  ${CYAN}echo \"lxc.cgroup2.devices.allow: c 10:200 rwm\" >> /etc/pve/lxc/${VMID}.conf${NC}"
  echo -e "  ${CYAN}echo \"lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file\" >> /etc/pve/lxc/${VMID}.conf${NC}"
  echo -e "  ${CYAN}pct restart ${VMID}${NC}"
  echo ""
  exit 1
fi

# Enable & start daemon
systemctl enable tailscaled 2>/dev/null || true
systemctl start tailscaled 2>/dev/null || true

# Wait for daemon to be ready (up to 5s)
for i in 1 2 3 4 5; do
  tailscale status &>/dev/null && break
  sleep 1
done

# Connect
# shellcheck disable=SC2086
if ! tailscale up \
  --accept-routes \
  --accept-dns \
  $HOSTNAME_ARG \
  $EXIT_NODE_ARG \
  $AUTH_KEY_ARG 2>&1; then

  TS_ERR=$(tailscale up $HOSTNAME_ARG $EXIT_NODE_ARG $AUTH_KEY_ARG 2>&1 || true)
  if echo "$TS_ERR" | grep -q "503\|no backend\|TUN"; then
    echo ""
    echo -e "${RED}✗ tailscaled started but can't access the TUN device.${NC}"
    echo ""
    echo -e "${YELLOW}  On the PROXMOX HOST, add TUN access to this container then restart it:${NC}"
    echo ""
    VMID=$(cat /proc/1/cgroup 2>/dev/null | grep -oP '(?<=lxc/)\d+' | head -1 || echo "YOUR_VMID")
    echo -e "  ${CYAN}echo \"lxc.cgroup2.devices.allow: c 10:200 rwm\" >> /etc/pve/lxc/${VMID}.conf${NC}"
    echo -e "  ${CYAN}echo \"lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file\" >> /etc/pve/lxc/${VMID}.conf${NC}"
    echo -e "  ${CYAN}pct restart ${VMID}${NC}"
    echo ""
    exit 1
  fi
  exit 1
fi

echo ""
echo -e "${GREEN}✓ Tailscale connected!${NC}"
echo ""

TS_IP=$(tailscale ip -4 2>/dev/null || echo "pending")
TS_NAME=$(tailscale status --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Self']['DNSName'].rstrip('.'))" 2>/dev/null || echo "")

echo "  ┌─────────────────────────────────────────────────┐"
echo "  │  Tailscale IP   : ${TS_IP}"
if [ -n "$TS_NAME" ]; then
echo "  │  MagicDNS name  : ${TS_NAME}"
fi
echo "  │"
echo "  │  Dashboard URL  : http://${TS_IP}:3000"
echo "  │  WebSocket      : ws://${TS_IP}:8080"
echo "  └─────────────────────────────────────────────────┘"
echo ""
echo -e "${YELLOW}  Tip:${NC} Access the dashboard from any Tailscale device using the URL above."
echo -e "${YELLOW}  Tip:${NC} No ports need to be open on your router or firewall."
echo ""

# ── Optional: restrict dashboard to Tailscale only ────────────────────────
read -r -p "   Lock down port 3000/8080 to Tailscale network only? (uses ufw) [y/N] " LOCKDOWN
if [[ "$LOCKDOWN" =~ ^[Yy]$ ]]; then
  if command -v ufw &>/dev/null; then
    ufw allow in on tailscale0 to any port 3000
    ufw allow in on tailscale0 to any port 8080
    ufw deny 3000
    ufw deny 8080
    ufw --force enable
    echo -e "${GREEN}  ✓ Ports 3000 and 8080 restricted to Tailscale network${NC}"
  else
    echo -e "${YELLOW}  ⚠ ufw not found — install it with: apt install ufw${NC}"
  fi
fi

echo ""
echo -e "${GREEN}  Setup complete.${NC}"
