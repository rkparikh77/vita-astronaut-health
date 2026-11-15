#!/bin/sh
# Re-export the demo deck PDF after editing deck/deck.html (e.g. team and member names).
cd "$(dirname "$0")"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --virtual-time-budget=8000 \
  --print-to-pdf="$PWD/VITA-demo-deck.pdf" "file://$PWD/deck/deck.html" 2>/dev/null && echo "Wrote $PWD/VITA-demo-deck.pdf"
