import { AircraftType } from '../types';

/**
 * Checks if the flight's airline / airline code matches the aircraft's airline.
 */
export function matchesAirline(
  flightAirline: string | undefined, 
  flightAirlineCode: string | undefined, 
  aircraftAirline: string | undefined
): boolean {
  if (!aircraftAirline) return true; // If aircraft doesn't have an airline, allow match

  const fAir = String(flightAirline || "").toUpperCase().trim();
  const fCode = String(flightAirlineCode || "").toUpperCase().trim();
  const aAir = String(aircraftAirline || "").toUpperCase().trim();

  // If both are empty, it's a match/allow
  if (!fAir && !fCode) return true;

  // Direct string match
  if (fAir && (aAir.includes(fAir) || fAir.includes(aAir))) {
    return true;
  }

  // Common airline mappings
  const checkMap = (code: string, keyword: string) => {
    const codeMatch = (fCode === code);
    const nameMatch = fAir.includes(keyword);
    const targetMatch = aAir.includes(keyword);
    return (codeMatch || nameMatch) && targetMatch;
  };

  if (checkMap('LA', 'LATAM') || checkMap('JJ', 'LATAM') || checkMap('TAM', 'LATAM')) return true;
  if (checkMap('RG', 'GOL') || checkMap('G3', 'GOL')) return true;
  if (checkMap('AD', 'AZUL')) return true;
  if (checkMap('CM', 'COPA')) return true;
  if (checkMap('TP', 'TAP')) return true;
  if (checkMap('AA', 'AMERICAN')) return true;

  // Fallback prefix starting letters match
  if (fCode && aAir.startsWith(fCode)) {
    return true;
  }

  return false;
}

/**
 * Finds the correct aircraft by analyzing both prefix (registration) and the matching company.
 */
export function findMatchingAircraft(
  aircraftsList: AircraftType[],
  inputPrefix: string,
  flightAirline?: string,
  flightAirlineCode?: string
): AircraftType | undefined {
  if (!inputPrefix) return undefined;

  const cleanInput = inputPrefix.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (cleanInput.length < 2) return undefined;

  // Priority 1: Exact prefix match AND company match
  let match = aircraftsList.find(a => {
    const cleanPrefix = a.prefix.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return cleanPrefix === cleanInput && matchesAirline(flightAirline, flightAirlineCode, a.airline);
  });

  if (match) return match;

  // Priority 2: Suffix or partial match AND company match
  if (cleanInput.length >= 3) {
    match = aircraftsList.find(a => {
      const cleanPrefix = a.prefix.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      return cleanPrefix.endsWith(cleanInput) && matchesAirline(flightAirline, flightAirlineCode, a.airline);
    });
    if (match) return match;
  }

  // Priority 3: Exact prefix match even if company doesn't strictly match (fallback)
  match = aircraftsList.find(a => {
    const cleanPrefix = a.prefix.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return cleanPrefix === cleanInput;
  });

  if (match) return match;

  // Priority 4: Suffix or partial match even if company doesn't match
  if (cleanInput.length >= 3) {
    match = aircraftsList.find(a => {
      const cleanPrefix = a.prefix.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      return cleanPrefix.endsWith(cleanInput);
    });
    if (match) return match;
  }

  return undefined;
}
