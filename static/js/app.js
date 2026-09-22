/**
 * app.js - Orquestador Principal de GeoLocator Pro
 * Controla:
 * - Parser inteligente de coordenadas (DD, DMS, hemisferios)
 * - Búsqueda predictiva de lugares y direcciones (Geocoding)
 * - Detección de elevación sobre el nivel del mar
 * - Capas HD (Satélite, Dark, Positron, Topo) y tráfico
 * - Herramienta de medición de distancias (Regla interactiva)
 * - Círculo de radio de alcance dinámico
 * - Mira central de precisión (Crosshair)
 * - Seguimiento de coordenadas en vivo bajo el cursor
 * - Generador de Código QR y enlaces móviles (Google Maps, Waze)
 * - Exportador geográfico (GeoJSON, KML, GPX)
 * - Gestión de favoritos y clave de Google Maps API
 */

(function () {
  'use strict';

  // Estado global de la aplicación
  const state = {
    currentEngine: null, // 'leaflet' o 'gmaps'
    currentLayer: 'streets',
    lat: 10.4806,             // Coordenada inicial por defecto (Caracas)
    lng: -66.9036,
    zoom: 14,
    apiKey: (window.APP_CONFIG && window.APP_CONFIG.GOOGLE_MAPS_API_KEY && window.APP_CONFIG.GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE')
      ? window.APP_CONFIG.GOOGLE_MAPS_API_KEY
      : (localStorage.getItem('geolocator_gmaps_key') || ''),
    favorites: JSON.parse(localStorage.getItem('geolocator_favorites') || '[]'),
    isRulerActive: false,
    isRadiusActive: false,
    radiusMeters: 1000,
  };

  // Referencias a elementos del DOM
  const dom = {
    // Inputs de Coordenadas
    unifiedInput: document.getElementById('unified-coords-input'),
    btnParseUnified: document.getElementById('btn-parse-unified'),
    inputLat: document.getElementById('input-latitude'),
    inputLng: document.getElementById('input-longitude'),
    btnLocateCoords: document.getElementById('btn-locate-coords'),
    btnMyLocation: document.getElementById('btn-my-location'),

    // Visualizadores de Punto Activo
    displayDecimal: document.getElementById('display-decimal-coords'),
    displayDms: document.getElementById('display-dms-coords'),
    displayElevation: document.getElementById('display-elevation'),
    displayAddress: document.getElementById('display-address'),
    btnCopyDecimal: document.getElementById('btn-copy-decimal'),
    btnCopyDms: document.getElementById('btn-copy-dms'),
    btnQuickCopy: document.getElementById('btn-quick-copy'),

    // Enlaces Móviles y QR
    btnOpenGoogleWeb: document.getElementById('btn-open-google-web'),
    btnOpenWaze: document.getElementById('btn-open-waze'),
    btnShowQr: document.getElementById('btn-show-qr'),

    // Herramientas Geográficas
    toggleRadiusCircle: document.getElementById('toggle-radius-circle'),
    radiusSliderGroup: document.getElementById('radius-slider-group'),
    inputRadiusSlider: document.getElementById('input-radius-slider'),
    radiusValText: document.getElementById('radius-val-text'),

    toggleRulerTool: document.getElementById('toggle-ruler-tool'),
    rulerInfoBox: document.getElementById('ruler-info-box'),
    rulerDistanceText: document.getElementById('ruler-distance-text'),
    btnClearRuler: document.getElementById('btn-clear-ruler'),

    toggleCrosshair: document.getElementById('toggle-crosshair'),
    mapCrosshair: document.getElementById('map-crosshair'),
    mouseCoordsBar: document.getElementById('mouse-coords-bar'),

    // Capas HD
    btnLayerMenu: document.getElementById('btn-layer-menu'),
    layerDropdown: document.getElementById('layer-dropdown'),
    activeLayerName: document.getElementById('active-layer-name'),
    trafficToggleRow: document.getElementById('traffic-toggle-row'),
    toggleTraffic: document.getElementById('toggle-traffic'),

    // Motores y Botones de Barra Superior
    btnEngineGmaps: document.getElementById('btn-engine-gmaps'),
    btnEngineLeaflet: document.getElementById('btn-engine-leaflet'),
    btnMapCenterPin: document.getElementById('btn-map-center-pin'),

    // Favoritos
    btnOpenFavorites: document.getElementById('btn-open-favorites'),
    btnSaveFavorite: document.getElementById('btn-save-favorite'),
    favCountBadge: document.getElementById('fav-count-badge'),
    modalFavorites: document.getElementById('modal-favorites'),
    btnCloseFavorites: document.getElementById('btn-close-favorites'),
    btnCloseFavFooter: document.getElementById('btn-close-fav-footer'),
    favoritesList: document.getElementById('favorites-list'),
    btnClearAllFavs: document.getElementById('btn-clear-all-favs'),

    // Exportación
    btnOpenExport: document.getElementById('btn-open-export'),
    modalExport: document.getElementById('modal-export'),
    btnCloseExport: document.getElementById('btn-close-export'),
    btnCloseExportFooter: document.getElementById('btn-close-export-footer'),
    btnExportGeojson: document.getElementById('btn-export-geojson'),
    btnExportKml: document.getElementById('btn-export-kml'),
    btnExportGpx: document.getElementById('btn-export-gpx'),

    // Código QR
    modalQr: document.getElementById('modal-qr'),
    btnCloseQr: document.getElementById('btn-close-qr'),
    btnCloseQrFooter: document.getElementById('btn-close-qr-footer'),
    qrImage: document.getElementById('qr-image'),
    qrCoordsText: document.getElementById('qr-coords-text'),

    // Configuración API Key
    btnOpenSettings: document.getElementById('btn-open-settings'),
    modalSettings: document.getElementById('modal-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    inputGmapsKey: document.getElementById('input-gmaps-key'),
    btnSaveKey: document.getElementById('btn-save-key'),
    btnClearKey: document.getElementById('btn-clear-key'),
    keyStatusText: document.getElementById('key-status-text'),

    // Contenedores
    mapContainer: document.getElementById('map-container'),
    toastContainer: document.getElementById('toast-container'),
  };

  // -------------------------------------------------------------
  // 1. Parser y Formateador Matemático de Coordenadas
  // -------------------------------------------------------------

  function decimalToDms(dec, isLat) {
    const direction = isLat
      ? (dec >= 0 ? 'N' : 'S')
      : (dec >= 0 ? 'E' : 'W');
    const absVal = Math.abs(dec);
    const degrees = Math.floor(absVal);
    const minutesNotTruncated = (absVal - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
  }

  function dmsToDecimal(dmsStr) {
    const match = dmsStr.match(/(\d+(?:\.\d+)?)\s*°?\s*(\d+(?:\.\d+)?)?\s*'?\s*(\d+(?:\.\d+)?)?\s*"?\s*([NSEWnsew])?/);
    if (!match) return null;

    const deg = parseFloat(match[1]) || 0;
    const min = parseFloat(match[2]) || 0;
    const sec = parseFloat(match[3]) || 0;
    const hemisphere = (match[4] || '').toUpperCase();

    let dd = deg + (min / 60) + (sec / 3600);
    if (hemisphere === 'S' || hemisphere === 'W') {
      dd = -dd;
    }
    return dd;
  }

  function parseCoordinatesString(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let text = raw.trim();

    // Eliminar etiquetas y prefijos comunes: "lat:", "latitude:", "lng:", "lon:", "long:"
    text = text.replace(/(?:lat(?:itude)?|lng|lon(?:gitude)?)\s*[:=]?\s*/gi, '');

    // 1. Decimales con comas, punto y comas o espacios
    const ddRegex = /^(-?\d{1,2}(?:\.\d+)?)[,\s;]+(-?\d{1,3}(?:\.\d+)?)$/;
    const ddMatch = text.match(ddRegex);
    if (ddMatch) {
      const lat = parseFloat(ddMatch[1]);
      const lng = parseFloat(ddMatch[2]);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }

    // 2. Con hemisferio
    const hemiRegex = /(\d{1,2}(?:\.\d+)?)\s*([NSns])[,\s;]+(\d{1,3}(?:\.\d+)?)\s*([EWew])/;
    const hemiMatch = text.match(hemiRegex);
    if (hemiMatch) {
      let lat = parseFloat(hemiMatch[1]);
      if (hemiMatch[2].toUpperCase() === 'S') lat = -lat;
      let lng = parseFloat(hemiMatch[3]);
      if (hemiMatch[4].toUpperCase() === 'W') lng = -lng;
      if (isValidCoord(lat, lng)) return { lat, lng };
    }

    // 3. Formato Grados Minutos Segundos (DMS)
    const parts = text.split(/[,;\/]+/);
    if (parts.length === 2) {
      const latDd = dmsToDecimal(parts[0].trim());
      const lngDd = dmsToDecimal(parts[1].trim());
      if (latDd !== null && lngDd !== null && isValidCoord(latDd, lngDd)) {
        return { lat: latDd, lng: lngDd };
      }
    }

    return null;
  }

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  // -------------------------------------------------------------
  // 2. Actualización de Interfaz y Displays
  // -------------------------------------------------------------

  function updateUiDisplays(lat, lng) {
    state.lat = lat;
    state.lng = lng;

    // Campos de input
    dom.inputLat.value = lat.toFixed(6);
    dom.inputLng.value = lng.toFixed(6);
    dom.unifiedInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    // Displays
    dom.displayDecimal.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const dmsLat = decimalToDms(lat, true);
    const dmsLng = decimalToDms(lng, false);
    dom.displayDms.textContent = `${dmsLat}, ${dmsLng}`;

    // Consultar elevación
    fetchElevation(lat, lng);
  }

  function getActiveEngine() {
    return state.currentEngine === 'gmaps' ? window.GoogleMapsEngine : window.LeafletEngine;
  }

  // -------------------------------------------------------------
  // 3. Elevación sobre el Nivel del Mar
  // -------------------------------------------------------------

  function fetchElevation(lat, lng) {
    dom.displayElevation.textContent = "Calculando...";
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}`;
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data && data.elevation && data.elevation.length > 0) {
          const meters = Math.round(data.elevation[0]);
          const feet = Math.round(meters * 3.28084);
          dom.displayElevation.textContent = `${meters} m sobre el nivel del mar (${feet} ft)`;
        } else {
          dom.displayElevation.textContent = "Elevación no disponible para este punto.";
        }
      })
      .catch(() => {
        dom.displayElevation.textContent = "Sin datos de altitud.";
      });
  }

  // -------------------------------------------------------------
  // 4. Conmutación de Motores y Capas HD
  // -------------------------------------------------------------

  async function switchEngine(targetEngine) {
    if (targetEngine === 'gmaps' && !state.apiKey) {
      showToast('Introduce tu Google Maps API Key para activar este motor.', 'warning');
      openSettingsModal();
      return;
    }

    // Si ya estamos en este motor, no re-inicializar para evitar saltos
    if (targetEngine === state.currentEngine) {
      return;
    }

    // Capturar la posición actual del motor saliente para no perderla
    const previousEngine = getActiveEngine();
    if (previousEngine && previousEngine.getPosition) {
      const pos = previousEngine.getPosition();
      if (pos && isValidCoord(pos.lat, pos.lng)) {
        state.lat = pos.lat;
        state.lng = pos.lng;
      }
      previousEngine.destroy();
    }

    state.currentEngine = targetEngine;
    dom.mapContainer.innerHTML = '';

    if (targetEngine === 'gmaps') {
      dom.btnEngineGmaps.classList.add('active');
      dom.btnEngineLeaflet.classList.remove('active');
      dom.trafficToggleRow.classList.remove('hidden');

      try {
        await window.GoogleMapsEngine.init(
          'map-container',
          state.lat,
          state.lng,
          state.zoom,
          onMapPositionChanged,
          onMouseMoveMap,
          onRulerDistanceUpdated,
          state.apiKey
        );
        showToast('Google Maps inicializado correctamente.', 'success');
      } catch (err) {
        showToast(`Error al cargar Google Maps: ${err.message}. Volviendo a OpenStreetMap...`, 'error');
        state.currentEngine = null; // Para permitir el retorno forzado a leaflet
        switchEngine('leaflet');
        return;
      }
    } else {
      dom.btnEngineLeaflet.classList.add('active');
      dom.btnEngineGmaps.classList.remove('active');
      dom.trafficToggleRow.classList.add('hidden');

      window.LeafletEngine.init(
        'map-container',
        state.lat,
        state.lng,
        state.zoom,
        onMapPositionChanged,
        onMouseMoveMap,
        onRulerDistanceUpdated
      );
      showToast('Modo OpenStreetMap activo.', 'info');
    }

    // Restaurar capa y radio sin provocar saltos bruscos
    getActiveEngine().setLayer(state.currentLayer);
    getActiveEngine().setRadiusCircle(state.isRadiusActive, state.radiusMeters);
    getActiveEngine().reverseGeocode(state.lat, state.lng);
  }

  function onMapPositionChanged(newLat, newLng, fromInteraction) {
    updateUiDisplays(newLat, newLng);
    if (fromInteraction) {
      showToast(`Coordenadas: ${newLat.toFixed(5)}, ${newLng.toFixed(5)}`, 'info');
    }
  }

  function onMouseMoveMap(lat, lng) {
    dom.mouseCoordsBar.textContent = `Lat: ${lat.toFixed(6)} | Lng: ${lng.toFixed(6)}`;
  }

  function onRulerDistanceUpdated(totalMeters, pointsCount) {
    if (pointsCount === 0) {
      dom.rulerDistanceText.textContent = "Haz clic en 2 o más puntos para medir distancia";
    } else if (pointsCount === 1) {
      dom.rulerDistanceText.textContent = "Punto inicial marcado. Haz clic en el segundo punto.";
    } else {
      const km = (totalMeters / 1000).toFixed(2);
      const m = Math.round(totalMeters);
      dom.rulerDistanceText.textContent = `Distancia total: ${m.toLocaleString()} m (${km} km) en ${pointsCount} puntos`;
    }
  }

  window.onGoogleMapsAuthError = function () {
    showToast('La clave de Google Maps no es válida o ha sido rechazada. Conmutando a OpenStreetMap.', 'error');
    switchEngine('leaflet');
  };

  // -------------------------------------------------------------
  // 6. Acciones de Usuario: Ubicación y Geolocalización
  // -------------------------------------------------------------

  function handleLocateFromInputs() {
    const lat = parseFloat(dom.inputLat.value);
    const lng = parseFloat(dom.inputLng.value);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      showToast('Latitud inválida (-90 a 90).', 'warning');
      dom.inputLat.focus();
      return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      showToast('Longitud inválida (-180 a 180).', 'warning');
      dom.inputLng.focus();
      return;
    }

    updateUiDisplays(lat, lng);
    getActiveEngine().setPosition(lat, lng, 15, true);
    showToast(`Punto ubicado: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'success');
  }

  function handleLocateFromUnified() {
    const raw = dom.unifiedInput.value;
    if (!raw.trim()) {
      showToast('Por favor, ingresa o pega unas coordenadas primero.', 'warning');
      return;
    }

    const parsed = parseCoordinatesString(raw);
    if (!parsed) {
      showToast('No se reconoció el formato de coordenadas. Ej: "10.4806, -66.9036" o DMS.', 'error');
      return;
    }

    updateUiDisplays(parsed.lat, parsed.lng);
    getActiveEngine().setPosition(parsed.lat, parsed.lng, 15, true);
    showToast(`Ubicado: ${parsed.lat.toFixed(6)}, ${parsed.lng.toFixed(6)}`, 'success');
  }

  function handleMyLocation() {
    showToast('Detectando tu ubicación actual...', 'info');

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy;

          updateUiDisplays(lat, lng);
          getActiveEngine().showUserAccuracy(lat, lng, accuracy);
          showToast(`¡Ubicación encontrada! Precisión: ±${Math.round(accuracy)}m`, 'success');
        },
        (err) => {
          console.warn('[GeoLocator] Geolocation API falló:', err.message);
          locateByIpFallback();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      locateByIpFallback();
    }
  }

  function locateByIpFallback() {
    showToast('Consultando geolocalización de red por IP...', 'info');
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data && data.latitude && data.longitude) {
          const lat = data.latitude;
          const lng = data.longitude;
          updateUiDisplays(lat, lng);
          getActiveEngine().showUserAccuracy(lat, lng, 3000);
          showToast(`Ubicación aproximada: ${data.city || ''}, ${data.country_name || ''}`, 'success');
        } else {
          showToast('No fue posible determinar la ubicación por IP.', 'warning');
        }
      })
      .catch(() => {
        showToast('No se pudo obtener la ubicación.', 'error');
      });
  }

  // -------------------------------------------------------------
  // 7. Portapapeles y Enlaces Rápidos
  // -------------------------------------------------------------

  function copyToClipboard(text, description) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast(`${description} copiado al portapapeles.`, 'success'))
        .catch(() => fallbackCopy(text, description));
    } else {
      fallbackCopy(text, description);
    }
  }

  function fallbackCopy(text, description) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast(`${description} copiado al portapapeles.`, 'success');
    } catch {
      showToast('No se pudo copiar automáticamente.', 'error');
    }
    document.body.removeChild(textarea);
  }

  function openGoogleMapsWeb() {
    const url = `https://www.google.com/maps?q=${state.lat},${state.lng}`;
    window.open(url, '_blank');
  }

  function openWaze() {
    const url = `https://waze.com/ul?ll=${state.lat},${state.lng}&navigate=yes`;
    window.open(url, '_blank');
  }

  function showQrModal() {
    const mapUrl = `https://maps.google.com/?q=${state.lat},${state.lng}`;
    dom.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mapUrl)}`;
    dom.qrCoordsText.textContent = `${state.lat.toFixed(6)}, ${state.lng.toFixed(6)}`;
    dom.modalQr.classList.remove('hidden');
  }

  // -------------------------------------------------------------
  // 8. Exportación Geográfica (GeoJSON, KML, GPX)
  // -------------------------------------------------------------

  function triggerDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Archivo "${filename}" descargado con éxito.`, 'success');
  }

  function exportGeoJson() {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [state.lng, state.lat]
          },
          properties: {
            name: "Punto Activo GeoLocator",
            latitude: state.lat,
            longitude: state.lng,
            dms: `${decimalToDms(state.lat, true)}, ${decimalToDms(state.lng, false)}`,
            date: new Date().toISOString()
          }
        },
        ...state.favorites.map(fav => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [fav.lng, fav.lat]
          },
          properties: {
            name: fav.name,
            latitude: fav.lat,
            longitude: fav.lng,
            date: fav.date
          }
        }))
      ]
    };
    triggerDownload(`geolocator_export_${Date.now()}.geojson`, JSON.stringify(geojson, null, 2), "application/json");
  }

  function exportKml() {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>GeoLocator Export</name>
    <Placemark>
      <name>Punto Seleccionado</name>
      <description>Lat: ${state.lat}, Lng: ${state.lng}</description>
      <Point>
        <coordinates>${state.lng},${state.lat},0</coordinates>
      </Point>
    </Placemark>
    ${state.favorites.map(fav => `
    <Placemark>
      <name>${escapeXml(fav.name)}</name>
      <description>${fav.date}</description>
      <Point>
        <coordinates>${fav.lng},${fav.lat},0</coordinates>
      </Point>
    </Placemark>`).join('')}
  </Document>
</kml>`;
    triggerDownload(`geolocator_export_${Date.now()}.kml`, kml, "application/vnd.google-earth.kml+xml");
  }

  function exportGpx() {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GeoLocator Pro" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="${state.lat}" lon="${state.lng}">
    <name>Punto Activo</name>
    <desc>${decimalToDms(state.lat, true)}, ${decimalToDms(state.lng, false)}</desc>
  </wpt>
  ${state.favorites.map(fav => `
  <wpt lat="${fav.lat}" lon="${fav.lng}">
    <name>${escapeXml(fav.name)}</name>
  </wpt>`).join('')}
</gpx>`;
    triggerDownload(`geolocator_export_${Date.now()}.gpx`, gpx, "application/gpx+xml");
  }

  function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }

  // -------------------------------------------------------------
  // 9. Favoritos y Almacenamiento Local
  // -------------------------------------------------------------

  function updateFavoritesBadge() {
    dom.favCountBadge.textContent = state.favorites.length;
  }

  function saveCurrentFavorite() {
    const defaultName = `Punto (${state.lat.toFixed(4)}, ${state.lng.toFixed(4)})`;
    const label = prompt('Nombre o etiqueta para este lugar:', defaultName);
    if (!label) return;

    const newFav = {
      id: Date.now(),
      name: label.trim(),
      lat: state.lat,
      lng: state.lng,
      date: new Date().toLocaleDateString('es-ES')
    };

    state.favorites.unshift(newFav);
    localStorage.setItem('geolocator_favorites', JSON.stringify(state.favorites));
    updateFavoritesBadge();
    showToast(`Lugar "${newFav.name}" guardado.`, 'success');
  }

  function renderFavoritesList() {
    if (state.favorites.length === 0) {
      dom.favoritesList.innerHTML = `
        <div class="empty-state">
          <p>No tienes lugares guardados todavía.</p>
          <span class="input-hint">Ubica cualquier punto en el mapa y haz clic en "Guardar en Favoritos".</span>
        </div>
      `;
      return;
    }

    dom.favoritesList.innerHTML = state.favorites.map(fav => `
      <div class="favorite-item">
        <div class="favorite-info">
          <span class="favorite-name">${escapeHtml(fav.name)}</span>
          <span class="favorite-coords font-mono">${fav.lat.toFixed(6)}, ${fav.lng.toFixed(6)} • ${fav.date}</span>
        </div>
        <div class="favorite-actions">
          <button class="btn-sm btn-primary" onclick="window.GeoApp.goToFavorite(${fav.lat}, ${fav.lng})">
            Ir
          </button>
          <button class="btn-sm btn-secondary" onclick="window.GeoApp.deleteFavorite(${fav.id})" title="Eliminar">
            &times;
          </button>
        </div>
      </div>
    `).join('');
  }

  function goToFavorite(lat, lng) {
    dom.modalFavorites.classList.add('hidden');
    updateUiDisplays(lat, lng);
    getActiveEngine().setPosition(lat, lng, 16, true);
    showToast(`Ubicando lugar (${lat.toFixed(5)}, ${lng.toFixed(5)})`, 'info');
  }

  function deleteFavorite(id) {
    state.favorites = state.favorites.filter(f => f.id !== id);
    localStorage.setItem('geolocator_favorites', JSON.stringify(state.favorites));
    updateFavoritesBadge();
    renderFavoritesList();
  }

  function clearAllFavorites() {
    if (confirm('¿Estás seguro de que deseas borrar todos los favoritos?')) {
      state.favorites = [];
      localStorage.removeItem('geolocator_favorites');
      updateFavoritesBadge();
      renderFavoritesList();
      showToast('Se han eliminado todos los favoritos.', 'info');
    }
  }

  // -------------------------------------------------------------
  // 10. Modales y Configuración de API Key
  // -------------------------------------------------------------

  function openSettingsModal() {
    dom.inputGmapsKey.value = state.apiKey;
    updateKeyStatusDisplay();
    dom.modalSettings.classList.remove('hidden');
  }

  function updateKeyStatusDisplay() {
    if (state.apiKey) {
      dom.keyStatusText.textContent = `Estado: Clave registrada (${state.apiKey.substring(0, 6)}...${state.apiKey.slice(-4)})`;
      dom.keyStatusText.style.color = '#10b981';
    } else {
      dom.keyStatusText.textContent = 'Estado: No configurada (usando OpenStreetMap)';
      dom.keyStatusText.style.color = '#94a3b8';
    }
  }

  function saveApiKey() {
    const key = dom.inputGmapsKey.value.trim();
    if (!key) {
      showToast('Por favor, ingresa una clave válida.', 'warning');
      return;
    }
    state.apiKey = key;
    localStorage.setItem('geolocator_gmaps_key', key);
    updateKeyStatusDisplay();
    dom.modalSettings.classList.add('hidden');
    showToast('API Key guardada. Conmutando a Google Maps...', 'success');
    switchEngine('gmaps');
  }

  function clearApiKey() {
    state.apiKey = '';
    localStorage.removeItem('geolocator_gmaps_key');
    dom.inputGmapsKey.value = '';
    updateKeyStatusDisplay();
    showToast('API Key eliminada. Usando OpenStreetMap.', 'info');
    switchEngine('leaflet');
  }

  // -------------------------------------------------------------
  // 11. Notificaciones Toast y Helpers
  // -------------------------------------------------------------

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    }, 3200);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // -------------------------------------------------------------
  // 12. Enlace de Eventos y Arranque
  // -------------------------------------------------------------

  function bindEvents() {
    // Cerrar menú de capas al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!dom.btnLayerMenu.contains(e.target) && !dom.layerDropdown.contains(e.target)) {
        dom.layerDropdown.classList.add('hidden');
      }
    });

    // Inputs de Coordenadas
    dom.btnLocateCoords.addEventListener('click', handleLocateFromInputs);
    dom.btnParseUnified.addEventListener('click', handleLocateFromUnified);
    dom.unifiedInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLocateFromUnified();
    });
    dom.inputLat.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLocateFromInputs();
    });
    dom.inputLng.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLocateFromInputs();
    });

    // Geolocalización
    dom.btnMyLocation.addEventListener('click', handleMyLocation);

    // Portapapeles
    dom.btnCopyDecimal.addEventListener('click', () => {
      copyToClipboard(`${state.lat.toFixed(6)}, ${state.lng.toFixed(6)}`, 'Coordenadas decimales');
    });
    dom.btnCopyDms.addEventListener('click', () => {
      const dms = `${decimalToDms(state.lat, true)}, ${decimalToDms(state.lng, false)}`;
      copyToClipboard(dms, 'Coordenadas DMS');
    });
    dom.btnQuickCopy.addEventListener('click', () => {
      copyToClipboard(`${state.lat.toFixed(6)}, ${state.lng.toFixed(6)}`, 'Coordenadas');
    });

    // Enlaces Móviles y QR
    dom.btnOpenGoogleWeb.addEventListener('click', openGoogleMapsWeb);
    dom.btnOpenWaze.addEventListener('click', openWaze);
    dom.btnShowQr.addEventListener('click', showQrModal);
    dom.btnCloseQr.addEventListener('click', () => dom.modalQr.classList.add('hidden'));
    dom.btnCloseQrFooter.addEventListener('click', () => dom.modalQr.classList.add('hidden'));

    // Selector Flotante de Capas HD
    dom.btnLayerMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.layerDropdown.classList.toggle('hidden');
    });

    dom.layerDropdown.querySelectorAll('.layer-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const layerKey = opt.dataset.layer;
        dom.layerDropdown.querySelectorAll('.layer-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        state.currentLayer = layerKey;
        dom.activeLayerName.textContent = opt.textContent.split(' ')[1] || opt.textContent;
        getActiveEngine().setLayer(layerKey);
        dom.layerDropdown.classList.add('hidden');
        showToast(`Capa cambiada: ${opt.textContent}`, 'info');
      });
    });

    dom.toggleTraffic.addEventListener('change', (e) => {
      if (window.GoogleMapsEngine && state.currentEngine === 'gmaps') {
        window.GoogleMapsEngine.setTraffic(e.target.checked);
      }
    });

    // Herramientas Geográficas: Radio
    dom.toggleRadiusCircle.addEventListener('change', (e) => {
      state.isRadiusActive = e.target.checked;
      dom.radiusSliderGroup.classList.toggle('hidden', !state.isRadiusActive);
      getActiveEngine().setRadiusCircle(state.isRadiusActive, state.radiusMeters);
    });

    dom.inputRadiusSlider.addEventListener('input', (e) => {
      state.radiusMeters = parseInt(e.target.value, 10);
      const label = state.radiusMeters >= 1000
        ? `${(state.radiusMeters / 1000).toFixed(1)} km`
        : `${state.radiusMeters} m`;
      dom.radiusValText.textContent = label;
      getActiveEngine().setRadiusCircle(true, state.radiusMeters);
    });

    // Herramientas Geográficas: Regla
    dom.toggleRulerTool.addEventListener('change', (e) => {
      state.isRulerActive = e.target.checked;
      dom.rulerInfoBox.classList.toggle('hidden', !state.isRulerActive);
      getActiveEngine().setRulerActive(state.isRulerActive);
      if (state.isRulerActive) {
        showToast('Modo regla activo. Haz clic sobre el mapa para medir distancias.', 'info');
      }
    });

    dom.btnClearRuler.addEventListener('click', () => {
      getActiveEngine().clearMeasurements();
    });

    // Herramientas Geográficas: Mira Central
    dom.toggleCrosshair.addEventListener('change', (e) => {
      dom.mapCrosshair.classList.toggle('hidden', !e.target.checked);
    });

    // Centrar en Pin
    dom.btnMapCenterPin.addEventListener('click', () => {
      getActiveEngine().centerOnMarker();
    });

    // Motores de Mapa
    dom.btnEngineGmaps.addEventListener('click', () => switchEngine('gmaps'));
    dom.btnEngineLeaflet.addEventListener('click', () => switchEngine('leaflet'));

    // Exportación
    dom.btnOpenExport.addEventListener('click', () => dom.modalExport.classList.remove('hidden'));
    dom.btnCloseExport.addEventListener('click', () => dom.modalExport.classList.add('hidden'));
    dom.btnCloseExportFooter.addEventListener('click', () => dom.modalExport.classList.add('hidden'));
    dom.btnExportGeojson.addEventListener('click', exportGeoJson);
    dom.btnExportKml.addEventListener('click', exportKml);
    dom.btnExportGpx.addEventListener('click', exportGpx);

    // Favoritos
    dom.btnOpenFavorites.addEventListener('click', () => {
      renderFavoritesList();
      dom.modalFavorites.classList.remove('hidden');
    });
    dom.btnSaveFavorite.addEventListener('click', saveCurrentFavorite);
    dom.btnCloseFavorites.addEventListener('click', () => dom.modalFavorites.classList.add('hidden'));
    dom.btnCloseFavFooter.addEventListener('click', () => dom.modalFavorites.classList.add('hidden'));
    dom.btnClearAllFavs.addEventListener('click', clearAllFavorites);

    // Configuración API Key
    dom.btnOpenSettings.addEventListener('click', openSettingsModal);
    dom.btnCloseSettings.addEventListener('click', () => dom.modalSettings.classList.add('hidden'));
    dom.btnSaveKey.addEventListener('click', saveApiKey);
    dom.btnClearKey.addEventListener('click', clearApiKey);

    // Clic fuera para modales
    [dom.modalSettings, dom.modalFavorites, dom.modalQr, dom.modalExport].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    });

    // Evitar que clics en controles flotantes o panel lateral penetren al mapa y desplacen el marcador
    document.querySelectorAll('.map-layer-selector, .map-floating-tools, .mouse-coords-bar, .sidebar-panel, .topbar, .modal-dialog').forEach(el => {
      ['click', 'mousedown', 'pointerdown', 'touchstart'].forEach(evt => {
        el.addEventListener(evt, (e) => e.stopPropagation());
      });
    });
  }

  function start() {
    bindEvents();
    updateFavoritesBadge();
    updateUiDisplays(state.lat, state.lng);

    if (state.apiKey) {
      switchEngine('gmaps');
    } else {
      switchEngine('leaflet');
    }
  }

  window.GeoApp = {
    goToFavorite,
    deleteFavorite
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
