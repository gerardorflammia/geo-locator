"""
server.py - Servidor HTTP local embebido para GeoLocator
Sirve los archivos estáticos de la interfaz web en un puerto local seguro (127.0.0.1)
y proporciona endpoints para verificación de salud.
"""

import os
import sys
import json
import socket
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler
from threading import Thread

# Asegurar registro de tipos MIME estándar
mimetypes.init()
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("text/html", ".html")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("image/png", ".png")
mimetypes.add_type("image/x-icon", ".ico")


def get_static_dir():
    """Retorna la ruta absoluta del directorio static, compatible con PyInstaller."""
    if getattr(sys, "frozen", False):
        # Ejecución empaquetada con PyInstaller
        base_dir = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    else:
        # Ejecución normal desde código fuente
        base_dir = os.path.dirname(os.path.abspath(__file__))

    static_path = os.path.join(base_dir, "static")
    if not os.path.exists(static_path):
        # Fallback a directorio local si no existe la ruta interna
        static_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
    return static_path


class GeoLocatorRequestHandler(SimpleHTTPRequestHandler):
    """Manejador HTTP personalizado para servir assets y endpoints de soporte."""

    def __init__(self, *args, **kwargs):
        self.static_directory = get_static_dir()
        super().__init__(*args, directory=self.static_directory, **kwargs)

    def end_headers(self):
        # Encabezados de seguridad y contexto seguro para Geolocation y Clipboard
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_GET(self):
        # Endpoint de salud para verificar que el servidor local está respondiendo
        if self.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            payload = {
                "status": "ok",
                "app": "GeoLocator",
                "version": "1.0.0",
                "static_dir": self.static_directory,
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        # Redirigir la raíz a /index.html
        if self.path == "/" or self.path == "":
            self.path = "/index.html"

        return super().do_GET()

    def log_message(self, format, *args):
        # Suprimir logs verbosos en consola a menos que esté en modo depuración
        if os.environ.get("GEOLOCATOR_DEBUG") == "1":
            super().log_message(format, *args)


def find_available_port(host="127.0.0.1", start_port=5050, max_attempts=50):
    """Busca un puerto libre en el host especificado a partir de start_port."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, port))
                return port
            except OSError:
                continue
    # Si todos los puertos del rango fallaron, deja que el sistema operativo elija uno
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((host, 0))
        return s.getsockname()[1]


class LocalGeoServer:
    """Clase administradora del ciclo de vida del servidor HTTP local."""

    def __init__(self, host="127.0.0.1", port=None):
        self.host = host
        self.port = port or find_available_port(host=self.host, start_port=5050)
        self.httpd = None
        self.thread = None
        self.running = False

    def start(self):
        """Inicia el servidor en un hilo en segundo plano (daemon thread)."""
        self.httpd = HTTPServer((self.host, self.port), GeoLocatorRequestHandler)
        self.running = True
        self.thread = Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        print(f"[GeoLocator Server] Servidor local activo en http://{self.host}:{self.port}")
        return self.port

    def stop(self):
        """Detiene el servidor HTTP de forma limpia."""
        if self.httpd:
            self.running = False
            self.httpd.shutdown()
            self.httpd.server_close()
            print("[GeoLocator Server] Servidor local detenido correctamente.")

    @property
    def url(self):
        return f"http://{self.host}:{self.port}"


if __name__ == "__main__":
    server = LocalGeoServer()
    port = server.start()
    print(f"Presione Ctrl+C para detener el servidor en {server.url}")
    try:
        server.thread.join()
    except KeyboardInterrupt:
        server.stop()
