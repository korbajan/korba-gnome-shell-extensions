#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 korbajan
# SPDX-License-Identifier: GPL-2.0-or-later
#
# package-extension.sh — Build and package workspace-tiling-window-manager
# for submission to extensions.gnome.org.
#
# Usage: bash scripts/package-extension.sh [--build-dir DIR]
#
# Produces: workspace-tiling-window-manager@korbajan.github.com.zip
# in the current directory.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${1:-${REPO_ROOT}/build}"
EXT_NAME="workspace-tiling-window-manager"
UUID="${EXT_NAME}@korbajan.github.com"
ZIPFILE="${REPO_ROOT}/${UUID}.zip"

echo "==> Building ${EXT_NAME}…"
meson setup "${BUILD_DIR}" "${REPO_ROOT}" --wipe 2>/dev/null || \
    meson setup "${BUILD_DIR}" "${REPO_ROOT}"
meson compile -C "${BUILD_DIR}"

INSTALL_DIR="$(mktemp -d)"
trap 'rm -rf "${INSTALL_DIR}"' EXIT

meson install -C "${BUILD_DIR}" --destdir "${INSTALL_DIR}"

EXT_INSTALL="$(find "${INSTALL_DIR}" -type d -name "${EXT_NAME}@*" 2>/dev/null | head -1)"
if [[ -z "${EXT_INSTALL}" ]]; then
    # Flat install under share/gnome-shell/extensions/<uuid>
    EXT_INSTALL="${INSTALL_DIR}/usr/share/gnome-shell/extensions/${UUID}"
fi

if [[ ! -d "${EXT_INSTALL}" ]]; then
    echo "ERROR: could not locate installed extension directory" >&2
    exit 1
fi

rm -f "${ZIPFILE}"
(cd "${EXT_INSTALL}" && zip -r "${ZIPFILE}" .)

echo "==> Created: ${ZIPFILE}"
echo "    $(wc -c < "${ZIPFILE}") bytes"
