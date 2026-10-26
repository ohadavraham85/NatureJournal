/* lib/map-tiles.ts — the map layers shared by the map tab and the location
 * picker: satellite (with place labels) or street map, remembered per device. */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getSetting, setSetting } from '../db/repository';

export { L };

export function tileLayers(): { street: L.TileLayer; satellite: L.TileLayer; labels: L.TileLayer } {
  return {
    street: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' }),
    labels: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, zIndex: 3 }),
  };
}

/** Wires a toggle button that switches satellite ⇄ street map. */
export function wireLayerToggle(map: L.Map, btn: HTMLButtonElement): void {
  const layers = tileLayers();
  let satellite = true;
  const apply = (): void => {
    if (satellite) { map.removeLayer(layers.street); layers.satellite.addTo(map); layers.labels.addTo(map); }
    else { map.removeLayer(layers.satellite); map.removeLayer(layers.labels); layers.street.addTo(map); }
    btn.textContent = satellite ? 'מפת דרכים' : 'לוויין';
  };
  apply();
  void getSetting('mapSatellite', true).then((v) => { satellite = v; apply(); });
  btn.addEventListener('click', () => { satellite = !satellite; apply(); void setSetting('mapSatellite', satellite); });
}
