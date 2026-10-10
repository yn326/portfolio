"""Local dev server: python's http.server, plus 'no-cache' on every response so the browser revalidates
each time. Without it Chrome heuristically caches pages for hours or days (it only sees Last-Modified), so
a file you just changed -- or swapped for a different page -- keeps showing its old version on a normal reload."""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
