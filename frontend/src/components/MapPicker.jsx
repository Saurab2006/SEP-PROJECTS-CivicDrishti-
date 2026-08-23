'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Crosshair, Loader2 } from 'lucide-react';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const STYLE_URL = `https://api.maptiler.com/maps/streets-v4-dark/style.json?key=${MAPTILER_KEY}`;
const DEFAULT_CENTER = [85.324, 27.7172]; // Kathmandu

export default function MapPicker({ value, onChange, height = 260 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [locating, setLocating] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: value ? [value.lng, value.lat] : DEFAULT_CENTER,
      zoom: value ? 14 : 11,
      attributionControl: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.on('load', () => setReady(true));
    map.on('click', (e) => onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (value) {
      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({ color: '#cf1f3b', draggable: true })
          .setLngLat([value.lng, value.lat])
          .addTo(map);
        markerRef.current.on('dragend', () => {
          const pos = markerRef.current.getLngLat();
          onChange({ lat: pos.lat, lng: pos.lng });
        });
      } else {
        markerRef.current.setLngLat([value.lng, value.lat]);
      }
      map.easeTo({ center: [value.lng, value.lat], duration: 400 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, ready]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div>
      <div ref={containerRef} style={{ height }} className="w-full overflow-hidden rounded-xl border border-gray-200" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {value ? `Selected: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'Click the map to pin the location'}
        </span>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          {locating ? 'Locating…' : 'Use my location'}
        </button>
      </div>
    </div>
  );
}