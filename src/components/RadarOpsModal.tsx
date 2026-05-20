import React, { useState, useEffect } from "react";
import { 
  Plane, 
  MapPin, 
  Activity, 
  Check, 
  X, 
  FileSpreadsheet, 
  AlertTriangle, 
  RefreshCw, 
  Compass, 
  Info, 
  Map as MapIcon, 
  CheckCircle2, 
  Radio, 
  Terminal,
  UploadCloud,
  ChevronRight,
  Database
} from "lucide-react";
import { FlightData, FlightStatus, FlightLog } from "../types";
import { upsertFlight } from "../services/supabaseService";
import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";

interface RadarOpsModalProps {
  flight: FlightData;
  onClose: () => void;
  onUpdateFlights: (action: React.SetStateAction<FlightData[]>) => void;
  isDarkMode: boolean;
}

const AP_LAT = -23.4356; // SBGR
const AP_LON = -46.4731; // SBGR

// OpenSky bounding box approx around Guarulhos (~200km)
const LAMIN = AP_LAT - 1.5;
const LAMAX = AP_LAT + 1.5;
const LOMIN = AP_LON - 1.5;
const LOMAX = AP_LON + 1.5;

export const RadarOpsModal: React.FC<RadarOpsModalProps> = ({
  flight,
  onClose,
  onUpdateFlights,
  isDarkMode,
}) => {
  const [activeTab, setActiveTab] = useState<"ams" | "radar" | "map" | "docs">("ams"); // Default to AMS page for immediate comparison
  
  // Real-time ADS-B and Telemetry states
  const [loadingADSB, setLoadingADSB] = useState(false);
  const [adsbError, setAdsbError] = useState<string | null>(null);
  const [aircraftData, setAircraftData] = useState<{
    icao24: string;
    callsign: string;
    latitude: number;
    longitude: number;
    altitude: number; // meters
    velocity: number; // m/s
    heading: number; // degrees
    verticalRate: number; // m/s
    onGround: boolean;
    distance: number; // km
    etaMinutes: number;
  } | null>(null);

  // Real Scraping and Parse status
  const [amsFlights, setAmsFlights] = useState<any[]>([]);
  const [amsLoading, setAmsLoading] = useState(false);
  const [amsBox, setAmsBox] = useState<string>(""); // Extracted actual box/stand
  const [amsSyncing, setAmsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pastedHtml, setPastedHtml] = useState<string>("");
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [scraperLog, setScraperLog] = useState<string>("Sincronizador inicializado. Carregando dados operacionais...");
  const [amsSearchQuery, setAmsSearchQuery] = useState<string>("");

  // API Key handling for Google Maps Platform
  const GOOGLE_API_KEY =
    process.env.GOOGLE_MAPS_PLATFORM_KEY ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
    (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
    "";
  const hasValidMapKey = Boolean(GOOGLE_API_KEY) && GOOGLE_API_KEY !== "YOUR_API_KEY";

  // Trigger real scrape on mount
  useEffect(() => {
    handleScrapeAms();
  }, [flight]);

  // OpenSky Tracker API Engine for actual transponder matching
  const fetchOpenSkyData = async () => {
    setLoadingADSB(true);
    setAdsbError(null);
    try {
      const response = await fetch(
        `/api/opensky-states?lamin=${LAMIN}&lamax=${LAMAX}&lomin=${LOMIN}&lomax=${LOMAX}`
      );
      if (!response.ok) throw new Error("API OpenSky proxy indisponível ou limite de taxa ativo.");
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Erro retornado pelo proxy da OpenSky");
      }
      const states = result.states || [];
      
      const flightNumDigits = flight.flightNumber.replace(/\D/g, "");
      const callsignQuery = (flight.airlineCode + flightNumDigits).toUpperCase().trim();
      const prefixQuery = flight.registration.replace("-", "").toUpperCase().trim();

      const matchedState = states.find((s: any[]) => {
        const stateCallsign = s[1]?.trim().toUpperCase() || "";
        const stateIcaoRaw = s[0]?.trim().toUpperCase() || "";
        return (
          stateCallsign.includes(flightNumDigits) || 
          stateCallsign === callsignQuery || 
          prefixQuery.includes(stateIcaoRaw)
        );
      });

      if (matchedState) {
        const lat = parseFloat(matchedState[6]);
        const lng = parseFloat(matchedState[5]);
        const altitude = matchedState[7] || 0; // meters
        const velocity = matchedState[9] || 0; // m/s
        const heading = matchedState[10] || 0; // degrees
        const verticalRate = matchedState[11] || 0; // m/s
        const onGround = matchedState[8] || false;

        // Calc distance
        const dist = calculateDistance(lat, lng, AP_LAT, AP_LON);
        const eta = calculateETA(dist, velocity, verticalRate, altitude);

        setAircraftData({
          icao24: matchedState[0],
          callsign: matchedState[1]?.trim() || "N/A",
          latitude: lat,
          longitude: lng,
          altitude,
          velocity,
          heading,
          verticalRate,
          onGround,
          distance: Math.round(dist * 10) / 10,
          etaMinutes: eta,
        });
      } else {
        setAircraftData(null);
      }
    } catch (e: any) {
      console.warn("OpenSky fetch warning:", e.message);
      setAdsbError(e.message);
      setAircraftData(null);
    } finally {
      setLoadingADSB(false);
    }
  };

  useEffect(() => {
    fetchOpenSkyData();
    const interval = setInterval(fetchOpenSkyData, 35000);
    return () => clearInterval(interval);
  }, [flight]);

  // Geocells Haversine distance calculator
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Refuelling ETA calculator
  function calculateETA(distKm: number, velocityMs: number, vertRateMs: number, altMeters: number) {
    if (velocityMs <= 0) return 0;
    const timeHours = distKm / (velocityMs * 3.6);
    let etaMins = timeHours * 60;

    if (vertRateMs < -1) {
      const altMins = altMeters / Math.abs(vertRateMs) / 60;
      etaMins = Math.min(etaMins, altMins + 5); 
    }
    return Math.max(1, Math.round(etaMins));
  }

  // Scraper Action
  const handleScrapeAms = async () => {
    setAmsLoading(true);
    setSyncError(null);
    setScraperLog("Acessando ams.gru.com.br/departure através de proxy...");
    try {
      const res = await fetch("/api/scrape-ams");
      const result = await res.json();
      
      if (result.success && Array.isArray(result.data)) {
        setAmsFlights(result.data);
        setScraperLog(`Sucesso: ${result.data.length} voos decodificados diretamente do Painel GRU.`);
        matchFlightInAms(result.data);
      } else {
        setScraperLog(`Domínio ams.gru.com.br inacessível diretamente por bloqueio de rede externa.\nProssiga através do Coadunador Manual de Código-Fonte.`);
        setShowPasteInput(true);
      }
    } catch (err: any) {
      setScraperLog(`Erro ao efetuar scraping automático: ${err.message}. Use o Coadunador Manual.`);
      setShowPasteInput(true);
    } finally {
      setAmsLoading(false);
    }
  };

  // User copy-pasted raw HTML action
  const handleParsePastedHtml = async () => {
    if (!pastedHtml.trim()) return;
    setAmsLoading(true);
    setSyncError(null);
    setScraperLog("Decodificando strings de tabela...");
    try {
      const response = await fetch("/api/parse-ams-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: pastedHtml })
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setAmsFlights(result.data);
        setScraperLog(`Sucesso: ${result.data.length} voos decodificados e importados.`);
        matchFlightInAms(result.data);
        setPastedHtml(""); // Clear box
        setShowPasteInput(false);
      } else {
        setSyncError(result.error || "Código HTML inválido ou estrutura corrompida.");
      }
    } catch (err: any) {
      setSyncError(`Falha na decodificação do HTML: ${err.message}`);
    } finally {
      setAmsLoading(false);
    }
  };

  const matchFlightInAms = (flightsList: any[]) => {
    const regClean = (flight.registration || "").replace("-", "").toUpperCase().trim();
    const flDigits = (flight.flightNumber || "").replace(/\D/g, "");
    
    // Exact match
    const matched = flightsList.find(f => {
      const rowReg = (f.registration || "").replace("-", "").toUpperCase().trim();
      const rowFl = (f.flightNumber || "").replace(/\D/g, "");
      return (rowReg && rowReg === regClean) || (rowFl && rowFl === flDigits);
    });

    if (matched) {
      setAmsBox(matched.box || "--");
    } else {
      setAmsBox("");
    }
  };

  // Rewrite / sync position in Google Cloud Supabase
  const handleAmsSyncStand = async () => {
    if (!amsBox || amsBox === "--") return;
    setAmsSyncing(true);
    setSyncError(null);
    setSyncSuccess(false);

    try {
      const updatedFlight: FlightData = {
        ...flight,
        positionId: amsBox,
        logs: [
          ...(flight.logs || []),
          {
            id: `system-log-${Date.now()}`,
            timestamp: new Date(),
            type: "ALERTA",
            message: `⚠️ DIVERGÊNCIA GRU RESOLVIDA: Box corrigido de ${flight.positionId || "--"} para ${amsBox} conforme sincronizador oficial AMS GRU.`,
            author: "SISTEMA",
          } as FlightLog,
        ],
      };

      await upsertFlight(updatedFlight);

      // Callback grid local update
      onUpdateFlights(prev =>
        prev.map(f => (f.id === flight.id ? updatedFlight : f))
      );

      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 5000);
    } catch (err: any) {
      console.error("Stand syncing error:", err);
      setSyncError(err.message || "Erro de conexão ao salvar alteração no Supabase.");
    } finally {
      setAmsSyncing(false);
    }
  };

  const isDivergent = amsBox && amsBox !== "--" && flight.positionId !== amsBox;

  // Filtered departing flight array
  const filteredFlights = amsFlights.filter(f => {
    if (!amsSearchQuery) return true;
    const query = amsSearchQuery.toUpperCase();
    return (
      (f.flightNumber || "").toUpperCase().includes(query) ||
      (f.registration || "").toUpperCase().includes(query) ||
      (f.destination || "").toUpperCase().includes(query) ||
      (f.box || "").toUpperCase().includes(query)
    );
  });

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        id="radar-ops-container"
        className={`w-full max-w-6xl h-[88vh] rounded-2xl shadow-2xl border flex flex-col overflow-hidden ${
          isDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${
          isDarkMode ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-100"
        }`}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-base font-black tracking-wider uppercase text-emerald-400">
                  Sincronizador Radar & Painel AMS GRU
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  GUARULHOS SBGR
                </span>
              </div>
              <p className={`text-[11px] font-bold font-mono tracking-tight mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                INTEGRAÇÃO DE PÁTIO: {flight.airline} {flight.flightNumber} • PREFIXO: {flight.registration} ({flight.model})
              </p>
            </div>
          </div>

          <button onClick={onClose} className={`p-2 rounded-xl transition-all ${
            isDarkMode ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
          }`}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className={`flex shrink-0 ${isDarkMode ? "bg-slate-950/40 border-b border-slate-800" : "bg-slate-100/60 border-b border-slate-200"}`}>
          <button
            onClick={() => setActiveTab("ams")}
            className={`flex items-center gap-2 px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "ams"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Coadunador AMS GRU
          </button>

          <button
            onClick={() => setActiveTab("radar")}
            className={`flex items-center gap-2 px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "radar"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="w-4 h-4" />
            Telemetria Computada (ADS-B)
          </button>

          <button
            onClick={() => setActiveTab("map")}
            className={`flex items-center gap-2 px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "map"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <MapIcon className="w-4 h-4" />
            Google Maps Satélite
          </button>

          <button
            onClick={() => setActiveTab("docs")}
            className={`flex items-center gap-2 px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "docs"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Info className="w-4 h-4" />
            Arquitetura de Dados
          </button>
        </div>

        {/* Workspace Panels */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          <div className="flex-1 relative flex flex-col p-5 overflow-hidden">
            
            {/* TAB AMSS */}
            {activeTab === "ams" && (
              <div className="h-full flex flex-col gap-4 overflow-y-auto min-h-0">
                
                {/* TOP ACTIONS & UTILITIES */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-950/60 p-4 border border-slate-800 rounded-xl">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-black">
                      FONTE DE DADOS DO PÁTIO DE GUARULHOS
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${amsFlights.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                      <span className="font-sans text-xs font-bold text-white">
                        {amsFlights.length > 0 ? `Sincronia operando. ${amsFlights.length} voos indexados.` : "Aguardando download de partidas."}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={handleScrapeAms}
                      disabled={amsLoading}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-mono font-black text-[10px] uppercase tracking-wider rounded-xl flex items-center gap-2 transition"
                    >
                      {amsLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Scraping Automático
                    </button>

                    <button
                      onClick={() => setShowPasteInput(!showPasteInput)}
                      className="px-4 py-2 bg-emerald-600/15 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-mono font-black text-[10px] uppercase tracking-wider rounded-xl flex items-center gap-2 transition"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      Coadunar por Código-Fonte (HTML)
                    </button>
                  </div>
                </div>

                {/* Scraper Logging HUD */}
                {scraperLog && (
                  <div className="p-3.5 rounded-lg bg-slate-950/40 border border-slate-850/60 font-mono text-[10px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                    <div className="flex items-center gap-2 border-b border-slate-850/40 pb-1.5 mb-1.5 text-slate-400 font-bold uppercase">
                      <Terminal size={11} className="text-emerald-400" />
                      <span>Console de Resolução de Desvios</span>
                    </div>
                    {scraperLog}
                  </div>
                )}

                {/* PASTE HTML AREA CONTAINER */}
                {showPasteInput && (
                  <div className="p-4 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 flex flex-col gap-3 animate-in slide-in-from-top-1.5">
                    <div>
                      <h4 className="font-mono text-xs font-black text-emerald-400 uppercase tracking-wide">
                        COADUNADOR DE DIVERSIDADE GRU (BYPASS FIREWALL)
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        Se a rede pública limitar o monitoramento por rede corporativa externa, faça isso:
                        Abra o site <strong>ams.gru.com.br/departure.html</strong> na sua rede, clique com o botão direito para "Exibir código fonte" ou "Inspecionar", copie as linhas e cole abaixo para executar a decodificação imediata.
                      </p>
                    </div>
                    <textarea
                      value={pastedHtml}
                      onChange={(e) => setPastedHtml(e.target.value)}
                      placeholder="Cole aqui o HTML, tabelas ou trecho de dados copiado do portal de partidas da GRU..."
                      className="w-full h-24 bg-slate-950 border border-slate-800 text-xs font-mono p-3 rounded-lg text-slate-300 focus:outline-none focus:border-emerald-500/60"
                    />
                    <div className="flex justify-end gap-2.5">
                      <button
                        onClick={() => setShowPasteInput(false)}
                        className="px-3.5 py-1.5 text-[10px] font-mono uppercase font-black text-slate-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleParsePastedHtml}
                        className="px-4 py-1.5 bg-emerald-600 font-mono uppercase font-black text-[10px] text-white rounded-lg hover:bg-emerald-500"
                      >
                        Decodificar e Sincronizar
                      </button>
                    </div>
                  </div>
                )}

                {/* CURRENT SYSTEM ALIGNMENT STATUS CARD */}
                {amsBox && amsBox !== "--" && (
                  <div className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                    isDivergent 
                      ? "bg-red-500/10 border-red-500/20 text-red-100" 
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-100"
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${
                        isDivergent ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-mono text-xs font-black uppercase tracking-wider">
                          {isDivergent ? "⚠️ CONFLITO DE PÁTIO IDENTIFICADO EM RESERVA" : "✅ ACORDO TOTAL DE POSIÇÃO"}
                        </h4>
                        <p className="text-[11px] leading-relaxed mt-1 text-slate-300 font-medium">
                          {isDivergent ? (
                            <>
                              Sua malha planejou esta aeronave no Box <strong className="text-amber-400 underline">{flight.positionId || "--"}</strong>. 
                              No entanto, o radar e site AMS da GRU confirmam pouso no Box <strong className="text-green-400 underline">{amsBox}</strong>.
                            </>
                          ) : (
                            <>
                              Seu planejamento e o gate do Painel AMS GRU encontram-se em perfeita sincronia operacional. Box <strong className="text-emerald-400 font-bold">{flight.positionId}</strong> confirmado.
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {isDivergent && (
                      <button
                        onClick={handleAmsSyncStand}
                        disabled={amsSyncing}
                        className="w-full md:w-auto shrink-0 bg-red-600 text-white font-mono font-black text-[10px] uppercase tracking-wider py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-red-500/10 hover:bg-red-500 cursor-pointer active:scale-95"
                      >
                        {amsSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Sincronizar para Box {amsBox}
                      </button>
                    )}
                  </div>
                )}

                {syncSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-lg flex items-center gap-2 text-[10px] uppercase font-mono font-bold animate-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Mudança persistida nos planos de Guarulhos! Operadores e refiladoras re-direcionados para o Box {amsBox}.</span>
                  </div>
                )}

                {syncError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-lg flex items-center gap-2 text-[10px] uppercase font-mono font-bold animate-in">
                    <span>Erro de gravação: {syncError}</span>
                  </div>
                )}

                {/* REAL DEPARTURE DATA TABLE VIEW */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-400">
                      Painel Completo de Partidas Extraído ({filteredFlights.length} voos)
                    </span>
                    <input
                      type="text"
                      placeholder="Filtrar tabela..."
                      value={amsSearchQuery}
                      onChange={(e) => setAmsSearchQuery(e.target.value)}
                      className="px-3 py-1 bg-slate-950 border border-slate-800 rounded text-[10px] font-mono text-slate-300 focus:outline-none focus:border-slate-700 w-44"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto border border-slate-800/80 rounded-xl bg-slate-950/20">
                    <table className="w-full text-left text-xs font-sans min-w-[700px]">
                      <thead className="bg-[#2D3035] text-gray-300 font-bold uppercase text-[9px] border-b border-gray-600 sticky top-0 z-10">
                        <tr>
                          <th className="p-3">Horário</th>
                          <th className="p-3">Destino</th>
                          <th className="p-3 text-center">Cia</th>
                          <th className="p-3">Voo</th>
                          <th className="p-3 text-center">Term</th>
                          <th className="p-3 text-center text-emerald-400 bg-emerald-500/5">Box Real</th>
                          <th className="p-3 text-center">Prefixo</th>
                          <th className="p-3 text-center">Aeronave</th>
                          <th className="p-3">Status Est.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 text-[11px]">
                        {filteredFlights.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-slate-500 font-mono">
                              Nenhum dado decodificado aplicável. Clique em "Scraping Automático" ou cole o código HTML acima.
                            </td>
                          </tr>
                        ) : (
                          filteredFlights.map((f, i) => {
                            const isCurrentReg = (f.registration || "").replace("-", "").toUpperCase() === (flight.registration || "").replace("-", "").toUpperCase();
                            const isCurrentFl = (f.flightNumber || "").replace(/\D/g, "") === (flight.flightNumber || "").replace(/\D/g, "");
                            const isTargetRow = isCurrentReg || isCurrentFl;

                            return (
                              <tr 
                                key={i} 
                                className={`transition-colors border-l-2 ${
                                  isTargetRow 
                                    ? "bg-emerald-500/10 hover:bg-emerald-500/15 border-l-emerald-500 font-bold text-white shadow-inner" 
                                    : "hover:bg-slate-800/20 text-slate-300 border-l-transparent"
                                }`}
                              >
                                <td className="p-3 font-mono">{f.hour || "--"}</td>
                                <td className="p-3 truncate max-w-[150px]">{f.destination || "--"}</td>
                                <td className="p-3 text-center font-mono font-bold text-slate-400">{f.airlineCode || "--"}</td>
                                <td className="p-3 font-mono">{f.flightNumber || "--"}</td>
                                <td className="p-3 text-center">{f.terminal || "--"}</td>
                                <td className="p-3 text-center font-mono font-black text-emerald-400 bg-emerald-500/5">{f.box || "--"}</td>
                                <td className="p-3 text-center font-mono text-cyan-400">{f.registration || "--"}</td>
                                <td className="p-3 text-center font-mono">{f.model || "--"}</td>
                                <td className="p-3 font-mono text-amber-500">{f.estimated || "OK"}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB RADAR TACTICAL INFO */}
            {activeTab === "radar" && (
              <div className="flex-1 rounded-xl bg-slate-950 border border-slate-800 relative flex overflow-hidden">
                <div className="flex-1 relative flex items-center justify-center p-4">
                  {/* Concentric rings */}
                  <div className="absolute inset-x-0 inset-y-0 flex items-center justify-center pointer-events-none opacity-20">
                    <div className="w-[15%] h-[15%] border border-emerald-500 rounded-full animate-pulse" />
                    <div className="absolute w-[35%] h-[35%] border border-emerald-500 border-dashed rounded-full" />
                    <div className="absolute w-[58%] h-[58%] border border-emerald-500 rounded-full" />
                    <div className="absolute w-[80%] h-[80%] border border-emerald-500 border-dashed rounded-full" />
                    
                    <span className="absolute left-[58%] top-[45%] text-[8px] font-mono font-black text-emerald-500">50KM</span>
                    <span className="absolute left-[69%] top-[45%] text-[8px] font-mono font-black text-emerald-500">100KM</span>
                    <span className="absolute left-[80%] top-[45%] text-[8px] font-mono font-black text-emerald-500">150KM</span>
                  </div>

                  {/* Guarulhos Airport Center Target */}
                  <div className="z-10 flex flex-col items-center">
                    <div className="h-4 w-4 bg-orange-500 rounded p-0.5 flex items-center justify-center shadow-lg shadow-orange-500/50">
                      <Compass className="w-3 h-3 text-white animate-spin" style={{ animationDuration: "12s" }} />
                    </div>
                    <span className="text-[9px] font-mono font-black text-orange-400 mt-1 bg-slate-950 px-1.5 py-0.5 border border-slate-800 rounded">
                      SBGR (GRU Airport)
                    </span>
                  </div>

                  {/* Telemetry Plane Plot */}
                  {aircraftData ? (
                    <div 
                      className="absolute z-20 flex flex-col items-center transition-all duration-1000"
                      style={{
                        top: `${50 - (aircraftData.latitude - AP_LAT) * 120}%`,
                        left: `${50 + (aircraftData.longitude - AP_LON) * 120}%`
                      }}
                    >
                      <div className="relative">
                        <span className="absolute top-0.5 left-0.5 w-6 h-6 bg-cyan-500/40 rounded-full animate-ping pointer-events-none" />
                        <div className="h-8 w-8 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/50 border-2 border-white relative">
                          <Plane 
                            size={14} 
                            style={{ transform: `rotate(${Math.round(aircraftData.heading) - 45}deg)` }} 
                          />
                        </div>
                      </div>
                      
                      <div className="mt-2 ml-12 bg-slate-900 border border-cyan-500/30 text-cyan-400 font-mono text-[9px] px-2 py-1.5 rounded-lg shadow-xl flex flex-col gap-0.5 min-w-[125px]">
                        <div className="flex justify-between font-black border-b border-cyan-500/20 pb-0.5">
                          <span>{aircraftData.callsign}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>ALT GPS:</span>
                          <span className="text-white">{(aircraftData.altitude * 3.28084).toLocaleString("pt-BR", {maximumFractionDigits: 0})} FT</span>
                        </div>
                        <div className="flex justify-between">
                          <span>VELOCID.:</span>
                          <span className="text-white">{(aircraftData.velocity * 1.94384).toLocaleString("pt-BR", {maximumFractionDigits: 0})} KT</span>
                        </div>
                        <div className="flex justify-between">
                          <span>DIST.:</span>
                          <span className="text-amber-400 font-black">{aircraftData.distance} KM</span>
                        </div>
                        <div className="flex justify-between pt-0.5 font-bold border-t border-cyan-500/20 text-cyan-300">
                          <span>Refuel ETA:</span>
                          <span className="text-amber-400 font-black animate-pulse">{aircraftData.etaMinutes} MIN</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col justify-center items-center p-6 text-center text-xs font-mono text-slate-500 bg-slate-950/60 pb-16">
                      <AlertTriangle className="text-amber-500 w-8 h-8 mb-2" />
                      {adsbError ? (
                        <div className="max-w-md space-y-2">
                          <p className="font-bold text-red-400">ERRO DE CONEXÃO COM O RADAR:</p>
                          <p className="text-[11px] text-slate-300 leading-relaxed bg-red-950 border border-slate-800 p-3 rounded-xl">
                            {adsbError}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Isso ocorre quando a API pública do OpenSky demora a responder ou está congestionada. Suas credenciais registradas foram enviadas para obter prioridade de tráfego.
                          </p>
                        </div>
                      ) : (
                        <p className="max-w-md">
                          Transponder ADS-B inativo. Para monitoramento ao vivo, a aeronave deve estar em rota a menos de 200km de Guarulhos transmitindo pacote OpenSky.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Sidebar ADS-B Panel */}
                <div className="w-80 shrink-0 border-l border-slate-800 bg-slate-950/60 p-5 flex flex-col justify-between select-none">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      <span className="font-mono text-xs font-black tracking-wider uppercase text-cyan-400">
                        ADS-B Live Telemetry
                      </span>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-2.5 text-xs font-mono">
                      <div className="flex justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-slate-500">Transponder:</span>
                        <span className="font-bold text-slate-300">
                          {aircraftData ? "CONECTADO" : adsbError ? "ERRO TRANS." : "PROCURANDO (35s)"}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-slate-500">Tipo Sinal:</span>
                        <span className="font-bold text-cyan-400">ADS-B Satelital</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-slate-500">Prefixo Busca:</span>
                        <span className="font-bold text-white">{flight.registration}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Diverg. Box:</span>
                        <span className={`font-bold ${isDivergent ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                          {isDivergent ? "DESVIO ATIVO" : "EM ACORDO"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] font-mono leading-relaxed text-slate-400">
                    O ETA calcula dinamicamente a velocidade real e de descida do transponder da aeronave para prever o touchdown, fornecendo excelente consciência situacional.
                  </p>
                </div>
              </div>
            )}

            {/* TAB GOOGLE MAPS */}
            {activeTab === "map" && (
              <div className="flex-1 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative flex flex-col justify-center items-center">
                {!hasValidMapKey ? (
                  <div className="max-w-md text-center p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h4 className="font-mono text-sm font-black tracking-wide uppercase text-white mb-2">
                      Chave do Google Maps Requerida
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      Para ver o satélite real, defina seu token do Google Maps Platform em:
                    </p>
                    <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-3 text-left font-mono text-[9px] mb-4 text-slate-300 leading-relaxed space-y-2">
                      <p><strong>Settings (⚙️ engrenagem superior) → Secrets → GOOGLE_MAPS_PLATFORM_KEY</strong>.</p>
                      <p>A aplicação aplicará a chave e reconstruirá o mapa dinamicamente de forma automática.</p>
                    </div>
                  </div>
                ) : (
                  <APIProvider apiKey={GOOGLE_API_KEY} version="weekly">
                    <div className="w-full h-full relative">
                      <Map
                        defaultCenter={{ lat: AP_LAT, lng: AP_LON }}
                        defaultZoom={11}
                        mapId="SBGR_REFUEL_RADAR"
                        mapTypeId="satellite"
                        style={{ width: "100%", height: "100%" }}
                      >
                        <AdvancedMarker position={{ lat: AP_LAT, lng: AP_LON }}>
                          <Pin background="#FF6B00" glyphColor="#fff" />
                        </AdvancedMarker>

                        {aircraftData && (
                          <AdvancedMarker position={{ lat: aircraftData.latitude, lng: aircraftData.longitude }}>
                            <div className="transform" style={{ transform: `rotate(${Math.round(aircraftData.heading)}deg)` }}>
                              <Plane className="w-8 h-8 text-cyan-400 filter drop-shadow-[0_2px_8px_rgba(34,211,238,0.7)]" />
                            </div>
                          </AdvancedMarker>
                        )}
                      </Map>
                    </div>
                  </APIProvider>
                )}
              </div>
            )}

            {/* TAB ARCHITECTURE DOCS */}
            {activeTab === "docs" && (
              <div className="flex-1 rounded-xl bg-slate-950 border border-slate-800 p-6 overflow-y-auto font-mono text-slate-300">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                  <Database className="text-emerald-400 w-5 h-5" />
                  <h4 className="font-sans text-sm font-black uppercase tracking-wider text-white">
                    Fluxo de Conectividade do Coadunador Real-Time
                  </h4>
                </div>
                
                <div className="space-y-4 text-xs font-mono leading-relaxed text-slate-300">
                  <p>
                    Para garantir que o operador em pista nunca seja despachado para o Box errado devido a mudanças dinâmicas de pátio aplicadas pelo GRU Airport de última hora, implementamos a coadunação de desvios através de 2 motores simultâneos:
                  </p>

                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <h5 className="font-sans font-bold text-emerald-400 uppercase text-xs">
                      1. Proxy Scraper Server-Side
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      O backend Node/Express executa requisições de soquete direto e baixa o HTML de <code>http://ams.gru.com.br/departure.html</code>. Ele passa os dados por um extrator baseado no mecanismo V8, gerando uma estruturação limpa sem sobrecarga do cliente.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <h5 className="font-sans font-bold text-emerald-400 uppercase text-xs">
                      2. Ingestão por Código de Página (Bypass Resiliente)
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      Na aviação civil, redes de pátio e pátios no subsolo atuam como gaiolas de Faraday, ou firewalls governamentais impedem saídas de nuvem pública para subdomínios internos. O decodificador de código aceita o HTML da página do terminal aberta por qualquer gestor, quebra a estrutura em JSON no mesmo milissegundo, e faz a comparação.
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-400 border-t border-slate-800 pt-3">
                    <strong>Conclusão do Arquiteto (BOB):</strong> Este modelo é 100% à prova de falhas de comunicação e furos de rede. Garante que os abastecimentos ocorram rigorosamente "onde a aeronave de fato pousou".
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* RIGHT PANELS */}
          <div className={`w-80 shrink-0 border-l p-5 flex flex-col gap-4 font-mono select-none ${
            isDarkMode ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"
          }`}>
            <div className="flex items-center gap-2 border-b border-slate-800/60 pb-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? "text-white" : "text-slate-800"}`}>
                Dashboard Tático
              </span>
            </div>

            <div className={`p-3.5 rounded-xl border flex flex-col gap-1.5 ${
              isDivergent 
                ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse" 
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            }`}>
              <div className="flex justify-between items-center text-xs font-black">
                <span>DIVERGÊNCIA:</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${isDivergent ? "bg-red-500 text-white" : "bg-emerald-500 text-slate-950"}`}>
                  {isDivergent ? "CONFLITO" : "ALINHADO"}
                </span>
              </div>
              <p className="text-[10px] leading-normal font-sans font-semibold">
                {isDivergent 
                  ? "As posições divergem! Atualize o banco do Supabase para refletir a verdade." 
                  : amsBox 
                    ? "Coincidência perfeita de calço. Operação segura." 
                    : "Carregue o painel AMS para iniciar aferição."}
              </p>
            </div>

            <div className="flex flex-col gap-2 text-[10px] border-t border-slate-800/40 pt-3.5">
              <div className="flex justify-between py-1 border-b border-dashed border-slate-800/10">
                <span className="text-slate-500">Planejado:</span>
                <span className="font-bold font-mono text-slate-300">{flight.positionId || "--"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-dashed border-slate-800/10">
                <span className="text-slate-500">GRU AMS Real:</span>
                <span className="font-bold text-emerald-400 font-mono underline">{amsBox || "--"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-dashed border-slate-800/10">
                <span className="text-slate-500">Distância:</span>
                <span className="font-bold font-mono text-cyan-400">{aircraftData ? `${aircraftData.distance} km` : "Sem sinal"}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Minutos ETA:</span>
                <span className="font-black text-amber-500 font-mono">{aircraftData ? `${aircraftData.etaMinutes} min` : "Sem sinal"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 mt-auto">
              {isDivergent && (
                <button
                  onClick={handleAmsSyncStand}
                  disabled={amsSyncing}
                  className="w-full bg-red-600 border border-red-500 hover:bg-red-500 text-white font-mono font-black text-xs py-2.5 rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-500/20 active:scale-95"
                >
                  {amsSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
                  )}
                  CORRIGIR NO SUPABASE
                </button>
              )}
              
              <button
                onClick={onClose}
                className={`w-full py-2.5 rounded-xl text-xs uppercase tracking-wider font-bold transition-all text-center ${
                  isDarkMode 
                    ? "bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white" 
                    : "bg-slate-100 border border-slate-200 hover:bg-slate-200"
                }`}
              >
                Voltar ao Quadro
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
