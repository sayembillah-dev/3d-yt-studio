#!/bin/bash
# qa_all.sh — one quiet command for a whole QA round (see qa_all.py for the mode/gate details).
#   bash qa_all.sh <project_dir> gate|qa|final [Comp]
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$HERE/qa_all.py" "$@"
