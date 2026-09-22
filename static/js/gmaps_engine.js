/**
 * gmaps_engine.js - Adaptador avanzado para Google Maps JavaScript API
 * Incluye capas (Calles, Satélite, Híbrido, Relieve), tráfico en tiempo real,
 * círculo de radio, regla de medición y búsqueda con Google Geocoding.
 */

window.GoogleMapsEngine = (function () {
  let map = null;
  let marker = null;
  let geocoder = null;
  let trafficLayer = null;
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
  let onPositionChangeCallback = null;
  let isScriptLoaded = false;
  let currentMapTypeId = 'roadmap';

  function loadGoogleMapsScript(apiKey) {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        isScriptLoaded = true;
        resolve();
        return;
      }

      const existingScript = document.getElementById('google-maps-api-script');
      if (existingScript) existingScript.remove();

      window.gm_authFailure = function () {
        console.error('[Google Maps] Error de autenticación: Clave inválida.');
        if (window.onGoogleMapsAuthError) window.onGoogleMapsAuthError();
      };

      const callbackName = '__gmapsCallback_' + Math.floor(Math.random() * 100000);
      window[callbackName] = function () {
        isScriptLoaded = true;
        delete window[callbackName];
        resolve();
      };

      const script = document.createElement('script');
      script.id = 'google-maps-api-script';
      script.type = 'text/javascript';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry&callback=${callbackName}&loading=async`;
      script.onerror = function () {
        reject(new Error('No se pudo descargar el script de Google Maps.'));
      };

      document.head.appendChild(script);
    });
  }

  async function init(containerId, initialLat, initialLng, initialZoom, onPositionChange, onMouseMove, onDistanceUpdate, apiKey) {
    onPositionChangeCallback = onPositionChange;
    onMouseMoveCallback = onMouseMove;
    onDistanceCallback = onDistanceUpdate;

    if (!apiKey) throw new Error('Se requiere una Google Maps API Key.');

    await loadGoogleMapsScript(apiKey);

    const container = document.getElementById(containerId);
    if (!container) return false;
    container.innerHTML = '';

    const initialLocation = { lat: initialLat, lng: initialLng };

    map = new google.maps.Map(container, {
      center: initialLocation,
      zoom: initialZoom || 15,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      mapTypeControl: false, // Usamos nuestro menú propio unificado
      streetViewControl: true,
      zoomControl: true,
    });

    geocoder = new google.maps.Geocoder();
    trafficLayer = new google.maps.TrafficLayer();

    marker = new google.maps.Marker({
      position: initialLocation,
      map: map,
      draggable: true,
      animation: google.maps.Animation.DROP,
      title: 'Punto Seleccionado (Arrastra para mover)'
    });

    marker.addListener('dragend', function (event) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      if (radiusCircle) radiusCircle.setCenter(event.latLng);
      if (onPositionChangeCallback) onPositionChangeCallback(lat, lng, true);
    });

    map.addListener('click', function (event) {
      if (isRulerActive) {
        addRulerPoint(event.latLng);
        return;
      }

      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      setPosition(lat, lng, null, true);
      if (onPositionChangeCallback) onPositionChangeCallback(lat, lng, true);
    });

    map.addListener('mousemove', function (event) {
      if (onMouseMoveCallback) {
        onMouseMoveCallback(event.latLng.lat(), event.latLng.lng());
      }
    });

    return true;
  }

  function setLayer(layerKey) {
    if (!map) return;
    switch (layerKey) {
      case 'satellite':
        map.setMapTypeId(google.maps.MapTypeId.SATELLITE);
        break;
      case 'dark':
      case 'positron':
      case 'streets':
        map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
        break;
      case 'topo':
        map.setMapTypeId(google.maps.MapTypeId.TERRAIN);
        break;
      default:
        map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
    }
  }

  function setTraffic(enabled) {
    if (!map || !trafficLayer) return;
    if (enabled) {
      trafficLayer.setMap(map);
    } else {
      trafficLayer.setMap(null);
    }
  }

  function setPosition(lat, lng, zoom, fetchAddress) {
    if (!map || !marker) return;

    const latLng = new google.maps.LatLng(lat, lng);
    marker.setPosition(latLng);

    if (radiusCircle) {
      radiusCircle.setCenter(latLng);
    }

    if (zoom) {
      map.setZoom(zoom);
      map.setCenter(latLng);
    } else {
      map.panTo(latLng);
    }

    if (fetchAddress) {
      reverseGeocode(lat, lng);
    }
  }

  function getPosition() {
    if (!marker) return null;
    const pos = marker.getPosition();
    return { lat: pos.lat(), lng: pos.lng() };
  }

  function centerOnMarker() {
    if (!map || !marker) return;
    map.panTo(marker.getPosition());
  }

  // Radio de Alcance
  function setRadiusCircle(enabled, radiusMeters) {
    isRadiusEnabled = enabled;
    if (radiusMeters) activeRadiusMeters = radiusMeters;

    if (!enabled) {
      if (radiusCircle) {
        radiusCircle.setMap(null);
        radiusCircle = null;
      }
      return;
    }

    if (!map || !marker) return;

    const currentPos = marker.getPosition();
    if (!radiusCircle) {
      radiusCircle = new google.maps.Circle({
        center: currentPos,
        radius: activeRadiusMeters,
        map: map,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.18
      });
    } else {
      radiusCircle.setCenter(currentPos);
      radiusCircle.setRadius(activeRadiusMeters);
    }
  }

  // Medición de Distancias
  function setRulerActive(active) {
    isRulerActive = active;
    if (!active) clearMeasurements();
  }

  function addRulerPoint(latLng) {
    rulerPoints.push(latLng);

    const dot = new google.maps.Circle({
      center: latLng,
      radius: 8,
      map: map,
      fillColor: '#ffffff',
      fillOpacity: 1,
      strokeColor: '#ef4444',
      strokeWeight: 2
    });
    rulerMarkers.push(dot);

    if (rulerPolyline) rulerPolyline.setMap(null);

    rulerPolyline = new google.maps.Polyline({
      path: rulerPoints,
      map: map,
      strokeColor: '#ef4444',
      strokeOpacity: 0.9,
      strokeWeight: 3
    });

    let totalMeters = 0;
    if (google.maps.geometry && google.maps.geometry.spherical) {
      for (let i = 0; i < rulerPoints.length - 1; i++) {
        totalMeters += google.maps.geometry.spherical.computeDistanceBetween(rulerPoints[i], rulerPoints[i + 1]);
      }
    }

    if (onDistanceCallback) {
      onDistanceCallback(totalMeters, rulerPoints.length);
    }
  }

  function clearMeasurements() {
    rulerPoints = [];
    if (rulerPolyline) {
      rulerPolyline.setMap(null);
      rulerPolyline = null;
    }
    rulerMarkers.forEach(m => m.setMap(null));
    rulerMarkers = [];
    if (onDistanceCallback) onDistanceCallback(0, 0);
  }

  function showUserAccuracy(lat, lng, accuracyMeters) {
    if (!map) return;

    if (accuracyCircle) accuracyCircle.setMap(null);

    const latLng = new google.maps.LatLng(lat, lng);
    accuracyCircle = new google.maps.Circle({
      center: latLng,
      radius: accuracyMeters || 50,
      map: map,
      fillColor: '#10b981',
      fillOpacity: 0.15,
      strokeColor: '#10b981',
      strokeWeight: 2
    });

    setPosition(lat, lng, 16, true);
  }

  function reverseGeocode(lat, lng) {
    const addressElement = document.getElementById('display-address');
    if (!addressElement) return;

    addressElement.textContent = "Consultando Google Geocoding...";

    if (!geocoder) geocoder = new google.maps.Geocoder();

    const latLng = { lat: lat, lng: lng };
    geocoder.geocode({ location: latLng }, (results, status) => {
      if (status === "OK" && results[0]) {
        addressElement.textContent = results[0].formatted_address;
      } else {
        addressElement.textContent = `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }
    });
  }

  async function searchPlaces(query) {
    if (!query || !geocoder) return [];
    return new Promise((resolve) => {
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === "OK" && results) {
          const formatted = results.slice(0, 5).map(r => ({
            name: r.formatted_address,
            lat: r.geometry.location.lat(),
            lng: r.geometry.location.lng()
          }));
          resolve(formatted);
        } else {
          resolve([]);
        }
      });
    });
  }

  function destroy() {
    clearMeasurements();
    if (radiusCircle) {
      radiusCircle.setMap(null);
      radiusCircle = null;
    }
    if (accuracyCircle) {
      accuracyCircle.setMap(null);
      accuracyCircle = null;
    }
    if (trafficLayer) {
      trafficLayer.setMap(null);
    }
    if (marker) {
      marker.setMap(null);
      marker = null;
    }
    map = null;
  }

  return {
    init,
    setLayer,
    setTraffic,
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
