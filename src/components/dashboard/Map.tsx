"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Map, { Marker, Source, Layer, ScaleControl, MapRef } from "react-map-gl/maplibre";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DashboardPersonnel } from "@/hooks/useDashboardData";
import {
  Crosshair,
  MapPin,
  Radio,
  ShieldAlert,
  Plus,
  Minus,
  LocateFixed,
} from "lucide-react";
import { formatIST } from "@/lib/utils/time";

// Point MapLibre to self-hosted worker in /public/maplibre
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

type MapLayerType = "streets" | "navigation" | "satellite" | "dark";

// Configurable tile providers supporting production SLA layers via environment variables
const MAP_STYLES: Record<MapLayerType, any> = {
  navigation: process.env.NEXT_PUBLIC_MAP_STYLE_NAVIGATION || "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  streets: {
    version: 8,
    sources: {
      "osm-tiles": {
        type: "raster",
        tiles: process.env.NEXT_PUBLIC_MAP_TILES_STREETS
          ? [process.env.NEXT_PUBLIC_MAP_TILES_STREETS]
          : [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "osm-tiles-layer",
        type: "raster",
        source: "osm-tiles",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
  satellite: {
    version: 8,
    sources: {
      "esri-imagery": {
        type: "raster",
        tiles: process.env.NEXT_PUBLIC_MAP_TILES_SATELLITE
          ? [process.env.NEXT_PUBLIC_MAP_TILES_SATELLITE]
          : [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
        tileSize: 256,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
        maxzoom: 18,
      },
      "esri-labels": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 17,
      },
    },
    layers: [
      {
        id: "imagery-layer",
        type: "raster",
        source: "esri-imagery",
        minzoom: 0,
        maxzoom: 19,
      },
      {
        id: "labels-layer",
        type: "raster",
        source: "esri-labels",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
  dark: process.env.NEXT_PUBLIC_MAP_STYLE_DARK || "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

/**
 * Builds a geodesic circular polygon GeoJSON feature for a given coordinate and accuracy radius in meters.
 */
function createAccuracyGeoJSON(
  lng: number,
  lat: number,
  accuracyMeters: number,
  isSOS: boolean,
  rating?: "OPTIMAL" | "MODERATE" | "COARSE" | "HIGH" | "MEDIUM" | "LOW" | null
) {
  const points = 64;
  const coords: [number, number][] = [];
  const safeRadius = Math.max(accuracyMeters || 10, 3);
  const distanceX = safeRadius / (111320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = safeRadius / 110540;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    coords.push([lng + distanceX * Math.cos(theta), lat + distanceY * Math.sin(theta)]);
  }
  coords.push(coords[0]);

  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [coords],
        },
        properties: {
          isSOS,
          radius: safeRadius,
          rating: rating || (accuracyMeters <= 10 ? "OPTIMAL" : accuracyMeters <= 30 ? "MODERATE" : "COARSE"),
        },
      },
    ],
  };
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
  const [layerType, setLayerType] = useState<MapLayerType>("navigation");
  const [followMode, setFollowMode] = useState(false);

  const located = useMemo(
    () =>
      data.filter(
        (p) =>
          p.location &&
          Number.isFinite(p.location.latitude) &&
          Number.isFinite(p.location.longitude) &&
          Math.abs(p.location.latitude) <= 90 &&
          Math.abs(p.location.longitude) <= 180
      ),
    [data]
  );

  const selected = useMemo(() => located.find((p) => p.id === selectedId), [located, selectedId]);

  const [viewState, setViewState] = useState({
    longitude: 74.2562,
    latitude: 22.8333,
    zoom: 12,
  });

  // Center on first located personnel on initial load
  useEffect(() => {
    if (mapLoaded && mapRef.current && located.length > 0 && viewState.zoom === 12 && viewState.longitude === 74.2562) {
      const first = located[0];
      setViewState((prev) => ({
        ...prev,
        longitude: first.location!.longitude,
        latitude: first.location!.latitude,
        zoom: 15,
      }));
    }
  }, [mapLoaded, located, viewState.zoom, viewState.longitude]);

  // Smooth fly-to when an officer is selected
  useEffect(() => {
    if (!selected?.location || !mapLoaded || !mapRef.current) return;

    mapRef.current.flyTo({
      center: [selected.location.longitude, selected.location.latitude],
      zoom: 16.5,
      duration: 1000,
      essential: true,
    });
  }, [selectedId, selected, mapLoaded]);

  // Follow Officer mode: keeps selected officer centered as live telemetry coordinates arrive
  useEffect(() => {
    if (followMode && selected?.location && mapRef.current) {
      mapRef.current.easeTo({
        center: [selected.location.longitude, selected.location.latitude],
        duration: 800,
      });
    }
  }, [followMode, selected?.location?.latitude, selected?.location?.longitude]);

  // Generate accuracy circle for selected officer
  const accuracyCircle = useMemo(() => {
    if (!selected?.location) return null;
    return createAccuracyGeoJSON(
      selected.location.longitude,
      selected.location.latitude,
      selected.location.accuracy,
      selected.sosStatus === "SOS ACTIVE",
      selected.location.accuracyRating
    );
  }, [selected]);

  const focusAll = useCallback(() => {
    if (!mapRef.current || located.length === 0) return;

    if (located.length === 1) {
      const p = located[0];
      mapRef.current.flyTo({
        center: [p.location!.longitude, p.location!.latitude],
        zoom: 16,
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
      maxZoom: 16,
      duration: 1000,
    });
  }, [located]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 300 });
  };

  const handleRecenter = () => {
    if (selected?.location) {
      mapRef.current?.flyTo({
        center: [selected.location.longitude, selected.location.latitude],
        zoom: 16.5,
        duration: 800,
      });
    } else {
      focusAll();
    }
  };

  return (
    <div className={`relative h-full w-full overflow-hidden bg-slate-950 ${className}`}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onLoad={() => setMapLoaded(true)}
        onError={(e) => {
          console.warn("Map style/tile event:", e?.error?.message || e);
          if (layerType !== "navigation") {
            setLayerType("navigation");
          }
        }}
        mapStyle={MAP_STYLES[layerType]}
        mapLib={maplibregl}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
      >
        <ScaleControl position="bottom-left" />

        {/* GPS Accuracy Radius Circle for selected officer */}
        {accuracyCircle && (
          <Source id="accuracy-source" type="geojson" data={accuracyCircle}>
            <Layer
              id="accuracy-fill"
              type="fill"
              paint={{
                "fill-color":
                  selected?.sosStatus === "SOS ACTIVE"
                    ? "#e11d48"
                    : (selected?.location?.accuracyRating === "OPTIMAL" || (selected?.location?.accuracy ?? 99) <= 10)
                      ? "#10b981"
                      : (selected?.location?.accuracyRating === "MODERATE" || (selected?.location?.accuracy ?? 99) <= 30)
                        ? "#0284c7"
                        : "#f59e0b",
                "fill-opacity": 0.18,
              }}
            />
            <Layer
              id="accuracy-stroke"
              type="line"
              paint={{
                "line-color":
                  selected?.sosStatus === "SOS ACTIVE"
                    ? "#f43f5e"
                    : (selected?.location?.accuracyRating === "OPTIMAL" || (selected?.location?.accuracy ?? 99) <= 10)
                      ? "#059669"
                      : (selected?.location?.accuracyRating === "MODERATE" || (selected?.location?.accuracy ?? 99) <= 30)
                        ? "#0284c7"
                        : "#d97706",
                "line-width": 2,
                "line-opacity": 0.85,
                "line-dasharray":
                  selected?.location?.accuracyRating === "COARSE" || (selected?.location?.accuracy ?? 99) > 30
                    ? [3, 2]
                    : [1, 0],
              }}
            />
          </Source>
        )}

        {/* Markers for all located personnel */}
        {located.map((p) => {
          const loc = p.location!;
          const isSOS = p.sosStatus === "SOS ACTIVE";
          const isSelected = p.id === selectedId;
          const isStale = p.locationStatus === "STALE";
          const isOffline = p.networkStatus === "OFFLINE" || p.dutyStatus === "OFF DUTY";
          const isOptimal = loc.accuracy <= 10.0;
          const isModerate = loc.accuracy > 10.0 && loc.accuracy <= 30.0;
          const isCoarse = loc.accuracy > 30.0;

          const color = isSOS
            ? "#dc2626" // Red 600
            : isStale || isOffline
              ? "#64748b" // Slate 500
              : isOptimal
                ? "#059669" // Emerald 600
                : isModerate
                  ? "#0284c7" // Sky 600
                  : "#d97706"; // Amber 600

          const initials = p.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 3)
            .toUpperCase() || "POL";

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
                aria-label={`Select personnel ${p.name}`}
                title={`${p.name}${isStale ? " — Stale GPS" : ""}${isOffline ? " — Offline" : ""}${isOptimal ? ` — Optimal GPS (±${Math.round(loc.accuracy)}m)` : isModerate ? ` — Moderate (±${Math.round(loc.accuracy)}m)` : ` — Coarse Fix (±${Math.round(loc.accuracy)}m)`}`}
                className="group relative flex flex-col items-center outline-none cursor-pointer"
              >
                {/* SOS pulse effect */}
                {isSOS && (
                  <span className="absolute -top-1.5 h-12 w-12 rounded-full animate-ping bg-rose-500 opacity-75 pointer-events-none" />
                )}

                {/* Selection ring */}
                {isSelected && (
                  <span className="absolute -top-1.5 h-12 w-12 rounded-full ring-4 ring-sky-400 ring-offset-2 ring-offset-slate-900 pointer-events-none animate-pulse" />
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
                    initials
                  )}
                </span>

                {/* Arrow stem */}
                <span
                  className="h-2 w-2 -mt-1 rotate-45 border-r-2 border-b-2 border-white shadow-sm"
                  style={{ backgroundColor: color }}
                />

                {/* Name Callout with Accuracy Badge */}
                <span
                  className={`mt-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-bold shadow-md transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "border-sky-500 bg-slate-900 text-sky-300 ring-1 ring-sky-400/50 scale-105"
                      : isSOS
                        ? "border-rose-600 bg-rose-950 text-rose-200"
                        : "border-slate-800 bg-slate-950/90 text-slate-200"
                  }`}
                >
                  <span>{p.name}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold flex items-center gap-1 ${
                      isOptimal
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                        : isModerate
                          ? "bg-sky-950/80 text-sky-300 border border-sky-800/60"
                          : "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                    }`}
                  >
                    ±{Math.round(loc.accuracy)}m
                    {isOptimal && <span className="text-[8px] text-emerald-400 font-sans">≤10m</span>}
                    {isCoarse && <span className="text-[8px] text-amber-400 font-sans">COARSE</span>}
                  </span>
                  {isStale && <span className="ml-0.5 text-[9px] text-amber-400 font-sans">STALE</span>}
                  {isOffline && <span className="ml-0.5 text-[9px] text-rose-400 font-sans">OFFLINE</span>}
                </span>
              </button>
            </Marker>
          );
        })}
      </Map>

      {/* Floating Info Pill - Top Left */}
      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-120px)] flex-wrap items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-slate-200 shadow-xl backdrop-blur-md">
          <MapPin size={15} className="text-sky-400" />
          <span className="hidden sm:inline">Tactical Live Map</span>
          <span className="sm:hidden">Map</span>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-300 shadow-xl backdrop-blur-md">
          <Radio size={14} className="text-emerald-400 animate-pulse" />
          <span>
            {located.length} / {data.length} Located
          </span>
        </div>
      </div>

      {/* Map Layer Switcher - Top Right */}
      <div className="absolute right-3 top-3 z-10 flex items-center bg-slate-900/95 border border-slate-700/80 rounded-xl p-1 shadow-2xl backdrop-blur-md">
        <button
          type="button"
          onClick={() => setLayerType("streets")}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            layerType === "streets"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
          }`}
          title="High-detail street view with complete road labels and landmarks"
        >
          Streets
        </button>
        <button
          type="button"
          onClick={() => setLayerType("navigation")}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            layerType === "navigation"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
          }`}
          title="CARTO Voyager vector navigation style"
        >
          Navigation
        </button>
        <button
          type="button"
          onClick={() => setLayerType("satellite")}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            layerType === "satellite"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
          }`}
          title="Satellite imagery with street and landmark overlay"
        >
          Satellite
        </button>
        <button
          type="button"
          onClick={() => setLayerType("dark")}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            layerType === "dark"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
          }`}
          title="High contrast tactical dark mode"
        >
          Dark
        </button>
      </div>

      {/* Floating Control Stack - Bottom Right */}
      <div className="absolute right-3 bottom-20 sm:bottom-24 z-10 flex flex-col items-center gap-2">
        {/* Follow Officer Toggle */}
        {selected && (
          <button
            type="button"
            onClick={() => setFollowMode(!followMode)}
            aria-label={followMode ? "Disable Follow Officer mode" : "Enable Follow Officer mode"}
            title={followMode ? "Follow Officer active (auto-centering)" : "Turn on Follow Officer"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold shadow-xl backdrop-blur-md transition-all cursor-pointer ${
              followMode
                ? "bg-emerald-600 border-emerald-500 text-white ring-2 ring-emerald-400/50 shadow-emerald-950/50"
                : "bg-slate-900/95 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-850"
            }`}
          >
            <LocateFixed size={14} className={followMode ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{followMode ? "Following" : "Follow"}</span>
          </button>
        )}

        {/* Recenter Button */}
        <button
          type="button"
          onClick={handleRecenter}
          disabled={located.length === 0}
          aria-label="Recenter map"
          title={selected ? `Center on ${selected.name}` : "Fit all personnel"}
          className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/95 text-slate-200 shadow-xl backdrop-blur-md transition-all hover:bg-slate-800 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          <Crosshair size={18} />
        </button>

        {/* Zoom Controls */}
        <div className="flex flex-col rounded-xl border border-slate-700 bg-slate-900/95 shadow-xl backdrop-blur-md overflow-hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            title="Zoom in"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer border-b border-slate-800"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            title="Zoom out"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <Minus size={18} />
          </button>
        </div>
      </div>

      {/* Selected Officer Live GPS Pill - Bottom Left */}
      {selected?.location && (
        <div className="absolute left-3 bottom-8 sm:bottom-10 z-10 flex items-center gap-3 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-3 sm:p-3.5 shadow-2xl backdrop-blur-md max-w-[calc(100%-100px)] sm:max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
              selected.sosStatus === "SOS ACTIVE"
                ? "bg-rose-500 animate-ping"
                : selected.locationStatus === "TRACKING ACTIVE"
                  ? (selected.location.accuracy <= 10 ? "bg-emerald-400 ring-2 ring-emerald-500/50" : selected.location.accuracy <= 30 ? "bg-sky-400" : "bg-amber-400")
                  : selected.locationStatus === "STALE"
                    ? "bg-amber-400"
                    : "bg-slate-400"
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-white truncate">{selected.name}</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                  selected.location.accuracy <= 10
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                    : selected.location.accuracy <= 30
                      ? "bg-sky-950/80 text-sky-300 border border-sky-800/60"
                      : "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                }`}
              >
                ±{selected.location.accuracy.toFixed(1)}m
              </span>
              <span
                className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                  selected.location.accuracy <= 10
                    ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
                    : selected.location.accuracy <= 30
                      ? "bg-sky-900/60 text-sky-300 border border-sky-700/50"
                      : "bg-amber-900/60 text-amber-300 border border-amber-700/50"
                }`}
              >
                {selected.location.accuracy <= 10 ? "≤10m Target Met" : selected.location.accuracy <= 30 ? "Moderate" : "Coarse Fix"}
              </span>
              {selected.location.source && (
                <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                  {selected.location.source}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-1 truncate">
              {selected.location.latitude.toFixed(5)}, {selected.location.longitude.toFixed(5)}
              <span className="ml-2 text-slate-500 font-sans">
                {selected.location.accuracyAgeSeconds != null
                  ? `${selected.location.accuracyAgeSeconds}s ago (${formatIST(selected.location.recordedAt, true)})`
                  : formatIST(selected.location.recordedAt, true)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRecenter}
            className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 px-2.5 py-1.5 bg-sky-950/50 border border-sky-900/60 rounded-lg cursor-pointer"
          >
            Focus
          </button>
        </div>
      )}

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
