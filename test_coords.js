// Test script para verificar la robustez del parser de coordenadas
function parseCoordinatesString(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();

  // Eliminar prefijos comunes como 'lat:', 'latitude:', 'long:', 'lng:'
  text = text.replace(/(?:lat(?:itude)?|lng|lon(?:gitude)?)\s*[:=]?\s*/gi, '');

  // 1. Intento: Coordenadas decimales separadas por coma, punto y coma o espacio
  const ddRegex = /^(-?\d{1,2}(?:\.\d+)?)[,\s;]+(-?\d{1,3}(?:\.\d+)?)$/;
  const ddMatch = text.match(ddRegex);
  if (ddMatch) {
    const lat = parseFloat(ddMatch[1]);
    const lng = parseFloat(ddMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // 2. Intento: Con hemisferio "10.4806 N, 66.9036 W" o "10.4806N 66.9036W"
  const hemiRegex = /(\d{1,2}(?:\.\d+)?)\s*([NSns])[,\s;]+(\d{1,3}(?:\.\d+)?)\s*([EWew])/;
  const hemiMatch = text.match(hemiRegex);
  if (hemiMatch) {
    let lat = parseFloat(hemiMatch[1]);
    if (hemiMatch[2].toUpperCase() === 'S') lat = -lat;
    let lng = parseFloat(hemiMatch[3]);
    if (hemiMatch[4].toUpperCase() === 'W') lng = -lng;
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // 3. Intento: DMS (Grados Minutos Segundos)
  function dmsToDecimal(dmsStr) {
    const match = dmsStr.match(/(\d+(?:\.\d+)?)\s*°?\s*(\d+(?:\.\d+)?)?\s*'?\s*(\d+(?:\.\d+)?)?\s*"?\s*([NSEWnsew])?/);
    if (!match) return null;
    const deg = parseFloat(match[1]) || 0;
    const min = parseFloat(match[2]) || 0;
    const sec = parseFloat(match[3]) || 0;
    const hemisphere = (match[4] || '').toUpperCase();
    let dd = deg + (min / 60) + (sec / 3600);
    if (hemisphere === 'S' || hemisphere === 'W') dd = -dd;
    return dd;
  }

  const parts = text.split(/[,;\/]+/);
  if (parts.length === 2) {
    const latDd = dmsToDecimal(parts[0].trim());
    const lngDd = dmsToDecimal(parts[1].trim());
    if (latDd !== null && lngDd !== null && latDd >= -90 && latDd <= 90 && lngDd >= -180 && lngDd <= 180) {
      return { lat: latDd, lng: lngDd };
    }
  }

  return null;
}

const testCases = [
  { input: "10.4806, -66.9036", expectedLat: 10.4806, expectedLng: -66.9036 },
  { input: "10.4806 -66.9036", expectedLat: 10.4806, expectedLng: -66.9036 },
  { input: "10.4806; -66.9036", expectedLat: 10.4806, expectedLng: -66.9036 },
  { input: "lat: 10.4806, lng: -66.9036", expectedLat: 10.4806, expectedLng: -66.9036 },
  { input: "10.4806 N, 66.9036 W", expectedLat: 10.4806, expectedLng: -66.9036 },
  { input: "-34.6037, -58.3816", expectedLat: -34.6037, expectedLng: -58.3816 },
  { input: "40.7128, -74.0060", expectedLat: 40.7128, expectedLng: -74.0060 },
  { input: `10° 28' 50.16" N, 66° 54' 12.96" W`, expectedLat: 10.4806, expectedLng: -66.9036 },
  { input: "19.4326, -99.1332", expectedLat: 19.4326, expectedLng: -99.1332 },
  { input: "95.0, 200.0", expectedLat: null, expectedLng: null }, // Fuera de rango
];

let allPassed = true;
testCases.forEach((tc, idx) => {
  const res = parseCoordinatesString(tc.input);
  if (tc.expectedLat === null) {
    if (res !== null) {
      console.error(`FAIL [${idx}]: "${tc.input}" debio retornar null pero retorno`, res);
      allPassed = false;
    } else {
      console.log(`PASS [${idx}]: "${tc.input}" correctamente rechazado por estar fuera de rango.`);
    }
  } else {
    if (!res || Math.abs(res.lat - tc.expectedLat) > 0.001 || Math.abs(res.lng - tc.expectedLng) > 0.001) {
      console.error(`FAIL [${idx}]: "${tc.input}" esperado (${tc.expectedLat}, ${tc.expectedLng}), obtenido:`, res);
      allPassed = false;
    } else {
      console.log(`PASS [${idx}]: "${tc.input}" => (${res.lat.toFixed(4)}, ${res.lng.toFixed(4)})`);
    }
  }
});

if (allPassed) {
  console.log("\nTODAS LAS PRUEBAS DEL PARSER PASARON EXITOSAMENTE.");
} else {
  process.exit(1);
}
