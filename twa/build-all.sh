#!/usr/bin/env bash
# =============================================================================
# twa/build-all.sh — Build all Crew TWA/APK packages
# =============================================================================
#
# LOCAL USAGE
# -----------
#   ./build-all.sh
#
# Prerequisites:
#   npm install -g @bubblewrap/cli        (>= 1.22)
#   Java 17+ in PATH                       (required by Gradle)
#   Android SDK with build-tools 34.x     (ANDROID_HOME set)
#   Keystore at twa/keystore/crew-release.keystore
#
# CI USAGE (GitHub Actions / any CI)
# -----------------------------------
#   CREW_KEYSTORE_BASE64=<base64> \
#   CREW_KEYSTORE_PASS=<pass>     \
#   KEY_PASS_CUSTOMER=<pass>      \
#   KEY_PASS_CONTRACTOR=<pass>    \
#   KEY_PASS_FIELD=<pass>         \
#   KEY_PASS_SUPERVISOR=<pass>    \
#   KEY_PASS_COMMAND=<pass>       \
#   ./build-all.sh --ci
#
# KEYSTORE SETUP (first time, local)
# ------------------------------------
#   Run this once to generate the release keystore with all aliases:
#
#   KEYSTORE=twa/keystore/crew-release.keystore
#   for alias in crew-customer crew-contractor crew-field crew-supervisor crew-command-tablet; do
#     keytool -genkeypair \
#       -keystore "$KEYSTORE" \
#       -alias "$alias" \
#       -keyalg RSA -keysize 4096 \
#       -validity 10000 \
#       -dname "CN=Crew Pty Ltd, OU=Mobile, O=Crew Pty Ltd, L=Sydney, ST=NSW, C=AU"
#   done
#
#   Then extract SHA-256 fingerprints for assetlinks.json:
#   keytool -list -v -keystore "$KEYSTORE" | grep -A1 "Alias name:" | grep -E "(Alias|SHA256)"
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "${SCRIPT_DIR}")"
KEYSTORE_DIR="${SCRIPT_DIR}/keystore"
KEYSTORE_FILE="${KEYSTORE_DIR}/crew-release.keystore"
OUTPUT_DIR="${REPO_ROOT}/dist/apk"
CI_MODE="${1:-}"
BUILD_ERRORS=0

GREEN='\033[0;32m' RED='\033[0;31m' YELLOW='\033[1;33m' NC='\033[0m'
info()  { echo -e "${GREEN}▶${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; }

# ── Preflight checks ──────────────────────────────────────────────────────────
info "Checking prerequisites..."

if ! command -v bubblewrap &>/dev/null; then
  error "bubblewrap not found. Install with: npm install -g @bubblewrap/cli"
  exit 1
fi
if ! command -v java &>/dev/null; then
  error "Java 17+ is required. Install from adoptium.net"
  exit 1
fi

JAVA_VER=$(java -version 2>&1 | head -1 | grep -oP '(?<=version ")[\d]+' || echo "0")
if [[ "${JAVA_VER}" -lt 17 ]]; then
  error "Java 17+ required (found Java ${JAVA_VER})"
  exit 1
fi

mkdir -p "${OUTPUT_DIR}" "${KEYSTORE_DIR}"

# ── Keystore setup (CI mode) ──────────────────────────────────────────────────
if [[ "${CI_MODE}" == "--ci" ]]; then
  info "Decoding keystore from CI secret..."
  if [[ -z "${CREW_KEYSTORE_BASE64:-}" ]]; then
    error "CREW_KEYSTORE_BASE64 env var is not set"
    exit 1
  fi
  echo "${CREW_KEYSTORE_BASE64}" | base64 --decode > "${KEYSTORE_FILE}"
fi

if [[ ! -f "${KEYSTORE_FILE}" ]]; then
  error "Keystore not found at ${KEYSTORE_FILE}"
  echo "  See the KEYSTORE SETUP comment at the top of this script."
  exit 1
fi

# ── App matrix ────────────────────────────────────────────────────────────────
# Format: "dir:alias:key_pass_env_var"
declare -a APPS=(
  "customer:crew-customer:KEY_PASS_CUSTOMER"
  "contractor:crew-contractor:KEY_PASS_CONTRACTOR"
  "field:crew-field:KEY_PASS_FIELD"
  "supervisor:crew-supervisor:KEY_PASS_SUPERVISOR"
  "command-tablet:crew-command-tablet:KEY_PASS_COMMAND"
)

# ── Build loop ────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo "  Crew TWA Build — $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════"

for entry in "${APPS[@]}"; do
  IFS=':' read -r APP_DIR ALIAS KEY_ENV <<< "${entry}"
  APP_PATH="${SCRIPT_DIR}/${APP_DIR}"
  APP_OUTPUT="${OUTPUT_DIR}/crew-${APP_DIR}-release.apk"

  echo ""
  info "Building: ${APP_DIR} (${ALIAS})"
  echo "  Manifest: ${APP_PATH}/twa-manifest.json"

  if [[ ! -d "${APP_PATH}" ]]; then
    warn "Directory ${APP_PATH} not found — skipping"
    continue
  fi

  # Copy keystore into app dir for bubblewrap (relative path in twa-manifest.json)
  cp "${KEYSTORE_FILE}" "${APP_PATH}/crew-release.keystore"

  # Resolve key password
  KEYSTORE_PASS="${CREW_KEYSTORE_PASS:-}"
  KEY_PASS="${!KEY_ENV:-${CREW_KEYSTORE_PASS:-}}"

  cd "${APP_PATH}"

  # Build — pass passwords via flags to avoid interactive prompts
  if [[ -n "${KEYSTORE_PASS}" && -n "${KEY_PASS}" ]]; then
    bubblewrap build \
      --skipPwaValidation \
      --keystorePassword "${KEYSTORE_PASS}" \
      --keyPassword "${KEY_PASS}" 2>&1
  else
    # Local dev: bubblewrap will prompt for passwords
    bubblewrap build --skipPwaValidation 2>&1
  fi

  # Locate output APK (bubblewrap signs it if passwords were provided)
  SIGNED="${APP_PATH}/app/build/outputs/apk/release/app-release.apk"
  UNSIGNED="${APP_PATH}/app/build/outputs/apk/release/app-release-unsigned.apk"

  if [[ -f "${SIGNED}" ]]; then
    cp "${SIGNED}" "${APP_OUTPUT}"
    SIZE=$(du -sh "${APP_OUTPUT}" | cut -f1)
    echo -e "  ${GREEN}✓${NC} ${APP_OUTPUT} (${SIZE})"
  elif [[ -f "${UNSIGNED}" ]]; then
    warn "Unsigned APK only — signing manually with apksigner..."
    apksigner sign \
      --ks "${KEYSTORE_FILE}" \
      --ks-key-alias "${ALIAS}" \
      --ks-pass "pass:${KEYSTORE_PASS:-changeme}" \
      --key-pass "pass:${KEY_PASS:-changeme}" \
      --out "${APP_OUTPUT}" \
      "${UNSIGNED}"
    echo -e "  ${GREEN}✓${NC} ${APP_OUTPUT} (signed)"
  else
    error "Build output not found for ${APP_DIR}"
    BUILD_ERRORS=$((BUILD_ERRORS + 1))
  fi

  # Remove transient keystore copy
  rm -f "${APP_PATH}/crew-release.keystore"

  cd "${SCRIPT_DIR}"
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
if [[ ${BUILD_ERRORS} -eq 0 ]]; then
  echo -e "${GREEN}✓ All APKs built successfully${NC}"
else
  echo -e "${RED}✗ ${BUILD_ERRORS} build(s) failed${NC}"
fi
echo "Output: ${OUTPUT_DIR}"
ls -lh "${OUTPUT_DIR}/"*.apk 2>/dev/null || true
echo ""

# Print SHA-256 fingerprints for assetlinks.json
echo "SHA-256 fingerprints (copy into .well-known/assetlinks-*.json):"
echo "────────────────────────────────────────────────────────────────"
for entry in "${APPS[@]}"; do
  IFS=':' read -r APP_DIR ALIAS _ <<< "${entry}"
  FP=$(keytool -list -v \
    -keystore "${KEYSTORE_FILE}" \
    -alias "${ALIAS}" \
    -storepass "${CREW_KEYSTORE_PASS:-changeme}" \
    2>/dev/null | grep "SHA256:" | head -1 | sed 's/.*SHA256://' | tr -d ' ')
  echo "  ${ALIAS}: ${FP}"
done

exit ${BUILD_ERRORS}
