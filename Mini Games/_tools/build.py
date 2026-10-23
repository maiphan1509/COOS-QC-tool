"""Build every Mini Games source into the four ad formats and zip them.

usage: python3 "Mini Games/_tools/build.py" [slug-filter]

Sources live in Mini Games/_src/MG-<nn>-<slug>/ (index.html + main.js, the
popup 300x250 layout). Each source becomes, like the sample creatives:

  Popup Banner/PB-SM-300x250-<nn>-<slug>-interactive/        (+ .zip)
  Side Rail/SR-LG-200x480-<nn>-<slug>-interactive/           (+ .zip)
  Premium Top Banner/BT-LG-1456x180-<nn>-<slug>-interactive/ (+ .zip)
  Sticky Bottom Banner/CF-LG-1456x180-<nn>-<slug>-interactive/ (+ .zip)

main.js is shared: it reads data-format from #ad and lays itself out for
popup (300x250), rail (served 100x240) or strip (served 430x53).
"""

import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "_src")

FORMATS = [
    {"folder": "Popup Banner", "code": "PB-SM-300x250", "format": "popup", "label": "Popup",
     "w": 300, "h": 250, "sw": 300, "sh": 250, "k": 1},
    {"folder": "Side Rail", "code": "SR-LG-200x480", "format": "rail", "label": "Side Rail",
     "w": 200, "h": 480, "sw": 100, "sh": 240, "k": 2},
    {"folder": "Premium Top Banner", "code": "BT-LG-1456x180", "format": "strip", "label": "Top Banner",
     "w": 1456, "h": 180, "sw": 430, "sh": 180 * 430 / 1456, "k": 1456 / 430},
    {"folder": "Sticky Bottom Banner", "code": "CF-LG-1456x180", "format": "strip", "label": "Sticky Bottom",
     "w": 1456, "h": 180, "sw": 430, "sh": 180 * 430 / 1456, "k": 1456 / 430, "closable": True},
]

GENRES = {
    "hen-raiders": "Chicken-fleet space shooter",
    "sling-smash": "Slingshot vs. tower (physics)",
    "pixel-jumper": "Side-scrolling platformer",
    "rail-rush": "3-lane endless runner",
    "block-burst": "Drag-and-drop block puzzle",
    "line-drop": "Falling tetromino puzzle",
    "mine-sweep": "Minesweeper",
    "sky-flap": "Tap to fly through gaps",
    "fruit-slash": "Swipe to slice fruit",
    "brick-breaker": "Paddle and ball brick breaker",
    "gem-swap": "Match-3",
    "stack-tower": "Timing stack tower",
    "snake": "Snake",
    "merge-up": "2048-style number merge",
    "whack-a-mole": "Whack-a-mole",
    "hoop-flick": "Basketball flick",
    "prize-drop": "Peg-board prize drop",
}

RAIL_CSS = """
    .hud {
      height: 34px;
      flex-wrap: wrap;
      align-content: center;
      row-gap: 3px;
      column-gap: 5px;
      padding: 0 6px;
      font-size: 6.5px;
      letter-spacing: 0.3px;
    }

    .hud p { gap: 2px; white-space: nowrap; }
    .hud b { font-size: 9px; }
    .hud p > span:first-child:not([id]) { display: none; }
    .hud #timeValue::after { content: "s"; }

    .hud .brand {
      order: -1;
      justify-content: center;
      width: 100%;
      font-size: 6.5px;
      letter-spacing: 1px;
    }

    .overlay {
      gap: 5px;
      padding: 0 8px;
      background: linear-gradient(var(--veil), var(--veil)), linear-gradient(var(--veil), var(--veil));
    }
    .eyebrow { font-size: 6.5px; letter-spacing: 0.8px; }
    .title { font-size: 17px; letter-spacing: -0.3px; }
    .end .title { font-size: 14px; }
    .howto { margin: 0 0 2px; font-size: 7.5px; line-height: 1.35; }

    .play,
    .cta {
      min-width: 80px;
      height: 26px;
      padding: 0 8px;
      gap: 6px;
      border-radius: 13px;
      font-size: 8.5px;
      letter-spacing: 0.4px;
      white-space: nowrap;
    }

    .cta b { display: none; }
    .link { padding: 3px 4px; font-size: 7px; white-space: nowrap; }
    .offer { font-size: 26px; letter-spacing: -1px; }
"""

STRIP_CSS = """
    .hud {
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      gap: 2px;
      width: 66px;
      height: 100%;
      padding: 0 0 0 5px;
      background: linear-gradient(90deg, rgba(4, 10, 22, 0.92), rgba(4, 10, 22, 0.78) 72%, rgba(4, 10, 22, 0));
      font-size: 6.5px;
      letter-spacing: 0.2px;
    }

    .hud p { gap: 2px; white-space: nowrap; }
    .hud b { font-size: 9px; }
    .hud .brand { order: -1; font-size: 6.5px; letter-spacing: 0.5px; }

    [data-phase="end"] .hud { opacity: 0; }

    .overlay {
      display: grid;
      grid-auto-flow: column;
      grid-template-rows: auto auto;
      align-content: center;
      justify-content: center;
      align-items: center;
      column-gap: 14px;
      row-gap: 2px;
      padding: 0 12px;
      background: linear-gradient(var(--veil), var(--veil)), linear-gradient(var(--veil), var(--veil));
    }

    .eyebrow { grid-column: 1; grid-row: 1; align-self: end; font-size: 6.5px; letter-spacing: 1px; white-space: nowrap; }

    .title,
    .end .title {
      grid-column: 1;
      grid-row: 2;
      align-self: start;
      font-size: 15px;
      line-height: 1;
      white-space: nowrap;
    }

    .title br { display: none; }

    .howto {
      grid-column: 2;
      grid-row: 1 / span 2;
      max-width: 120px;
      margin: 0;
      font-size: 7.5px;
      line-height: 1.3;
      text-align: left;
    }

    .offer { grid-column: 2; grid-row: 1 / span 2; font-size: 26px; letter-spacing: -1px; }

    .play,
    .cta {
      grid-column: 3;
      grid-row: 1 / span 2;
      min-width: 96px;
      height: 28px;
      padding: 0 12px;
      gap: 6px;
      border-radius: 14px;
      font-size: 10px;
      white-space: nowrap;
    }

    .cta b { font-size: 13px; }
    .link { grid-column: 4; grid-row: 1 / span 2; font-size: 7px; white-space: nowrap; }
"""

CLOSE_CSS = """
    .close {
      position: absolute;
      z-index: 9;
      top: 3px;
      right: 3px;
      width: 14px;
      height: 14px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 50%;
      background: rgba(4, 7, 15, 0.78);
      cursor: pointer;
    }

    .close::before,
    .close::after {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      width: 7px;
      height: 1.2px;
      background: #ffffff;
      transform: translate(-50%, -50%) rotate(45deg);
    }

    .close::after { transform: translate(-50%, -50%) rotate(-45deg); }
"""


CREDIT_HTML = '<p class="credit">Developed by <strong>Thanh Mai</strong></p>'

CREDIT_CSS = {
    "popup": """
    .play-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }

    .credit {
      margin: 0;
      color: var(--ink-dim);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .credit strong { color: var(--ink); font-weight: 900; }
""",
    "rail": """
    .play-group { gap: 3px; }
    .credit { font-size: 6.5px; letter-spacing: 0; }
""",
    "strip": """
    .play-group { grid-column: 3; grid-row: 1 / span 2; gap: 2px; }
    .credit { font-size: 6.5px; letter-spacing: 0.2px; }
""",
}


def num(value):
    return f"{value:.4f}".rstrip("0").rstrip(".")


def format_css(fmt):
    head = f"""
    /* ------------------------------------------------- FORMAT: {fmt['code']} */
    /* Authored at {fmt['w']}x{fmt['h']}, served at {num(fmt['sw'])}x{num(fmt['sh'])}: k = {num(fmt['k'])}.
       Laid out in served pixels and scaled up by k, so every value below is
       the rendered size. */""" + CREDIT_CSS["popup"]
    if fmt["format"] == "popup":
        return head
    css = head + f"""
    html, body {{ width: {fmt['w']}px; height: {fmt['h']}px; }}

    .ad {{
      width: {num(fmt['sw'])}px;
      height: {num(fmt['sh'])}px;
      scale: {num(fmt['k'])};
      transform-origin: 0 0;
    }}

    .stage {{ width: 100%; height: 100%; }}
"""
    css += RAIL_CSS if fmt["format"] == "rail" else STRIP_CSS
    css += CREDIT_CSS[fmt["format"]]
    if fmt.get("closable"):
        css += CLOSE_CSS
    return css


def build_html(source, fmt, title):
    html = source
    html = re.sub(r'<meta name="ad.size" content="[^"]*">',
                  f'<meta name="ad.size" content="width={fmt["w"]},height={fmt["h"]}">', html, count=1)
    html = re.sub(r"<title>(.*?) — [^<]*</title>",
                  lambda m: f"<title>{m.group(1)} — {fmt['label']} {fmt['w']}x{fmt['h']}</title>", html, count=1)
    html = re.sub(r'<canvas id="stage" class="stage"[^>]*>',
                  '<canvas id="stage" class="stage" aria-hidden="true">', html, count=1)
    # Only the #ad tag carries the format; CSS selectors may quote it too.
    ad_tag = re.search(r'<main\b[^>]*\bid="ad"[^>]*>', html)
    tag = ad_tag.group(0)
    if re.search(r'\sdata-format="[^"]*"', tag):
        new_tag = re.sub(r'(\sdata-format=")[^"]*"', lambda m: f'{m.group(1)}{fmt["format"]}"', tag, count=1)
    else:
        new_tag = tag.replace("<main", f'<main data-format="{fmt["format"]}"', 1)
    html = html[:ad_tag.start()] + new_tag + html[ad_tag.end():]
    html = re.sub(r"(?<! )<br>", " <br>", html)
    # Designer credit sits right under the Tap to play button; the pair is one
    # layout block so the strip's grid keeps a single cell for it.
    if 'class="credit"' not in html:
        html = re.sub(r'([ \t]*)(<button[^>]*\bid="playButton"[^>]*>.*?</button>)',
                      lambda m: (f'{m.group(1)}<div class="play-group">\n{m.group(1)}  {m.group(2)}\n'
                                 f"{m.group(1)}  {CREDIT_HTML}\n{m.group(1)}</div>"),
                      html, count=1, flags=re.S)
    close = fmt.get("closable")
    if close and 'id="closeButton"' not in html:
        html = html.replace("  </main>", '    <button class="close" id="closeButton" type="button" aria-label="Close ad"></button>\n  </main>', 1)
    index = html.index("  </style>")
    html = html[:index] + format_css(fmt) + html[index:]
    return html


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    manifest = []
    sources = sorted(d for d in os.listdir(SRC) if d.startswith("MG-") and only in d)
    for source_dir in sources:
        match = re.match(r"MG-(\d+)-(.+)$", source_dir)
        number, slug = match.group(1), match.group(2)
        src_path = os.path.join(SRC, source_dir)
        source_html = open(os.path.join(src_path, "index.html"), encoding="utf-8").read()
        source_js = open(os.path.join(src_path, "main.js"), encoding="utf-8").read()
        if "const FORMATS" not in source_js:
            print(f"!! {source_dir}: main.js has no FORMATS table (popup-only shell)")
        title = re.search(r"<title>(.*?) — ", source_html).group(1)
        entry = {"number": number, "slug": slug, "title": title, "genre": GENRES.get(slug, ""), "formats": []}
        for fmt in FORMATS:
            name = f"{fmt['code']}-{number}-{slug}-interactive"
            parent = os.path.join(ROOT, fmt["folder"])
            out = os.path.join(parent, name)
            os.makedirs(parent, exist_ok=True)
            shutil.rmtree(out, ignore_errors=True)
            os.makedirs(out)
            with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as handle:
                handle.write(build_html(source_html, fmt, title))
            with open(os.path.join(out, "main.js"), "w", encoding="utf-8") as handle:
                handle.write(source_js)
            zip_path = out + ".zip"
            if os.path.exists(zip_path):
                os.remove(zip_path)
            subprocess.run(["zip", "-r", "-X", "-q", name + ".zip", name, "-x", "*.DS_Store"], cwd=parent, check=True)
            folder_bytes = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
            entry["formats"].append({
                "code": fmt["code"], "label": fmt["label"], "format": fmt["format"],
                "path": f"{fmt['folder']}/{name}/index.html",
                "w": fmt["w"], "h": fmt["h"], "k": fmt["k"],
                "bytes": folder_bytes, "zipBytes": os.path.getsize(zip_path)
            })
        manifest.append(entry)
        print(f"built {source_dir}: " + ", ".join(f"{f['code']} {f['zipBytes'] // 1024}KB zip" for f in entry["formats"]))

    if not only:
        with open(os.path.join(ROOT, "_tools", "manifest.js"), "w", encoding="utf-8") as handle:
            handle.write("// Generated by build.py — lists every built creative for index.html.\n")
            handle.write("window.MINI_GAMES = " + json.dumps(manifest, ensure_ascii=False, indent=2) + ";\n")


if __name__ == "__main__":
    main()
