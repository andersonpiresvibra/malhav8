import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import https from "https";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Config Supabase client for reading malha_operacional on the backend
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
let supabaseClientLocal: any = null;

if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("<project-ref>") && supabaseUrl !== "https://placeholder.supabase.co") {
  try {
    supabaseClientLocal = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error("[FR24 Backend Init] Failed to create Supabase Client:", err);
  }
}

// Fetch active flight numbers from the database
async function getMalhaFlights(): Promise<string[]> {
  const defaultMalha = ["LA3001", "G31234", "AD4455"];
  if (!supabaseClientLocal) {
    return defaultMalha;
  }
  try {
    const { data, error } = await supabaseClientLocal
      .from("malha_operacional")
      .select("flight_number, departure_flight_number");
    
    if (error) {
      console.error("[FR24 Backend] Error fetching active flights from db:", error);
      return defaultMalha;
    }
    
    const uniqueFlights = new Set<string>();
    if (data) {
      data.forEach((row: any) => {
        if (row.flight_number) uniqueFlights.add(String(row.flight_number).trim().toUpperCase());
        if (row.departure_flight_number) uniqueFlights.add(String(row.departure_flight_number).trim().toUpperCase());
      });
    }
    
    if (uniqueFlights.size === 0) {
      return defaultMalha;
    }
    return Array.from(uniqueFlights);
  } catch (err) {
    console.error("[FR24 Backend] Exception in getMalhaFlights:", err);
    return defaultMalha;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Custom CORS middleware
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: "5mb" }));

  // API Route FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Flightradar24 proxy endpoint for SBGR / GRU arrivals
  app.get("/api/fr24/guarulhos-arrivals", async (req, res) => {
    const token = process.env.FR24_API_TOKEN;
    const sbgrLat = -23.4356;
    const sbgrLon = -46.4731;

    // Helper to generate a realistic simulated flight heading to Guarulhos (SBGR) - only used for mock fallback!
    const generateSimulatedFlight = (flightNumber: string, origin: string, aircraftType: string, registration: string, index: number) => {
      const hash = flightNumber.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const angle = (hash * 47) % 360;
      const angleRad = angle * Math.PI / 180;
      const durationMs = 10 * 60 * 1000;
      const timeOffset = (hash * 33333) % durationMs;
      const progress = ((Date.now() + timeOffset) % durationMs) / durationMs;

      const altitude = Math.round(28000 - (24900 * progress));
      const speed = Math.round(410 - (268 * progress));
      const maxDistance = 1.6;
      const currentDistance = maxDistance * (1.0 - progress) + 0.015;

      const lat = sbgrLat + Math.cos(angleRad) * currentDistance;
      const lon = sbgrLon + Math.sin(angleRad) * currentDistance;

      const dy = sbgrLat - lat;
      const dx = sbgrLon - lon;
      let heading = Math.round(Math.atan2(dx, dy) * 180 / Math.PI);
      if (heading < 0) heading += 360;

      return {
        flightNumber,
        callsign: flightNumber,
        origin,
        destination: "GRU",
        lat,
        lon,
        altitude,
        speed,
        heading,
        aircraftType,
        registration,
        eta: new Date(Date.now() + (durationMs * (1.0 - progress))).toISOString(),
        isReal: false,
        isGruEvent: true,
        isMalha: true
      };
    };

    // Standard list of active flights arriving at SBGR/Guarulhos (utilized ONLY during offline/mock fallback modes)
    const standardMockFlights = [
      { flightNumber: "LA3831", origin: "SCL", aircraftType: "B773", registration: "PR-XPD" },
      { flightNumber: "LA3001", origin: "BSB", aircraftType: "A321", registration: "PR-YRE" },
      { flightNumber: "G32044", origin: "GIG", aircraftType: "B738", registration: "PR-GUX" },
      { flightNumber: "AD4112", origin: "CNF", aircraftType: "E295", registration: "PR-AYN" },
      { flightNumber: "TP082", origin: "LIS", aircraftType: "A339", registration: "CS-TVI" },
      { flightNumber: "AF454", origin: "CDG", aircraftType: "B772", registration: "F-GSPZ" },
      { flightNumber: "AA951", origin: "MIA", aircraftType: "B773", registration: "N721AN" }
    ];

    try {
      // Fetch user's active flight list from operational database
      const dbFlights = await getMalhaFlights();
      const cleanNum = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const dbFlightsClean = dbFlights.map(cleanNum);

      let apiFlights: any[] = [];
      let apiSuccess = false;
      let apiErrorDetail = "";

      // If token exists, attempt to pull real-world entries from Flightradar24 Live Positions API
      if (token && token.trim() !== "" && token !== "YOUR_FR24_KEY") {
        try {
          // Bounding box centered around Guarulhos SBGR - extending roughly 120km to capture all terminal approach patterns/entries (TMA São Paulo)
          const bounds = "-22.5,-24.3,-47.6,-45.3";
          const fr24Url = `https://fr24api.flightradar24.com/api/live/flight-positions/full?bounds=${bounds}&limit=100`;

          const response = await fetch(fr24Url, {
            method: "GET",
            headers: {
              "Accept": "application/json",
              "Accept-Version": "v1",
              "Authorization": `Bearer ${token}`
            },
            timeout: 5000
          } as any);

          if (response.ok) {
            const json = await response.json();
            const rawFlights = json.data || [];

            apiFlights = rawFlights.map((f: any) => {
              // Real keys check to safeguard accuracy based on actual Flightradar24 API specification responses
              const flightNumber = f.flight || f.flightNumber || f.callsign || "N/A";
              const callsign = f.callsign || f.flight || "";
              const origin = f.orig_iata || f.orig_icao || f.origin || "N/A";
              const destination = f.dest_iata || f.dest_icao || f.destination || "N/A";
              const lat = typeof f.lat === 'number' ? f.lat : (f.latitude || 0);
              const lon = typeof f.lon === 'number' ? f.lon : (f.longitude || 0);
              const altitude = typeof f.alt === 'number' ? f.alt : (f.altitude || 0);
              const speed = typeof f.gspeed === 'number' ? f.gspeed : (f.speed || f.ground_speed || 0);
              const heading = typeof f.track === 'number' ? f.track : (f.heading || 0);
              const aircraftType = f.type || f.aircraft_type || f.aircraftType || "N/A";
              const registration = f.reg || f.registration || "N/A";
              const eta = f.eta || f.estimated_arrival || f.estimated || null;

              const fClean = cleanNum(flightNumber);
              const cClean = cleanNum(callsign);
              
              // Verify context relative to the active airport of GRU/SBGR & operational schedule
              const isGruEvent = destination === "GRU" || destination === "SBGR" || origin === "GRU" || origin === "SBGR" || callsign.toUpperCase().includes("GRU") || flightNumber.toUpperCase().includes("GRU");
              const isMalha = dbFlightsClean.includes(fClean) || dbFlightsClean.includes(cClean);

              return {
                flightNumber,
                callsign,
                origin,
                destination,
                lat,
                lon,
                altitude,
                speed,
                heading,
                aircraftType,
                registration,
                eta,
                isReal: true,
                isGruEvent,
                isMalha
              };
            });

            apiSuccess = true;
          } else {
            apiErrorDetail = `HTTP ${response.status} ${response.statusText}`;
            const errorText = await response.text().catch(() => "");
            console.warn(`[FR24 Backend Error] FR24 API returned code ${response.status}. Detail: ${errorText}`);
          }
        } catch (apiErr: any) {
          apiErrorDetail = apiErr.message || "Erro de rede";
          console.error("[FR24 Backend API Request Failed]:", apiErr);
        }
      }

      // Final decision logic:
      // If the real API works, we serve *ONLY* the real flights in the sector! No fake/mock flights are mixed in at all.
      // If the API fails or is unconfigured, we then use simulated flights as a robust graceful backup but flag it flagrantly.
      let finalFlightList: any[] = [];
      if (apiSuccess) {
        finalFlightList = apiFlights;
      } else {
        const usedFlightNumbers = new Set<string>();

        // 1. Gather simulated standard mock flights
        standardMockFlights.forEach((m, idx) => {
          const cleanF = cleanNum(m.flightNumber);
          if (!usedFlightNumbers.has(cleanF)) {
            const simF = generateSimulatedFlight(m.flightNumber, m.origin, m.aircraftType, m.registration, idx);
            finalFlightList.push(simF);
            usedFlightNumbers.add(cleanF);
          }
        });

        // 2. Mix in schedule DB flights (only as backup!)
        dbFlights.forEach((fNo, idx) => {
          const cleanF = cleanNum(fNo);
          if (!usedFlightNumbers.has(cleanF)) {
            let aircraft = "A320";
            let carrier = "GRU";
            if (cleanF.startsWith("AD")) { aircraft = "E295"; carrier = "VCP"; }
            else if (cleanF.startsWith("G3")) { aircraft = "B738"; carrier = "SDU"; }
            else if (cleanF.startsWith("LA")) { aircraft = "A321"; carrier = "BSB"; }

            const simF = generateSimulatedFlight(fNo, carrier, aircraft, `PR-${cleanF.slice(-3)}`, idx + 10);
            finalFlightList.push(simF);
            usedFlightNumbers.add(cleanF);
          }
        });
      }

      return res.json({
        success: true,
        data: finalFlightList,
        malhaSize: dbFlights.length,
        totalFetched: apiSuccess ? apiFlights.length : 0,
        apiSuccess,
        apiErrorDetail: apiSuccess ? "" : apiErrorDetail
      });

    } catch (error: any) {
      console.error("[FR24 Endpoint Error]:", error);
      return res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro interno ao processar radar de voos."
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MALHA SSoT ENGINE] Servidor operacional na porta ${PORT}`);
  });
}

startServer();
