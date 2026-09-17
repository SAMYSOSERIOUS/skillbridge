"""Rebuild web/index.html from its sources.

The frontend is a single self-contained file (React runtime, Geist fonts,
layout and logic all embedded). Its editable sources live in web/src/:

- shell.html     the bundle shell (loader + runtime + fonts; do not edit)
- layout.html    the page markup (sc-if / sc-for templates)
- component.js   the logic class (data loading, scoring, 3-D scenes)

Run after editing layout.html or component.js:
    python tools/rebundle.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "web" / "src"
TEMPLATE_LINE = 383  # 0-based line of the __bundler/template payload in shell.html

layout = (SRC / "layout.html").read_text()
component = (SRC / "component.js").read_text()

m = re.search(
    r'(<script type="text/x-dc" data-dc-script[^>]*>)(.*?)(</script>)', layout, flags=re.S
)
assert m, "layout.html: logic script tag not found"
layout = layout[: m.start(2)] + component + layout[m.end(2) :]

shell = (SRC / "shell.html").read_text().split("\n")
payload = json.dumps(layout).replace("<", "\\u003c").replace(">", "\\u003e")
assert shell[TEMPLATE_LINE].startswith('"<!DOCTYPE'), "shell template line moved"
shell[TEMPLATE_LINE] = payload
out = "\n".join(shell)
out = out.replace(
    "<title>Bundled Page</title>",
    "<title>SkillBridge — where should your career go next?</title>",
)
(ROOT / "web" / "index.html").write_text(out)
print(f"web/index.html rebuilt ({len(out):,} bytes)")
