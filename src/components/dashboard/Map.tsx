"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Map, { Marker, NavigationControl, ScaleControl, MapRef } from "react-map-gl/maplibre";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DashboardPersonnel } from "@/hooks/useDashboardData";
import { Crosshair, MapPin, Radio, ShieldAlert } from "lucide-react";

// Point MapLibre to self-hosted worker in /public/maplibre to resolve Turbopack chunk URL issues
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

interface Props {
  data: DashboardPersonnel[];
  selectedId: string | null;
  onMarkerClick: (id: string) => void;
  className?: string;
}

export default function MapComponent({ data, selectedId, onMarkerClick, className = "" }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const located = data.filter(
    (p) =>
      p.location &&
      Number.isFinite(p.location.latitude) &&
      Number.isFinite(p.location.longitude) &&
      Math.abs(p.location.latitude) <= 90 &&
      Math.abs(p.location.longitude) <= 180
  );

  const selected = located.find((p) => p.id === selectedId);

  const [viewState, setViewState] = useState({
    longitude: 74.2562,
    latitude: 22.8333,
    zoom: 11,
  });

  // Center on initial located personnel if map is at default position
  useEffect(() => {
    if (mapLoaded && mapRef.current && located.length > 0 && viewState.zoom === 11 && viewState.longitude === 74.2562) {
      const first = located[0];
      setViewState((prev) => ({
        ...prev,
        longitude: first.location!.longitude,
        latitude: first.location!.latitude,
      }));
    }
  }, [mapLoaded, located, viewState.zoom, viewState.longitude]);

  // Fly to selected personnel
  useEffect(() => {
    if (!selected?.location || !mapLoaded || !mapRef.current) return;

    mapRef.current.flyTo({
      center: [selected.location.longitude, selected.location.latitude],
      zoom: 15.5,
      duration: 1200,
      essential: true,
    });
  }, [selectedId, selected, mapLoaded]);

  const focusAll = useCallback(() => {
    if (!mapRef.current || located.length === 0) return;

    if (located.length === 1) {
      const p = located[0];
      mapRef.current.flyTo({
        center: [p.location!.longitude, p.location!.latitude],
        zoom: 15,
        duration: 1000,
      });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    located.forEach((p) => {
      bounds.extend([p.location!.longitude, p.location!.latitude]);
    });

    mapRef.current.fitBounds(bounds, {
      padding: { top: 80, bottom: 80, left: 60, right: 60 },
      maxZoom: 15,
      duration: 1000,
    });
  }, [located]);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-slate-950 ${className}`}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onLoad={() => setMapLoaded(true)}
        mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
        mapLib={maplibregl}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="bottom-right" showCompass showZoom />
        <ScaleControl position="bottom-left" />

        {located.map((p) => {
          const loc = p.location!;
          const isSOS = p.sosStatus === "SOS ACTIVE";
          const isSelected = p.id === selectedId;
          const isStale = p.locationStatus === "STALE";
          const isOffline = p.networkStatus === "OFFLINE";

          // Markers distinct color styling
          const color = isSOS
            ? "#dc2626" // Red 600
            : isStale || isOffline
              ? "#64748b" // Slate 500
              : "#0284c7"; // Sky 600

          return (
            <Marker
              key={p.id}
              longitude={loc.longitude}
              latitude={loc.latitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onMarkerClick(p.id);
              }}
            >
              <button
                type="button"
                aria-label={`Select personnel ${p.personnelCode} - ${p.name}`}
                title={`${p.name} (${p.personnelCode})${isStale ? " — Stale GPS" : ""}${isOffline ? " — Offline" : ""}`}
                className="group relative flex flex-col items-center outline-none cursor-pointer"
              >
                {/* SOS pulse effect */}
                {isSOS && (
                  <span
                    className="absolute -top-1 h-12 w-12 rounded-full animate-ping bg-rose-500 opacity-75 pointer-events-none"
                  />
                )}

                {/* Selection ring */}
                {isSelected && (
                  <span
                    className="absolute -top-1 h-12 w-12 rounded-full ring-4 ring-sky-400 ring-offset-2 ring-offset-slate-900 pointer-events-none animate-pulse"
                  />
                )}

                {/* Marker badge */}
                <span
                  className={`relative z-[1] flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white px-1.5 text-[11px] font-black text-white shadow-xl transition-transform duration-150 group-hover:scale-110 group-active:scale-95 ${
                    isSelected ? "scale-110 shadow-sky-500/50" : ""
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {isSOS ? (
                    <ShieldAlert size={14} className="text-white animate-bounce" />
                  ) : (
                    p.personnelCode.replace(/^POL-/i, "").slice(-3)
                  )}
                </span>

                {/* Arrow stem */}
                <span
                  className="h-2 w-2 -mt-1 rotate-45 border-r-2 border-b-2 border-white shadow-sm"
                  style={{ backgroundColor: color }}
                />

                {/* Name & Callout label */}
                <span
                  className={`mt-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-bold shadow-md transition-all ${
                    isSelected
                      ? "border-sky-500 bg-slate-900 text-sky-300 ring-1 ring-sky-400/50 scale-105"
                      : isSOS
                        ? "border-rose-600 bg-rose-950 text-rose-200"
                        : "border-slate-800 bg-slate-950/90 text-slate-200"
                  }`}
                >
                  {p.personnelCode}
                  {isStale && <span className="ml-1 text-[9px] text-amber-400">STALE</span>}
                  {isOffline && <span className="ml-1 text-[9px] text-rose-400">OFFLINE</span>}
                </span>
              </button>
            </Marker>
          );
        })}
      </Map>

      {/* Floating Info Pill - Top Left */}
      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-slate-200 shadow-xl backdrop-blur-md">
          <MapPin size={15} className="text-sky-400" />
          <span className="hidden sm:inline">Personnel Tactical Map</span>
          <span className="sm:hidden">Map</span>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-300 shadow-xl backdrop-blur-md">
          <Radio size={14} className="text-emerald-400 animate-pulse" />
          <span>
            {located.length} / {data.length} Located
          </span>
        </div>
      </div>

      {/* Fit All button */}
      <button
        type="button"
        onClick={focusAll}
        disabled={located.length === 0}
        aria-label="Focus map on all located personnel"
        title="Fit map bounds to all located personnel"
        className="absolute right-3 bottom-24 sm:bottom-28 z-10 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/95 text-slate-200 shadow-xl backdrop-blur-md transition-all hover:bg-slate-800 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Crosshair size={18} />
      </button>

      {/* Empty State Overlay */}
      {located.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none z-10">
          <div className="max-w-xs sm:max-w-sm rounded-2xl border border-slate-800 bg-slate-900/95 p-5 text-center shadow-2xl backdrop-blur-md">
            <MapPin size={32} className="mx-auto mb-2.5 text-slate-500" />
            <h3 className="text-sm font-bold text-white">No Coordinates Received</h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Personnel markers will populate automatically when field GPS telemetry is transmitted.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
