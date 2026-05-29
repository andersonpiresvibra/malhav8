import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  Plane, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  Compass, 
  Gauge, 
  ArrowRight, 
  Clock, 
  UserCheck, 
  Activity, 
  MapPin,
  Maximize2
} from 'lucide-react';

interface FlightTelemetry {
  flightNumber: string;
  callsign: string;
  origin: string;
  destination: string;
  lat: number;
  lon: number;
  altitude: number; // in feet
  speed: number; // in knots
  heading: number; // degrees
  aircraftType: string;
  registration: string;
  eta: string | null;
}

interface AirRadarProps {
  isDarkMode: boolean;
}

export const AirRadar: React.FC<AirRadarProps> = ({ isDarkMode }) => {
  const [flights, setFlights] = useState<FlightTelemetry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);
  const [selectedFlight, setSelectedFlight] = useState<FlightTelemetry | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const selectedMarkerRef = useRef<L.Circle | null>(null);

  // Map configurations
  const [mapStyle, setMapStyle] = useState<'google-roadmap' | 'google-hybrid' | 'voyager' | 'dark'>('google-roadmap'); 
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const polylinesRef = useRef<Record<string, L.Polyline>>({});
  const directLinesRef = useRef<Record<string, L.Polyline>>({});
  const sbgrMarkerRef = useRef<L.Marker | null>(null);
  const sbgrCircleRef = useRef<L.Circle | null>(null);

  // Inject Leaflet CSS once
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-custom-popup-styles')) {
      const style = document.createElement('style');
      style.id = 'leaflet-custom-popup-styles';
      style.innerHTML = `
        .custom-leaflet-popup .leaflet-popup-content-wrapper {
          background: #020617 !important;
          color: #f8fafc !important;
          border: 1px solid #1e293b !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5) !important;
          padding: 0px !important;
          border-radius: 4px !important;
        }
        .custom-leaflet-popup .leaflet-popup-content {
          margin: 0px !important;
          padding: 6px 10px !important;
        }
        .custom-leaflet-popup .leaflet-popup-tip {
          background: #020617 !important;
          border: 1px solid #1e293b !important;
          box-shadow: none !important;
        }
        .gliding-glowing-route-trail {
          filter: drop-shadow(0 0 4px #10b981);
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Fetch flight statistics
  const fetchRadarData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/fr24/guarulhos-arrivals');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          JSON.stringify({
            code: errorData.error || 'SERVER_ERROR',
            message: errorData.message || 'Erro ao carregar telemetria de voos do radar.'
          })
        );
      }
      const result = await response.json();
      const fetchedFlights: FlightTelemetry[] = result.data || [];
      setFlights(fetchedFlights);
      setErrorState(null);
      setLastRefreshed(new Date());

      // If a flight was selected, keep updating its details from the fresh pool
      if (selectedFlight) {
        const updated = fetchedFlights.find(f => f.flightNumber === selectedFlight.flightNumber);
        if (updated) {
          setSelectedFlight(updated);
        }
      }
    } catch (err: any) {
      console.error('[AirRadar Fetch Error]:', err);
      try {
        const errorDetails = JSON.parse(err.message);
        setErrorState({ code: errorDetails.code, message: errorDetails.message });
      } catch {
        setErrorState({
          code: 'CONNECTION_FAILED',
          message: 'Falha ao conectar com o serviço de telemetria.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Setup auto-update every 20 seconds
  useEffect(() => {
    fetchRadarData();
    const timer = setInterval(() => {
      fetchRadarData();
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // Prevent double initialization

    // Center precisely on SBGR Guarulhos Airport runways
    const sbgrCenter: L.LatLngExpression = [-23.4356, -46.4731];
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView(sbgrCenter, 11);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        sbgrMarkerRef.current = null;
        sbgrCircleRef.current = null;
      }
    };
  }, []);

  // Update tile switcher when mapStyle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    // Default to Google Maps Roteiro, Google Híbrido, OSM Voyager, or CartoDB Dark
    let url = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    let attribution = '&copy; Google Maps';

    if (mapStyle === 'google-hybrid') {
      url = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    } else if (mapStyle === 'voyager') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenStreetMap contributors';
    } else if (mapStyle === 'dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      attribution = '&copy; CartoDB contributors';
    }

    tileLayerRef.current = L.tileLayer(url, {
      maxZoom: 20,
      minZoom: 5,
      attribution: attribution
    }).addTo(map);
  }, [mapStyle]);

  // Recenter helper directly targeting GRU Terminal center
  const resetMapViewportToSBGR = () => {
    if (mapRef.current) {
      mapRef.current.setView([-23.4356, -46.4731], 11, {
        animate: true,
        duration: 1.2
      });
    }
  };

  // Generate curved path trail retroactively following the aircraft heading (Simulates real FR24 Flight Paths)
  const getFlightPathPoints = (flight: FlightTelemetry): L.LatLngTuple[] => {
    const points: L.LatLngTuple[] = [];
    points.push([flight.lat, flight.lon]); // current pos
    
    const steps = 14;
    const baseHeadingRad = (flight.heading - 180) * Math.PI / 180;
    
    // Hash of the flight number to induce a custom curve signature so it looks realistic
    const hash = flight.flightNumber.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const waveFreq = 0.4;
    const waveAmp = 0.012 + ((hash % 10) * 0.002);

    for (let i = 1; i <= steps; i++) {
      const dist = i * 0.11; // stretch trail backwards
      // S-curve lateral vectoring approximation
      const offsetFactor = Math.sin(i * waveFreq + (hash % 5)) * waveAmp;
      
      const pLat = flight.lat + Math.cos(baseHeadingRad) * dist + Math.cos(baseHeadingRad + Math.PI/2) * offsetFactor;
      const pLon = flight.lon + Math.sin(baseHeadingRad) * dist + Math.sin(baseHeadingRad + Math.PI/2) * offsetFactor;
      points.unshift([pLat, pLon]); 
    }
    return points;
  };

  // Update map markers, route trail lines, and center airport beacon
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // SBGR base beacon node
    if (!sbgrMarkerRef.current) {
      const sbgrIcon = L.divIcon({
        html: `
          <div class="flex flex-col items-center select-none" style="transform: translate(-10px, -10px);">
            <div class="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse">
              <svg viewBox="0 0 24 24" class="w-4 h-4 text-emerald-500" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
            </div>
            <div class="mt-1 bg-slate-900 border border-slate-700 text-white text-[8px] font-black tracking-widest uppercase rounded px-1.5 py-0.5 whitespace-nowrap shadow-md">
              SBGR - GUARULHOS
            </div>
          </div>
        `,
        className: 'custom-sbgr-beacon-layer',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      sbgrMarkerRef.current = L.marker([-23.4356, -46.4731], { icon: sbgrIcon }).addTo(map);

      sbgrCircleRef.current = L.circle([-23.4356, -46.4731], {
        radius: 4000,
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.03,
        weight: 1.5,
        dashArray: '4, 6'
      }).addTo(map);
    }

    // Clean old lines
    Object.keys(polylinesRef.current).forEach(k => polylinesRef.current[k].remove());
    polylinesRef.current = {};
    Object.keys(directLinesRef.current).forEach(k => directLinesRef.current[k].remove());
    directLinesRef.current = {};

    // Remove obsolete flight markers
    const currentFlightNumbers = flights.map(f => f.flightNumber);
    Object.keys(markersRef.current).forEach(fNum => {
      if (!currentFlightNumbers.includes(fNum)) {
        markersRef.current[fNum].remove();
        delete markersRef.current[fNum];
      }
    });

    // Plot flights and their corresponding airway route paths (dashed direct line + historical curve trail)
    flights.forEach(flight => {
      const isSelected = selectedFlight?.flightNumber === flight.flightNumber;
      
      // Airway lines drawing
      const trailPoints = getFlightPathPoints(flight);
      
      // 1. Trail path (Historical curve line route)
      const trailPoly = L.polyline(trailPoints, {
        color: isSelected ? '#10b981' : '#f59e0b',
        weight: isSelected ? 3.5 : 1.8,
        opacity: isSelected ? 0.95 : 0.45,
        className: isSelected ? 'gliding-glowing-route-trail' : ''
      }).addTo(map);
      polylinesRef.current[flight.flightNumber] = trailPoly;

      // 2. Direct approach vectors (Dashed line to SBGR runways center)
      const directPoints: L.LatLngTuple[] = [
        [flight.lat, flight.lon],
        [-23.4356, -46.4731]
      ];
      const directPoly = L.polyline(directPoints, {
        color: isSelected ? '#34d399' : '#f59e0b',
        weight: isSelected ? 2.5 : 1.0,
        dashArray: isSelected ? '5, 5' : '3, 6',
        opacity: isSelected ? 0.85 : 0.25
      }).addTo(map);
      directLinesRef.current[flight.flightNumber] = directPoly;

      // Marker Icon creation (Amber by default, bright neon emerald when picked)
      const htmlIcon = `
        <div style="transform: rotate(${flight.heading}deg); transition: transform 0.4s ease-out; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <svg viewBox="0 0 24 24" class="w-8 h-8 ${
            isSelected 
              ? 'text-emerald-500 drop-shadow-[0_0_10px_#10b981] scale-110' 
              : 'text-amber-500 hover:text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)] hover:scale-105'
          }" fill="currentColor" style="transition: all 0.2s ease;">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L14 19v-5.5z"/>
          </svg>
        </div>
      `;

      const planeIcon = L.divIcon({
        html: htmlIcon,
        className: 'custom-flight-vector-marker',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const position: L.LatLngExpression = [flight.lat, flight.lon];
      const etaFormatted = flight.eta 
        ? new Date(flight.eta).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
        : 'Sem ETA';

      // Highly compact and precise metadata label containing ONLY what Anderson requested:
      // - flightNumber
      // - registration (prefixo)
      // - eta (hora de chegada)
      const popupContent = `
        <div class="text-slate-100 bg-slate-950 font-sans text-[11px] font-medium leading-normal flex flex-col gap-0.5">
          <div class="font-black text-amber-400 text-xs font-mono tracking-widest">${flight.flightNumber}</div>
          <div class="text-slate-400">Reg: <span class="text-white font-mono font-bold">${flight.registration}</span></div>
          <div class="text-emerald-400 font-bold">ETA: <span class="font-mono">${etaFormatted}</span></div>
        </div>
      `;

      if (markersRef.current[flight.flightNumber]) {
        const marker = markersRef.current[flight.flightNumber];
        marker.setLatLng(position);
        marker.setIcon(planeIcon);
        marker.setPopupContent(popupContent);
      } else {
        const marker = L.marker(position, { icon: planeIcon }).addTo(map);
        marker.bindPopup(popupContent, {
          closeButton: false,
          className: 'custom-leaflet-popup'
        });

        marker.on('click', () => {
          setSelectedFlight(flight);
        });

        markersRef.current[flight.flightNumber] = marker;
      }
    });

    // Radial marker ring overlay on selected plane position
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove();
      selectedMarkerRef.current = null;
    }

    if (selectedFlight) {
      const match = flights.find(f => f.flightNumber === selectedFlight.flightNumber);
      if (match) {
        selectedMarkerRef.current = L.circle([match.lat, match.lon], {
          radius: 1200,
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.12,
          weight: 1.5,
          className: 'pulse-radial-indicator'
        }).addTo(map);

        const marker = markersRef.current[match.flightNumber];
        if (marker && !marker.isPopupOpen()) {
          marker.openPopup();
        }
      }
    }

  }, [flights, selectedFlight]);

  // Handle selected flight actions
  const handleSelectFlight = (flight: FlightTelemetry) => {
    setSelectedFlight(flight);
    if (mapRef.current) {
      mapRef.current.setView([flight.lat, flight.lon], 11, {
        animate: true,
        duration: 1.0
      });
    }
  };

  // Searching lists filter
  const filteredFlights = flights.filter(f => {
    const q = searchQuery.toUpperCase().trim();
    if (!q) return true;
    return f.flightNumber.toUpperCase().includes(q) || 
           f.callsign.toUpperCase().includes(q) ||
           f.registration.toUpperCase().includes(q) ||
           f.aircraftType.toUpperCase().includes(q);
  });

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full font-sans bg-slate-950 text-slate-100 select-none overflow-hidden relative">
      
      {/* 1. Sleek Navigation Header matching "Estilo Navegador" */}
      <div className="h-14 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-20 shadow-lg select-none">
        
        {/* Title branding widget */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg animate-pulse">
            <Plane size={16} className="rotate-45" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-widest text-white uppercase leading-none">Radar Aéreo Guarulhos</h1>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mt-1">NOC GRU SBGR Terminal</p>
          </div>
        </div>

        {/* Central Search Bar ("campo de busca no cabeçalho simples") */}
        <div className="relative w-full max-w-md mx-4">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={13} />
          <input 
            type="text" 
            placeholder="Pesquisar voo de chegada (ex: LA3831, LA3001, G32044)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 tracking-wide font-medium"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1.5 text-slate-500 hover:text-slate-300 text-xs px-1 cursor-pointer font-bold"
            >
              ✕
            </button>
          )}

          {/* Autocomplete dropdown suggestion layer */}
          {searchQuery.trim().length > 0 && (
            <div className="absolute top-11 left-0 w-full bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-[9995] overflow-hidden max-h-56 overflow-y-auto split-scrollbar">
              {filteredFlights.length === 0 ? (
                <div className="p-3 text-[11px] text-slate-500 uppercase text-center font-bold">Nenhum voo encontrado</div>
              ) : (
                filteredFlights.map(flight => (
                  <div
                    key={flight.flightNumber}
                    onClick={() => {
                      handleSelectFlight(flight);
                      setSearchQuery(flight.flightNumber);
                    }}
                    className="p-2 px-3 hover:bg-slate-900 border-b border-slate-900/60 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white tracking-widest">{flight.flightNumber}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({flight.aircraftType})</span>
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">
                        {flight.origin} ➔ {flight.destination}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black font-mono text-emerald-400">{flight.altitude.toLocaleString()} FT</span>
                      <span className="text-[9px] text-slate-500 block">Alt Real</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Dynamic status count and Refresh trigger button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-[10px] bg-slate-950 px-2.5 py-1 border border-slate-800 rounded-md font-mono text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>{flights.length} Aeronaves Radar</span>
          </div>

          <button 
            onClick={fetchRadarData}
            disabled={isLoading}
            className="p-1 px-3 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all flex items-center gap-1.5 border border-slate-800 bg-slate-950/40 cursor-pointer disabled:opacity-50 font-bold"
          >
            <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
            <span className="text-[9px] font-black uppercase tracking-wider">Altunizar</span>
          </button>
        </div>
      </div>

      {/* 2. Map Module in 100% Full Open View (Mapa Mais Aberto) */}
      <div className="flex-1 bg-slate-900 overflow-hidden relative min-h-0 w-full">
        
        {/* Leaflet Anchor */}
        <div id="air-radar-leaflet-map" ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Map Switcher Controls and Recenter (Overlaid on the map) */}
        <div className="absolute top-4 right-4 z-[900] flex flex-col gap-2 select-none">
          {/* Tile Layer switcher */}
          <div className="bg-slate-950/95 border border-slate-800 p-1.5 rounded-lg flex items-center gap-1 shadow-xl backdrop-blur">
            <button
              onClick={() => setMapStyle('google-roadmap')}
              className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                mapStyle === 'google-roadmap'
                  ? 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Google Roteiro
            </button>
            <button
              onClick={() => setMapStyle('google-hybrid')}
              className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                mapStyle === 'google-hybrid'
                  ? 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Google Satélite
            </button>
            <button
              onClick={() => setMapStyle('voyager')}
              className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                mapStyle === 'voyager'
                  ? 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              OSM Claro
            </button>
            <button
              onClick={() => setMapStyle('dark')}
              className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                mapStyle === 'dark'
                  ? 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Radar Noturno
            </button>
          </div>

          {/* Quick Recenter controller button */}
          <button
            onClick={resetMapViewportToSBGR}
            className="p-2.5 rounded-lg bg-slate-950/95 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-emerald-400 flex items-center justify-center gap-1.5 shadow-xl backdrop-blur transition-all cursor-pointer uppercase font-extrabold text-[9px] tracking-wider"
          >
            <Maximize2 size={11} className="text-emerald-400" />
            Centrar Guarulhos (SBGR)
          </button>
        </div>

        {/* Floating Telemetry details card overlay for the selected aircraft (Elegant micro panel) */}
        {selectedFlight && (
          <div className="absolute top-4 left-4 z-[900] p-4 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl max-w-xs w-full backdrop-blur-md select-text">
            <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white tracking-widest font-mono">{selectedFlight.flightNumber}</span>
                  <span className="px-1.5 py-0.5 bg-slate-900 text-slate-400 text-[10px] font-black rounded font-mono select-all">{selectedFlight.registration}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="text-blue-400">{selectedFlight.origin}</span>
                  <ArrowRight size={12} className="text-slate-600" />
                  <span className="text-emerald-400">{selectedFlight.destination}</span>
                </div>
              </div>
              
              <button 
                onClick={() => setSelectedFlight(null)}
                className="text-slate-500 hover:text-white hover:bg-slate-800 p-1 rounded-md transition-all text-xs cursor-pointer font-bold leading-none px-2 select-none"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2.5 text-xs font-medium">
              <div className="p-2 bg-slate-900/60 border border-slate-800/40 rounded">
                <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider mb-0.5">Altitude Real</span>
                <span className="text-xs font-black text-white font-mono">{selectedFlight.altitude.toLocaleString()} FT</span>
              </div>
              <div className="p-2 bg-slate-900/60 border border-slate-800/40 rounded">
                <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider mb-0.5">Velocidade (IAS)</span>
                <span className="text-xs font-black text-white font-mono">{selectedFlight.speed} KT</span>
              </div>
              <div className="p-2 bg-slate-900/60 border border-slate-800/40 rounded">
                <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider mb-0.5">Rumo (HDG)</span>
                <span className="text-xs font-black text-white font-mono flex items-center gap-2">
                  <Compass size={12} className="text-amber-400 shrink-0" />
                  {selectedFlight.heading}°
                </span>
              </div>
              <div className="p-2 bg-slate-900/60 border border-slate-800/40 rounded">
                <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider mb-0.5">Aeronave Tipo</span>
                <span className="text-[11px] font-black text-emerald-400 truncate block font-mono uppercase">{selectedFlight.aircraftType}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase border-t border-slate-900 pt-2 mt-2 select-none">
              <span className="flex items-center gap-1">
                <Activity size={10} className="text-amber-500" /> Lat/Lon: {selectedFlight.lat.toFixed(3)}, {selectedFlight.lon.toFixed(3)}
              </span>
              <span className="text-slate-400 flex items-center gap-1">
                <UserCheck size={10} className="text-emerald-500" /> Malha Operacional
              </span>
            </div>
          </div>
        )}

        {/* Simple map legends (Bottom-left overlay) */}
        <div className="absolute bottom-4 left-4 z-[900] bg-slate-950/95 border border-slate-800 p-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-4 shadow-xl select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm inline-block shrink-0"></span>
            <span>Tráfego Aeroporto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm inline-block shrink-0 shadow-[0_0_5px_#10b981]"></span>
            <span>Voo Selecionado</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
            <MapPin size={10} className="text-emerald-400 shrink-0 animate-bounce" />
            <span>SBGR Guarulhos</span>
          </div>
        </div>
      </div>
    </div>
  );
};
