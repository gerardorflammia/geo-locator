# 📍 GeoLocator - Localizador de Coordenadas en Mapa

Aplicación ejecutable de escritorio para Windows que permite ubicar y consultar coordenadas geográficas (Latitud y Longitud) en mapas interactivos utilizando la **Google Maps JavaScript API** y **OpenStreetMap**.

La aplicación funciona de forma 100% local en la computadora del usuario (la propia PC actúa como servidor local seguro `127.0.0.1`), ofreciendo una interfaz gráfica moderna sin depender de servidores externos.

---

## 🚀 Formas de Ejecución

En esta carpeta (`C:\Users\Gamer\Documents\SCRIPT COORDENADAS\`) dispones de dos opciones:

1. **Ejecutable Directo (Recomendado)**:
   - Haz doble clic sobre **`GeoLocator.exe`** (o `dist\GeoLocator.exe`).
   - Se abrirá la ventana gráfica de escritorio autónoma de inmediato.

2. **Lanzador por Lotes (`run.bat`)**:
   - Haz doble clic sobre **`run.bat`**.

---

## 🌟 Características Principales

- **Buscador Inteligente de Coordenadas**:
  - Acepta coordenadas combinadas pegadas directamente:
    - Decimales: `10.4806, -66.9036` o `10.4806 -66.9036`
    - Con hemisferio: `10.4806 N, 66.9036 W`
    - Grados, Minutos y Segundos (DMS): `10° 28' 50.16" N, 66° 54' 12.96" W`
    - Con etiquetas: `lat: 10.4806, lng: -66.9036`
  - Campos individuales de Latitud (-90 a 90) y Longitud (-180 a 180).

- **🎯 Botón "Mi Ubicación"**:
  - Detecta tu ubicación actual mediante el sensor GPS/Wi-Fi (`navigator.geolocation`).
  - Muestra un círculo animado de radio de precisión en metros.
  - Cuenta con respaldo inteligente por IP si el GPS no está disponible.

- **🗺️ Motor Dual de Mapas**:
  - **Google Maps JavaScript API**: Soporta capas oficiales de Google (Calles y Satélite Híbrido HD) y Geocodificación oficial mediante clave de API.
  - **OpenStreetMap (Leaflet)**: Motor 100% gratuito y listo para usar inmediatamente con capas de Calles y Satélite Google de alta resolución sin errores de visualización.
  - Conmutador de un clic para alternar entre ambos motores sin perder las coordenadas seleccionadas.

- **📍 Marcador Interactivo**:
  - Haz clic en cualquier parte del mapa para colocar o mover el marcador.
  - Arrastra el marcador (`draggable`) para ajustar la posición milimétricamente en tiempo real.
  - Consulta la dirección postal aproximada del punto seleccionado.

- **📋 Portapapeles con un Solo Clic**:
  - Copia las coordenadas en formato Grados Decimales (DD) o Grados Minutos Segundos (DMS) con confirmación visual tipo *toast*.

- **⭐ Lugares Favoritos**:
  - Guarda tus coordenadas frecuentes con nombres personalizados (ej. "Oficina", "Bodega", "Hogar").
  - Salta a cualquier favorito guardado con un clic.

- **⚙️ Gestor de Google Maps API Key**:
  - Ventana modal integrada para introducir o actualizar tu clave de Google Cloud Console. Se guarda localmente y de forma segura en tu equipo (excluido de git por seguridad).

---

## 🛠️ Estructura del Proyecto

```text
C:\Users\Gamer\Documents\SCRIPT COORDENADAS\
│
├── GeoLocator.exe          # Ejecutable principal autónomo para Windows
├── run.bat                 # Script de arranque rápido
├── main.py                 # Punto de entrada de la aplicación y ventana WebView2
├── server.py               # Servidor local embebido en 127.0.0.1
├── build_exe.py            # Script automatizado de compilación con PyInstaller
├── requirements.txt        # Dependencias de Python (pywebview, pyinstaller)
├── test_app.py             # Pruebas automatizadas de servidor y archivos
├── test_coords.js          # Pruebas del parser de coordenadas
├── README.md               # Documentación en inglés
├── README_ES.md            # Documentación en español
│
├── dist/
│   └── GeoLocator.exe      # Binario compilado
│
└── static/                 # Recursos de la Interfaz Gráfica (Frontend)
    ├── index.html          # Estructura de la aplicación web local
    ├── css/
    │   └── style.css       # Estilos visuales modernos
    └── js/
        ├── app.js              # Controlador principal y gestión de estado
        ├── config.example.js   # Plantilla para configuración de Google Maps API Key
        ├── gmaps_engine.js     # Adaptador para Google Maps JavaScript API
        └── leaflet_engine.js   # Adaptador para Leaflet / OpenStreetMap
```

---

## 🧪 Pruebas y Verificación

Para ejecutar la suite de pruebas unitarias:
```bash
python test_app.py
node test_coords.js
```
Ambas suites validan el arranque del servidor local, la disponibilidad de los endpoints HTTP, la correcta carga de assets y la precisión matemática del conversor de coordenadas.
