// Cloudflare Pages Function proxy for Flightradar24 Air Radar API
export async function onRequestGet(context) {
  const { env } = context;
  const token = env.FR24_API_TOKEN || "";
  const sbgrLat = -23.4356;
  const sbgrLon = -46.4731;

  // Helper code to generate realistic simulated flights - mirrors Express server.ts fallback
  const generateSimulatedFlight = (flightNumber, origin, aircraftType, registration, index) => {
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
    let apiFlights = [];
    let apiSuccess = false;
    let apiErrorDetail = "";

    // If FR24 API Token is configured on the Cloudflare Pages environment
    if (token && token.trim() !== "" && token !== "YOUR_FR24_KEY") {
      try {
        const bounds = "-22.5,-24.3,-47.6,-45.3";
        const fr24Url = `https://fr24api.flightradar24.com/api/live/flight-positions/full?bounds=${bounds}&limit=100`;

        const response = await fetch(fr24Url, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "Accept-Version": "v1",
            "Authorization": `Bearer ${token}`
          }
        });

        if (response.ok) {
          const json = await response.json();
          const rawFlights = json.data || [];

          apiFlights = rawFlights.map((f) => {
            const flightNumber = f.flight || f.flightNumber || f.callsign || "N/A";
            const callsign = f.callsign || f.flight || "";
            const origin = f.orig_iata || f.orig_icao || f.origin || "N/A";
            const destination = f.dest_iata || f.dest_icao || f.destination || "N/A";
            const lat = typeof f.lat === "number" ? f.lat : (f.latitude || 0);
            const lon = typeof f.lon === "number" ? f.lon : (f.longitude || 0);
            const altitude = typeof f.alt === "number" ? f.alt : (f.altitude || 0);
            const speed = typeof f.gspeed === "number" ? f.gspeed : (f.speed || f.ground_speed || 0);
            const heading = typeof f.track === "number" ? f.track : (f.heading || 0);
            const aircraftType = f.type || f.aircraft_type || f.aircraftType || "N/A";
            const registration = f.reg || f.registration || "N/A";
            const eta = f.eta || f.estimated_arrival || f.estimated || null;

            const isGruEvent = destination === "GRU" || destination === "SBGR" || origin === "GRU" || origin === "SBGR";
            const isMalha = flightNumber.toUpperCase().startsWith("LA") || flightNumber.toUpperCase().startsWith("G3") || flightNumber.toUpperCase().startsWith("AD");

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
          apiErrorDetail = `HTTP ${response.status}`;
        }
      } catch (apiErr) {
        apiErrorDetail = apiErr.message || "Erro de rede";
      }
    }

    let finalFlightList = [];
    if (apiSuccess) {
      finalFlightList = apiFlights;
    } else {
      // Fallback: Generate the standard mock flights
      finalFlightList = standardMockFlights.map((m, idx) => 
        generateSimulatedFlight(m.flightNumber, m.origin, m.aircraftType, m.registration, idx)
      );
    }

    return new Response(JSON.stringify({
      success: true,
      data: finalFlightList,
      malhaSize: 3,
      totalFetched: apiSuccess ? apiFlights.length : 0,
      apiSuccess,
      apiErrorDetail: apiSuccess ? "" : apiErrorDetail
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: "CLOUDFLARE_PAGES_FUNCTION_ERROR",
      message: error.message || "Erro interno na função de borda ou proxy do radar de voos."
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}
