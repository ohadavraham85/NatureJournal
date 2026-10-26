/* lib/geo.ts — current device position and (best-effort, online only)
 * reverse geocoding of coordinates into a short Hebrew place name. */

export interface Position { lat: number; lng: number; accuracy: number }

export function currentPosition(timeoutMs = 15000): Promise<Position | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

interface NominatimAddress {
  nature_reserve?: string; park?: string; natural?: string; peak?: string; water?: string;
  hamlet?: string; village?: string; town?: string; city?: string; suburb?: string;
  municipality?: string; county?: string; state?: string;
}

/** Picks the most specific meaningful name — a reserve/park/natural feature
 * beats the nearest settlement. Returns '' offline or on any failure. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!navigator.onLine) return '';
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=he&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return '';
    const data = (await res.json()) as { name?: string; address?: NominatimAddress };
    const a = data.address ?? {};
    return (
      a.nature_reserve || a.park || a.natural || a.peak || a.water ||
      a.hamlet || a.village || a.town || a.suburb || a.city || a.municipality ||
      data.name || a.county || a.state || ''
    );
  } catch {
    return '';
  }
}
