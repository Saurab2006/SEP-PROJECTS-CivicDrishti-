'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import { X } from 'lucide-react';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const STYLE_URL = `https://api.maptiler.com/maps/streets-v4/style.json?key=${MAPTILER_KEY}`;
const DEFAULT_CENTER = [85.324, 27.7172]; // Kathmandu

const SEVERITY_COLOR = {
  low: '#6b7280',
  medium: '#d97706',
  high: '#ea580c',
  critical: '#dc2626',
};

function reportCode(id) {
  return 'IS-' + String(id || '').slice(-4).toUpperCase();
}

export default function IssuesMap({ reports, height = 380, selectedId, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const [ready, setReady] = useState(false);
  const [activeReport, setActiveReport] = useState(null);

  const located = (reports || []).filter(r => r.location?.lat != null && r.location?.lng != null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: 11,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => setReady(true));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Rebuild markers whenever the filtered report list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    located.forEach((r) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.style.width = '18px';
      el.style.height = '18px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,.35)';
      el.style.cursor = 'pointer';
      el.style.background = SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.low;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveReport(r);
        onSelect?.(r._id);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([r.location.lng, r.location.lat])
        .addTo(map);
      markersRef.current[r._id] = marker;
    });

    if (located.length) {
      const bounds = new maplibregl.LngLatBounds();
      located.forEach(r => bounds.extend([r.location.lng, r.location.lat]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 400 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(located.map(r => r._id))]);

  // Highlight the marker matching selectedId (e.g. hovered/clicked from the list)
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const el = marker.getElement();
      el.style.outline = id === selectedId ? '3px solid #cf1f3b' : 'none';
      el.style.zIndex = id === selectedId ? 10 : 0;
      el.style.transform = id === selectedId ? 'scale(1.25)' : 'scale(1)';
    });
    if (selectedId && markersRef.current[selectedId] && mapRef.current) {
      mapRef.current.easeTo({ center: markersRef.current[selectedId].getLngLat(), duration: 400 });
    }
  }, [selectedId]);

  return (
    <div className="relative">
      <div ref={containerRef} style={{ height }} className="w-full overflow-hidden rounded-2xl border border-gray-100" />
      {!located.length && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 text-xs font-medium text-gray-400">
          None of the current issues have a pinned location yet
        </div>
      )}
      {activeReport && (
        <div className="absolute bottom-3 left-3 right-3 flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-lg sm:right-auto sm:w-80">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{reportCode(activeReport._id)} · {activeReport.severity}</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{activeReport.title}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500">{activeReport.location?.address}{activeReport.location?.district ? `, ${activeReport.location.district}` : ''}</p>
            <Link href={`/issues/${activeReport._id}`} className="mt-1.5 inline-block text-xs font-semibold text-brand-600 hover:underline">View & discuss →</Link>
          </div>
          <button onClick={() => setActiveReport(null)} className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-50"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      <div className="absolute left-3 top-3 flex flex-wrap gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-gray-600 shadow-sm backdrop-blur">
        {Object.entries(SEVERITY_COLOR).map(([sev, color]) => (
          <span key={sev} className="flex items-center gap-1 capitalize"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{sev}</span>
        ))}
      </div>
    </div>
  );
}