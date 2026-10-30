"""Local dev server: python's http.server, plus:
  - 'no-cache' on every response so the browser revalidates each time. Without it Chrome heuristically
    caches pages for hours or days (it only sees Last-Modified), so a file you just changed -- or swapped
    for a different page -- keeps showing its old version on a normal reload.
  - a small black "width x height px" pill pinned to the top-right of every HTML page, so you can always
    see the viewport size while testing responsive layouts. It is injected here, on the fly, so it never
    exists in the site's own files and can't reach the live site."""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

BADGE = """<script>(function(){var b=document.createElement("div");b.id="__wbadge";
b.style.cssText="position:fixed;top:8px;right:8px;z-index:2147483647;background:#111;color:#fff;font:600 13px/1.2 ui-monospace,Menlo,monospace;padding:6px 10px;border-radius:8px;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.3)";
function u(){b.textContent=innerWidth+" \u00d7 "+innerHeight+" px"}u();addEventListener("resize",u);
(document.body||document.documentElement).appendChild(b)})();</script>"""


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        path = self.translate_path(urlsplit(self.path).path)
        if os.path.isdir(path):
            path = os.path.join(path, "index.html")
        if not (path.endswith(".html") and os.path.isfile(path)):
            return super().do_GET()
        with open(path, "rb") as f:
            body = f.read()
        marker = b"</body>"
        snippet = BADGE.encode("utf-8")
        body = body.replace(marker, snippet + marker, 1) if marker in body else body + snippet
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
