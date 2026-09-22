/**
 * leaflet_engine.js - Adaptador avanzado para Leaflet / OpenStreetMap
 * Incluye 5 capas HD (Satélite, Dark, Positron, Topo), radio de alcance, regla de medición y mouse tracking.
 */

window.LeafletEngine = (function () {
  let map = null;
  let marker = null;
  let accuracyCircle = null;
  let radiusCircle = null;
  let activeRadiusMeters = 1000;
  let isRadiusEnabled = false;

  // Medición de distancias
  let isRulerActive = false;
  let rulerPoints = [];
  let rulerMarkers = [];
  let rulerPolyline = null;
  let onDistanceCallback = null;

  // Seguimiento de cursor
  let onMouseMoveCallback = null;

  // Capas de mosaico
  let layers = {};
  let currentLayerKey = 'streets';
  let onPositionChangeCallback = null;

  const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
  const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';

  function init(containerId, initialLat, initialLng, initialZoom, onPositionChange, onMouseMove, onDistanceUpdate) {
    onPositionChangeCallback = onPositionChange;
    onMouseMoveCallback = onMouseMove;
    onDistanceCallback = onDistanceUpdate;

    destroy();

    // 1. Definición de 5 Capas HD
    layers.streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    });

    layers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri'
    });

    layers.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    });

    layers.positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    });

    layers.topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; OpenStreetMap, SRTM | Map style: &copy; OpenTopoMap'
    });

    // Crear mapa
    map = L.map(containerId, {
      center: [initialLat, initialLng],
      zoom: initialZoom || 14,
      zoomControl: true,
      layers: [layers[currentLayerKey] || layers.streets]
    });

    // Marcador principal
    marker = L.marker([initialLat, initialLng], {
      draggable: true,
      title: "Arrastra para ajustar posición"
    }).addTo(map);

    // Eventos de arrastre
    marker.on('dragend', function (event) {
      const pos = event.target.getLatLng();
      if (radiusCircle) radiusCircle.setLatLng(pos);
      if (onPositionChangeCallback) {
        onPositionChangeCallback(pos.lat, pos.lng, true);
      }
    });

    // Clic en el mapa (modo normal vs modo regla)
    map.on('click', function (event) {
      if (isRulerActive) {
        addRulerPoint(event.latlng);
        return;
      }

      // Prevenir clics accidentales si el evento vino de un control overlay
      const target = event.originalEvent ? event.originalEvent.target : null;
      if (target && target.closest('.map-floating-tools, .map-layer-selector, .mouse-coords-bar, .modal-backdrop, .sidebar-panel, .topbar')) {
        return;
      }

      const lat = event.latlng.lat;
      const lng = event.latlng.lng;
      setPosition(lat, lng, null, true, false);
      if (onPositionChangeCallback) {
        onPositionChangeCallback(lat, lng, true);
      }
    });

    // Movimiento del cursor para coordenadas en vivo
    map.on('mousemove', function (event) {
      if (onMouseMoveCallback) {
        onMouseMoveCallback(event.latlng.lat, event.latlng.lng);
      }
    });

    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 200);

    return true;
  }

  function setLayer(layerKey) {
    if (!map || !layers[layerKey]) return;

    // Remover capa activa
    if (layers[currentLayerKey]) {
      map.removeLayer(layers[currentLayerKey]);
    }

    map.addLayer(layers[layerKey]);
    currentLayerKey = layerKey;
    return layerKey;
  }

  function setPosition(lat, lng, zoom, fetchAddress, shouldPan = false) {
    if (!map || !marker) return;

    const newLatLng = L.latLng(lat, lng);
    marker.setLatLng(newLatLng);

    if (radiusCircle) {
      radiusCircle.setLatLng(newLatLng);
    }

    if (zoom) {
      map.setView(newLatLng, zoom);
    } else if (shouldPan) {
      map.panTo(newLatLng);
    }

    if (fetchAddress) {
      reverseGeocode(lat, lng);
    }
  }

  function getPosition() {
    if (!marker) return null;
    const pos = marker.getLatLng();
    return { lat: pos.lat, lng: pos.lng };
  }

  function centerOnMarker() {
    if (!map || !marker) return;
    map.panTo(marker.getLatLng());
  }

  // Control de Círculo de Radio de Alcance
  function setRadiusCircle(enabled, radiusMeters) {
    isRadiusEnabled = enabled;
    if (radiusMeters) activeRadiusMeters = radiusMeters;

    if (!enabled) {
      if (radiusCircle) {
        map.removeLayer(radiusCircle);
        radiusCircle = null;
      }
      return;
    }

    if (!map || !marker) return;

    const currentPos = marker.getLatLng();
    if (!radiusCircle) {
      radiusCircle = L.circle(currentPos, {
        radius: activeRadiusMeters,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.18,
        weight: 2,
        dashArray: '4, 4'
      }).addTo(map);
    } else {
      radiusCircle.setLatLng(currentPos);
      radiusCircle.setRadius(activeRadiusMeters);
    }
  }

  // Herramienta de Regla de Distancia
  function setRulerActive(active) {
    isRulerActive = active;
    if (!active) {
      clearMeasurements();
    }
  }

  function addRulerPoint(latlng) {
    rulerPoints.push(latlng);

    // Marcador de punto de medición
    const dot = L.circleMarker(latlng, {
      radius: 5,
      color: '#ef4444',
      fillColor: '#ffffff',
      fillOpacity: 1,
      weight: 2
    }).addTo(map);
    rulerMarkers.push(dot);

    // Trazar línea
    if (rulerPolyline) {
      map.removeLayer(rulerPolyline);
    }
    rulerPolyline = L.polyline(rulerPoints, {
      color: '#ef4444',
      weight: 3,
      dashArray: '6, 6'
    }).addTo(map);

    // Calcular distancia acumulada en metros
    let totalMeters = 0;
    for (let i = 0; i < rulerPoints.length - 1; i++) {
      totalMeters += rulerPoints[i].distanceTo(rulerPoints[i + 1]);
    }

    if (onDistanceCallback) {
      onDistanceCallback(totalMeters, rulerPoints.length);
    }
  }

  function clearMeasurements() {
    rulerPoints = [];
    if (rulerPolyline) {
      map.removeLayer(rulerPolyline);
      rulerPolyline = null;
    }
    rulerMarkers.forEach(m => map.removeLayer(m));
    rulerMarkers = [];
    if (onDistanceCallback) {
      onDistanceCallback(0, 0);
    }
  }

  function showUserAccuracy(lat, lng, accuracyMeters) {
    if (!map) return;

    if (accuracyCircle) {
      map.removeLayer(accuracyCircle);
    }

    accuracyCircle = L.circle([lat, lng], {
      radius: accuracyMeters || 50,
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.15,
      weight: 2
    }).addTo(map);

    setPosition(lat, lng, 16, true);
  }

  // Geocodificación Inversa
  function reverseGeocode(lat, lng) {
    const addressElement = document.getElementById('display-address');
    if (!addressElement) return;

    addressElement.textContent = "Consultando dirección geográfica...";

    const url = `${NOMINATIM_REVERSE}?format=jsonv2&lat=${lat}&lon=${lng}`;
    fetch(url, { headers: { 'Accept-Language': 'es' } })
      .then(res => res.json())
      .then(data => {
        if (data && data.display_name) {
          addressElement.textContent = data.display_name;
        } else {
          addressElement.textContent = "Coordenadas sin dirección postal registrada.";
        }
      })
      .catch(() => {
        addressElement.textContent = `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      });
  }

  // Búsqueda por Nombre / Dirección (Autocompletado)
  async function searchPlaces(query) {
    if (!query || query.length < 3) return [];
    try {
      const url = `${NOMINATIM_SEARCH}?format=jsonv2&q=${encodeURIComponent(query)}&limit=5`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
      const data = await res.json();
      return data.map(item => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));
    } catch {
      return [];
    }
  }

  function destroy() {
    clearMeasurements();
    if (radiusCircle) {
      map.removeLayer(radiusCircle);
      radiusCircle = null;
    }
    if (accuracyCircle) {
      map.removeLayer(accuracyCircle);
      accuracyCircle = null;
    }
    if (map) {
      map.off();
      map.remove();
      map = null;
      marker = null;
    }
  }

  return {
    init,
    setLayer,
    setPosition,
    getPosition,
    centerOnMarker,
    setRadiusCircle,
    setRulerActive,
    clearMeasurements,
    showUserAccuracy,
    reverseGeocode,
    searchPlaces,
    destroy
  };
})();
