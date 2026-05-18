export const getCityName = (icao: string, destinosDB?: any[]): string => {
  if (!icao) return '--';
  const target = icao.trim().toUpperCase();
  if (destinosDB && destinosDB.length > 0) {
      const match = destinosDB.find(d => String(d.icao).trim().toUpperCase() === target || String(d.destination).trim().toUpperCase() === target);
      if (match) return match.city || match.cidade || target;
  }
  return target;
};
