"""
build_exe.py - Script automatizado para compilar GeoLocator en un ejecutable standalone para Windows (.exe)
Empaqueta el servidor local, dependencias de pywebview y los archivos estáticos (HTML/CSS/JS).
"""

import os
import sys
import subprocess
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
MAIN_SCRIPT = os.path.join(BASE_DIR, "main.py")
DIST_DIR = os.path.join(BASE_DIR, "dist")
BUILD_DIR = os.path.join(BASE_DIR, "build")


def check_prerequisites():
    """Verifica que PyInstaller y pywebview estén instalados."""
    try:
        import PyInstaller
        print(f"[Build] PyInstaller versión {PyInstaller.__version__} detectado.")
    except ImportError:
        print("[Build Error] PyInstaller no está instalado. Ejecute: python -m pip install pyinstaller")
        return False

    try:
        import webview
        print("[Build] pywebview detectado correctamente.")
    except ImportError:
        print("[Build Advertencia] pywebview no está en el entorno actual. Se recomienda instalarlo.")
    return True


def build_executable():
    """Ejecuta PyInstaller con las opciones óptimas para Windows."""
    print("=" * 60)
    print(" Compilando GeoLocator en un ejecutable (.exe) autónomo")
    print("=" * 60)

    if not check_prerequisites():
        sys.exit(1)

    # Detener cualquier instancia previa de GeoLocator para liberar el archivo ejecutable
    if os.name == 'nt':
        subprocess.run(["taskkill", "/F", "/IM", "GeoLocator.exe"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Separador de add-data en Windows es ';'
    add_data_arg = f"{STATIC_DIR};static"

    pyinstaller_cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=GeoLocator",
        "--onefile",
        "--noconsole",
        f"--add-data={add_data_arg}",
        "--clean",
        "--noconfirm",
        MAIN_SCRIPT
    ]

    print("[Build] Ejecutando comando:", " ".join(pyinstaller_cmd))
    result = subprocess.run(pyinstaller_cmd, cwd=BASE_DIR)

    if result.returncode == 0:
        exe_path = os.path.join(DIST_DIR, "GeoLocator.exe")
        if os.path.exists(exe_path):
            size_mb = os.path.getsize(exe_path) / (1024 * 1024)
            print("=" * 60)
            print(f"[Build ÉXITO] ¡Ejecutable generado con éxito!")
            print(f"Ruta: {exe_path}")
            print(f"Tamaño: {size_mb:.2f} MB")
            print("=" * 60)
            return True
        else:
            print("[Build Error] El proceso finalizó pero no se encontró GeoLocator.exe en dist/")
            return False
    else:
        print(f"[Build Error] PyInstaller finalizó con código de error {result.returncode}")
        return False


if __name__ == "__main__":
    success = build_executable()
    if not success:
        sys.exit(1)
