import http.server
import socketserver
import urllib.request
import urllib.error
import os

PORT = int(os.environ.get('PORT', 8080))
DIRECTORY = "public"

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Check if the request is for our proxy route
        if self.path.startswith('/api/matches'):
            self.handle_proxy()
        elif self.path.startswith('/api/team'):
            self.handle_proxy_team()
        else:
            super().do_GET()

    def handle_proxy_team(self):
        # Parse query params to extract team ID
        import urllib.parse
        parsed_path = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed_path.query)
        team_id = params.get('id', [None])[0]
        
        if not team_id:
            # Try to get from url path /api/team/{id}
            parts = parsed_path.path.split('/')
            if len(parts) >= 3 and parts[2].isdigit():
                team_id = parts[2]
                
        if not team_id:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(b'{"error": "Missing team ID"}')
            return

        # Retrieve token from headers or fallback to the hardcoded key
        token = self.headers.get('X-Auth-Token', 'ae4fa7a0fdd2472b861033c12c518797')
        
        target_url = f'https://api.football-data.org/v4/teams/{team_id}'
        req = urllib.request.Request(target_url)
        req.add_header('X-Auth-Token', token)
        
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                data = response.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Connection', 'close')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Connection', 'close')
            self.end_headers()
            try:
                self.wfile.write(e.read())
            except Exception:
                self.wfile.write(b'{"error": "HTTP Error"}')
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(f'{{"error": "{str(e)}"}}'.encode())

    def handle_proxy(self):
        # Retrieve token from headers or fallback to the hardcoded key
        token = self.headers.get('X-Auth-Token', 'ae4fa7a0fdd2472b861033c12c518797')
        
        target_url = 'https://api.football-data.org/v4/competitions/WC/matches'
        req = urllib.request.Request(target_url)
        req.add_header('X-Auth-Token', token)
        
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                data = response.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Connection', 'close')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Connection', 'close')
            self.end_headers()
            try:
                self.wfile.write(e.read())
            except Exception:
                self.wfile.write(b'{"error": "HTTP Error"}')
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(f'{{"error": "{str(e)}"}}'.encode())

if __name__ == '__main__':
    # Ensure working directory is the script's directory so it finds 'public/'
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # Enable address reuse so it restarts without socket errors
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), ProxyHTTPRequestHandler) as httpd:
        print(f"Server is running on http://localhost:{PORT}")
        print(f"API Proxy active at http://localhost:{PORT}/api/matches")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
