"""
main.py - Punto de entrada principal para GeoLocator (Aplicación Ejecutable)
Inicia el servidor local embebido y abre la ventana nativa de escritorio con WebView2.
Incluye manejo de excepciones y mecanismo de respaldo resiliente.
"""

import sys
import os
import time
import urllib.request
import subprocess
import webbrowser
from server import LocalGeoServer


def wait_for_server_ready(url, timeout_seconds=5.0):
    """Espera activamente a que el servidor HTTP local responda 200 OK."""
    health_url = f"{url}/api/health"
    start_time = time.time()
    while time.time() - start_time < timeout_seconds:
        try:
            with urllib.request.urlopen(health_url, timeout=0.5) as response:
                if response.status == 200:
                    return True
        except Exception:
            time.sleep(0.1)
    return False


def launch_browser_fallback(url):
    """Mecanismo de respaldo si el motor WebView2 nativo no puede inicializarse."""
    print("[GeoLocator] Inicializando ventana en modo aplicación de navegador...")
    # Intentar Microsoft Edge en modo aplicación (sin barra de direcciones ni pestañas)
    edge_paths = [
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%LocalAppData%\Microsoft\Edge\Application\msedge.exe"),
    ]
    for path in edge_paths:
        if os.path.exists(path):
            try:
                subprocess.Popen([path, f"--app={url}", "--window-size=1240,820"])
                return
            except Exception as e:
                print(f"[GeoLocator] Error al abrir Edge en modo app: {e}")

    # Fallback general con el navegador predeterminado del sistema
    webbrowser.open(url)


def main():
    print("=" * 60)
    print("       GeoLocator - Localizador de Coordenadas en Mapa")
    print("=" * 60)

    # 1. Iniciar servidor HTTP local
    server = LocalGeoServer(host="127.0.0.1")
    port = server.start()
    url = server.url

    # 2. Esperar confirmación de salud del servidor
    if not wait_for_server_ready(url):
        print(f"[GeoLocator Advertencia] El servidor no respondió a tiempo en {url}")

    # 3. Intentar abrir ventana gráfica nativa con pywebview
    webview_launched = False
    try:
        import webview

        print("[GeoLocator] Abriendo ventana gráfica de escritorio...")
        window = webview.create_window(
            title="GeoLocator - Localizador de Coordenadas en Mapa",
            url=f"{url}/index.html",
            width=1240,
            height=820,
            min_size=(880, 600),
            confirm_close=False,
            text_select=True,
        )

        def on_closed():
            print("[GeoLocator] Ventana cerrada por el usuario. Deteniendo servidor...")
            server.stop()

        window.events.closed += on_closed

        # webview.start bloquea la ejecución hasta que se cierra la ventana
        webview.start(gui="winforms", debug=False)
        webview_launched = True

    except Exception as exc:
        print(f"[GeoLocator] Aviso: pywebview no pudo iniciar la ventana ({exc}).")
        print("[GeoLocator] Activando lanzador de respaldo en modo aplicación...")
        launch_browser_fallback(f"{url}/index.html")

        # Mantener el proceso vivo mientras el usuario interactúa
        try:
            print("[GeoLocator] Servidor activo. Presione Ctrl+C en esta consola para salir.")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
    finally:
        server.stop()
        print("[GeoLocator] Proceso finalizado.")


if __name__ == "__main__":
    main()
