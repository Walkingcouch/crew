#!/usr/bin/env bash
# =============================================================================
# build-apks.sh — Crew Android APK build pipeline (project root)
# =============================================================================
#
# USAGE
#   ./build-apks.sh [OPTIONS]
#
# OPTIONS
#   --app  <name>    Build a single app (customer|contractor|fieldworker|
#                    supervisor|commandtablet). Omit to build all five.
#   --skip-init      Skip bubblewrap init; reuse the twa-manifest.json files
#                    already present in each app's TWA directory (faster on
#                    repeat builds or when the production subdomains are
#                    unreachable from the build host).
#   --version <tag>  Version string embedded in output filenames (default:
#                    $GITHUB_REF_NAME, falling back to "dev").
#   --ci             Decode $CREW_KEYSTORE_BASE64 into the keystore path before
#                    building. Implied automatically when the env var is set.
#   --help, -h       Print this help text.
#
# REQUIRED ENV VARS
#   SIGNING_KEY_PATH   Absolute or relative path to the .keystore file.
#                      In CI, set CREW_KEYSTORE_BASE64 (base64-encoded keystore)
#                      instead; the script will decode it to a temp path.
#   SIGNING_KEY_PASS   Password for the keystore store itself.
#   KEYPAIR_PASS       Password for the individual signing key. Defaults to
#                      $SIGNING_KEY_PASS when not set separately.
#
# OPTIONAL ENV VARS
#   CREW_KEYSTORE_BASE64   Base64-encoded keystore (CI). Triggers auto-decode.
#   ANDROID_SDK_ROOT       Defaults to /usr/local/lib/android/sdk.
#
# PREREQUISITES
#   npm install -g @bubblewrap/cli@1.22.1
#   Java 17+ in PATH  (required by Gradle)
#   Android SDK build-tools 34.x  (ANDROID_SDK_ROOT must point to the SDK)
#   jq in PATH
#
# KEYSTORE SETUP (one-time, local)
#   KEYSTORE=twa/keystore/crew-release.keystore
#   for alias in crew-customer crew-contractor crew-field \
#                crew-supervisor crew-command-tablet; do
#     keytool -genkeypair \
#       -keystore "$KEYSTORE" -alias "$alias" \
#       -keyalg RSA -keysize 4096 -validity 10000 \
#       -dname "CN=Crew Pty Ltd,OU=Mobile,O=Crew Pty Ltd,L=Sydney,ST=NSW,C=AU"
#   done
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

ts()          { date '+%H:%M:%S'; }
log_info()    { printf "${CYAN}[$(ts) INFO]${RESET}  %s\n"       "$*"; }
log_ok()      { printf "${GREEN}[$(ts)   OK]${RESET}  %s\n"       "$*"; }
log_warn()    { printf "${YELLOW}[$(ts) WARN]${RESET}  %s\n"      "$*"; }
log_error()   { printf "${RED}[$(ts)  ERR]${RESET}  %s\n"  "$*" >&2; }
log_section() { printf "\n${BOLD}┌─ %s ─────────────────────────────────────────${RESET}\n" "$*"; }
log_step()    { printf "${DIM}│  →${RESET} %s\n" "$*"; }

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TWA_ROOT="${SCRIPT_DIR}/twa"
KEYSTORE_DIR="${TWA_ROOT}/keystore"
DIST_DIR="${SCRIPT_DIR}/dist"

# ── Argument defaults ──────────────────────────────────────────────────────────
FILTER_APP=""
SKIP_INIT=false
CI_MODE=false
VERSION="${GITHUB_REF_NAME:-dev}"

# ── Argument parsing ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)       FILTER_APP="${2:?--app requires a value}"; shift 2 ;;
    --skip-init) SKIP_INIT=true;  shift ;;
    --ci)        CI_MODE=true;    shift ;;
    --version)   VERSION="${2:?--version requires a value}"; shift 2 ;;
    --help|-h)   sed -n '3,66p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) log_error "Unknown flag: $1  (run with --help for usage)"; exit 1 ;;
  esac
done

# Auto-enable CI mode when the base64 secret is present
[[ -n "${CREW_KEYSTORE_BASE64:-}" ]] && CI_MODE=true

# ── Configuration matrix ───────────────────────────────────────────────────────
# Columns: APP_NAME : HOST : PACKAGE_ID : KEY_ALIAS : ORIENTATION : TWA_SUBDIR
#
#   APP_NAME    — logical identifier used in filenames and --app filter
#   HOST        — production subdomain (manifest fetched from https://HOST/manifest.json)
#   PACKAGE_ID  — Android package name (au.com.getcrew.app.*)
#   KEY_ALIAS   — keystore alias for apksigner
#   ORIENTATION — portrait (phones) | landscape (command-tablet only)
#   TWA_SUBDIR  — subdirectory under twa/ containing twa-manifest.json
readonly -a APPS=(
  "customer:app.getcrew.com.au:au.com.getcrew.app.customer:crew-customer:portrait:customer"
  "contractor:pro.getcrew.com.au:au.com.getcrew.app.contractor:crew-contractor:portrait:contractor"
  "fieldworker:field.getcrew.com.au:au.com.getcrew.app.fieldworker:crew-field:portrait:field"
  "supervisor:supervisor.getcrew.com.au:au.com.getcrew.app.supervisor:crew-supervisor:portrait:supervisor"
  "commandtablet:command.getcrew.com.au:au.com.getcrew.app.commandtablet:crew-command-tablet:landscape:command-tablet"
)

# ── Cleanup trap ───────────────────────────────────────────────────────────────
_cleanup() {
  local code=$?
  # Scrub any transient keystore copies left in build directories
  find "${TWA_ROOT}" -maxdepth 3 -name 'crew-release.keystore' \
    -not -path "${KEYSTORE_DIR}/*" -delete 2>/dev/null || true
  [[ $code -ne 0 ]] && log_error "Build pipeline exited with code ${code}"
  exit $code
}
trap _cleanup EXIT INT TERM

# ── Preflight ──────────────────────────────────────────────────────────────────
log_section "Preflight"

_require_cmd() {
  local cmd="$1" hint="${2:-}"
  if ! command -v "$cmd" &>/dev/null; then
    log_error "Required command not found: ${cmd}${hint:+  (${hint})}"
    exit 1
  fi
}

_require_cmd bubblewrap "npm install -g @bubblewrap/cli@1.22.1"
_require_cmd jq         "brew install jq  /  apt install jq"
_require_cmd java       "install Java 17+ from adoptium.net"
_require_cmd keytool    "ships with the JDK"

# Java version gate (Gradle requires 17+)
java_ver=$(java -version 2>&1 | grep -oE '[0-9]+' | head -1)
if [[ "${java_ver:-0}" -lt 17 ]]; then
  log_error "Java 17+ required — found Java ${java_ver:-unknown}"
  exit 1
fi
log_ok "Java ${java_ver}"

# Locate apksigner inside the highest build-tools version available
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}"
BUILD_TOOLS_DIR="$(ls -d "${ANDROID_SDK_ROOT}/build-tools"/*/  2>/dev/null \
                   | sort -V | tail -1 || true)"
if [[ -z "${BUILD_TOOLS_DIR}" ]]; then
  log_error "Android build-tools not found under ${ANDROID_SDK_ROOT}/build-tools"
  exit 1
fi
APKSIGNER="${BUILD_TOOLS_DIR}apksigner"
log_ok "apksigner  → ${APKSIGNER}"
log_ok "bubblewrap → $(bubblewrap --version 2>&1 | head -1)"
log_ok "jq         → $(jq --version)"

# ── Keystore setup ─────────────────────────────────────────────────────────────
log_section "Keystore"

mkdir -p "${KEYSTORE_DIR}"

if [[ "${CI_MODE}" == true ]]; then
  if [[ -z "${CREW_KEYSTORE_BASE64:-}" ]]; then
    log_error "CI mode active but CREW_KEYSTORE_BASE64 is not set"
    exit 1
  fi
  SIGNING_KEY_PATH="${KEYSTORE_DIR}/crew-release.keystore"
  echo "${CREW_KEYSTORE_BASE64}" | base64 --decode > "${SIGNING_KEY_PATH}"
  log_ok "Keystore decoded from CREW_KEYSTORE_BASE64 ($(du -sh "${SIGNING_KEY_PATH}" | cut -f1))"
fi

: "${SIGNING_KEY_PATH:?SIGNING_KEY_PATH must be set (or use CREW_KEYSTORE_BASE64 in CI)}"
: "${SIGNING_KEY_PASS:?SIGNING_KEY_PASS must be set}"
KEYPAIR_PASS="${KEYPAIR_PASS:-${SIGNING_KEY_PASS}}"

# Resolve to an absolute path so it survives directory changes inside the loop
SIGNING_KEY_ABS="$(cd "$(dirname "${SIGNING_KEY_PATH}")" && pwd)/$(basename "${SIGNING_KEY_PATH}")"

if [[ ! -f "${SIGNING_KEY_ABS}" ]]; then
  log_error "Keystore file not found: ${SIGNING_KEY_ABS}"
  exit 1
fi
log_ok "Keystore: ${SIGNING_KEY_ABS}"

mkdir -p "${DIST_DIR}"

# ── Per-app build function ─────────────────────────────────────────────────────
# Called inside a subshell via `if ! _build_app ...; then` so set -e errors
# inside the function abort that app but not the whole pipeline.
_build_app() {
  local app_name="$1" host="$2" pkg_id="$3" key_alias="$4" orientation="$5" twa_subdir="$6"

  local app_dir="${TWA_ROOT}/${twa_subdir}"
  local manifest_url="https://${host}/manifest.json"
  local manifest_json="${app_dir}/twa-manifest.json"
  local apk_src="${app_dir}/app/build/outputs/apk/release/app-release.apk"
  local apk_dest="${DIST_DIR}/crew-${app_name}-${VERSION}.apk"
  # Relative keystore path written into twa-manifest.json (relative to app_dir)
  local keystore_rel="../keystore/crew-release.keystore"

  mkdir -p "${app_dir}"
  pushd "${app_dir}" > /dev/null

  # ── 1. bubblewrap init ──────────────────────────────────────────────────────
  if [[ "${SKIP_INIT}" == false ]]; then
    log_step "bubblewrap init — fetching ${manifest_url}"
    # Send a stream of empty responses to accept all interactive prompts
    # (bubblewrap pre-fills values from the web manifest; we override via jq below)
    if ! printf '\n%.0s' {1..40} \
         | bubblewrap init --manifest "${manifest_url}" 2>&1; then
      log_warn "bubblewrap init returned non-zero — proceeding with generated files"
    fi
  else
    if [[ ! -f "${manifest_json}" ]]; then
      log_error "--skip-init specified but ${manifest_json} does not exist"
      popd > /dev/null
      return 1
    fi
    log_step "Skipping init — reusing existing ${manifest_json}"
  fi

  # ── 2. jq — enforce required TWA fields ────────────────────────────────────
  log_step "Patching twa-manifest.json (packageId, display, orientation, signing)"

  if [[ ! -f "${manifest_json}" ]]; then
    log_error "twa-manifest.json missing after init step: ${manifest_json}"
    popd > /dev/null
    return 1
  fi

  # Validate the manifest is parseable before patching
  if ! jq empty "${manifest_json}" 2>/dev/null; then
    log_error "twa-manifest.json is not valid JSON: ${manifest_json}"
    popd > /dev/null
    return 1
  fi

  # Atomic patch: write to .tmp then rename
  jq \
    --arg pkg         "${pkg_id}"       \
    --arg alias       "${key_alias}"    \
    --arg keyPath     "${keystore_rel}" \
    --arg display     "standalone"      \
    --arg orient      "${orientation}"  \
    '
      .packageId                  = $pkg       |
      .display                    = $display   |
      .orientation                = $orient    |
      .isTrustedWebActivity       = true       |
      .enableSiteSettingsShortcut = false      |
      .fallbackType               = "customtabs" |
      .signing.keyPath            = $keyPath   |
      .signing.alias              = $alias
    ' \
    "${manifest_json}" > "${manifest_json}.tmp"

  mv "${manifest_json}.tmp" "${manifest_json}"

  # Place keystore at the relative path jq just embedded
  cp "${SIGNING_KEY_ABS}" "${app_dir}/../keystore/crew-release.keystore"

  # ── 3. bubblewrap build ─────────────────────────────────────────────────────
  log_step "bubblewrap build --skipPwaValidation"
  bubblewrap build \
    --skipPwaValidation                \
    --keystorePassword "${SIGNING_KEY_PASS}" \
    --keyPassword      "${KEYPAIR_PASS}"

  # ── 4. Collect signed APK ───────────────────────────────────────────────────
  if [[ ! -f "${apk_src}" ]]; then
    log_error "Signed APK not produced at expected path:"
    log_error "  ${apk_src}"
    popd > /dev/null
    return 1
  fi

  cp "${apk_src}" "${apk_dest}"
  log_ok "APK collected: ${apk_dest}  ($(du -sh "${apk_dest}" | cut -f1))"

  # ── 5. Verify APK signature ─────────────────────────────────────────────────
  log_step "Verifying APK signature"
  local verify_output
  verify_output="$("${APKSIGNER}" verify --verbose "${apk_dest}" 2>&1 | head -6)"
  if echo "${verify_output}" | grep -q "Verified"; then
    log_ok "Signature verified"
  else
    log_warn "apksigner output (check manually):"
    echo "${verify_output}" | sed 's/^/    /'
  fi

  # Scrub transient keystore copy from this app's dir
  rm -f "${app_dir}/crew-release.keystore"
  popd > /dev/null
}

# ── Build loop ─────────────────────────────────────────────────────────────────
declare -a BUILT=()
declare -a FAILED=()

for entry in "${APPS[@]}"; do
  IFS=':' read -r app_name host pkg_id key_alias orientation twa_subdir <<< "${entry}"

  # Single-app filter
  if [[ -n "${FILTER_APP}" && "${app_name}" != "${FILTER_APP}" ]]; then
    continue
  fi

  log_section "${app_name}  (${pkg_id})"
  log_info "Host: ${host}  |  Alias: ${key_alias}  |  Orientation: ${orientation}"

  if _build_app \
      "${app_name}" "${host}" "${pkg_id}" "${key_alias}" "${orientation}" "${twa_subdir}"
  then
    BUILT+=("${app_name}")
  else
    log_error "Build failed for ${app_name} — continuing with remaining apps"
    FAILED+=("${app_name}")
  fi
done

# ── SHA-256 fingerprints ───────────────────────────────────────────────────────
log_section "SHA-256 Fingerprints"
printf "  ${DIM}Copy these into .well-known/assetlinks.json${RESET}\n\n"

for entry in "${APPS[@]}"; do
  IFS=':' read -r app_name _host _pkg key_alias _orient _subdir <<< "${entry}"
  [[ -n "${FILTER_APP}" && "${app_name}" != "${FILTER_APP}" ]] && continue

  fp="$(keytool -list -v                    \
          -keystore "${SIGNING_KEY_ABS}"    \
          -alias    "${key_alias}"          \
          -storepass "${SIGNING_KEY_PASS}"  \
          2>/dev/null                       \
        | grep 'SHA256:' | head -1 | sed 's/.*SHA256:[[:space:]]*//' | tr -d ' ')"

  printf "  ${BOLD}%-16s${RESET}  %s\n" "${app_name}:" "${fp:-<keytool failed — check alias and password>}"
done

# ── Summary ────────────────────────────────────────────────────────────────────
log_section "Summary"
printf "  Built:   %d app(s)\n" "${#BUILT[@]}"
for a in "${BUILT[@]+"${BUILT[@]}"}"; do
  printf "    ${GREEN}✓${RESET} %s  →  dist/crew-%s-%s.apk\n" "$a" "$a" "${VERSION}"
done

if [[ "${#FAILED[@]}" -gt 0 ]]; then
  printf "\n  Failed:  %d app(s)\n" "${#FAILED[@]}"
  for a in "${FAILED[@]}"; do
    printf "    ${RED}✗${RESET} %s\n" "$a"
  done
  printf "\n"
  log_error "One or more APKs failed to build — see output above for details"
  exit 1
fi

printf "\n"
log_ok "All APKs built and signed successfully → ${DIST_DIR}/"
ls -lh "${DIST_DIR}"/crew-*-"${VERSION}".apk 2>/dev/null | awk '{print "    "$NF, $5}' || true
printf "\n"
