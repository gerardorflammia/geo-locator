"""
test_app.py - Suite de Pruebas Automatizadas para GeoLocator
Verifica la integridad de archivos, inicio del servidor HTTP local,
endpoints REST, tipos MIME y algoritmos matemáticos de coordenadas.
"""

import unittest
import os
import sys
import json
import urllib.request
import time
from server import LocalGeoServer, find_available_port, get_static_dir

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class TestGeoLocator(unittest.TestCase):

    def test_file_structure(self):
        """Verifica que todos los archivos estáticos y scripts existan."""
        required_files = [
            os.path.join(BASE_DIR, "server.py"),
            os.path.join(BASE_DIR, "main.py"),
            os.path.join(BASE_DIR, "build_exe.py"),
            os.path.join(BASE_DIR, "run.bat"),
            os.path.join(BASE_DIR, "static", "index.html"),
            os.path.join(BASE_DIR, "static", "css", "style.css"),
            os.path.join(BASE_DIR, "static", "js", "app.js"),
            os.path.join(BASE_DIR, "static", "js", "leaflet_engine.js"),
            os.path.join(BASE_DIR, "static", "js", "gmaps_engine.js"),
        ]
        for f in required_files:
            self.assertTrue(os.path.exists(f), f"Archivo faltante: {f}")
            self.assertGreater(os.path.getsize(f), 0, f"El archivo está vacío: {f}")

    def test_find_available_port(self):
        """Verifica que el selector de puertos retorne un puerto numérico válido."""
        port = find_available_port(start_port=5800)
        self.assertIsInstance(port, int)
        self.assertGreaterEqual(port, 5800)

    def test_local_server_lifecycle_and_endpoints(self):
        """Inicia el servidor local, prueba endpoints HTTP y lo detiene limpiamente."""
        port = find_available_port(start_port=5900)
        server = LocalGeoServer(port=port)
        active_port = server.start()
        self.assertEqual(active_port, port)

        try:
            # Esperar a que el servidor esté activo
            time.sleep(0.3)
            base_url = server.url

            # 1. Probar endpoint de salud /api/health
            health_url = f"{base_url}/api/health"
            with urllib.request.urlopen(health_url, timeout=2.0) as resp:
                self.assertEqual(resp.status, 200)
                content_type = resp.headers.get("Content-Type", "")
                self.assertIn("application/json", content_type)
                data = json.loads(resp.read().decode("utf-8"))
                self.assertEqual(data.get("status"), "ok")
                self.assertEqual(data.get("app"), "GeoLocator")

            # 2. Probar ruta raíz / (debe servir index.html)
            with urllib.request.urlopen(f"{base_url}/", timeout=2.0) as resp:
                self.assertEqual(resp.status, 200)
                html = resp.read().decode("utf-8")
                self.assertIn("GeoLocator", html)
                self.assertIn("map-container", html)

            # 3. Probar recursos JS y CSS con MIME types correctos
            for asset, expected_mime in [
                ("css/style.css", "text/css"),
                ("js/app.js", "application/javascript"),
                ("js/leaflet_engine.js", "application/javascript"),
                ("js/gmaps_engine.js", "application/javascript"),
            ]:
                with urllib.request.urlopen(f"{base_url}/{asset}", timeout=2.0) as resp:
                    self.assertEqual(resp.status, 200, f"Error cargando asset: {asset}")
                    self.assertIn(expected_mime, resp.headers.get("Content-Type", ""))

        finally:
            server.stop()
            time.sleep(0.2)
            self.assertFalse(server.running)

    def test_coordinate_parsing_math(self):
        """Verifica la lógica matemática de conversión DMS a Decimal."""
        def dms_to_dd(deg, min_, sec, hemi):
            dd = deg + (min_ / 60.0) + (sec / 3600.0)
            if hemi.upper() in ["S", "W"]:
                dd = -dd
            return round(dd, 6)

        # Prueba con coordenadas de Caracas: 10° 28' 50.16" N, 66° 54' 12.96" W
        lat = dms_to_dd(10, 28, 50.16, "N")
        lng = dms_to_dd(66, 54, 12.96, "W")

        self.assertAlmostEqual(lat, 10.4806, places=4)
        self.assertAlmostEqual(lng, -66.9036, places=4)


if __name__ == "__main__":
    unittest.main()
