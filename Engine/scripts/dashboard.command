#!/bin/bash
# Double-click this file to open the video-progress dashboard in your browser.
# Leave this window open while watching; close it (or Ctrl-C) to stop the dashboard.
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1
python3 -u Engine/scripts/dashboard.py 2>&1 | while IFS= read -r line; do
  echo "$line"
  if [[ "$line" == Dashboard:* ]]; then
    url="$(echo "$line" | sed -E 's/^Dashboard: (http:\/\/[0-9.]+:[0-9]+).*/\1/')"
    open "$url"
  fi
done
