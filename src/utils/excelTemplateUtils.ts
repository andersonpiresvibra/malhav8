import * as XLSX from 'xlsx';

export const downloadTemplate = (module: string) => {
  let ws_name = "Planilha1";
  let ws_data: any[][] = [];

  switch (module) {
    case 'airlines':
      ws_data = [
        ["RAZÃO SOCIAL", "COMPANHIA", "CÓD. DA COMP", "PAÍS/REGIÃO"],
        ["Latam Airlines Brasil", "LATAM", "LA", "Brasil"],
        ["Gol Linhas Aéreas", "GOL", "G3", "Brasil"],
      ];
      ws_name = "Companhias";
      break;
    case 'aircrafts':
      ws_data = [
        ["PREFIXO", "COMPANHIA", "MODELO", "S_TAMPA", "PORTINHOLA_DEFEITO", "PAINEL_DEFEITO", "FALHA_CORTE", "OBSERVACOES"],
        ["PR-XMB", "G3", "B738", "NAO", "NAO", "NAO", "NAO", "Ok"],
        ["PR-GEA", "G3", "B737-7", "SIM", "NAO", "SIM", "NAO", "Tampa quebrada"],
      ];
      ws_name = "Aeronaves";
      break;
    case 'malha_raiz':
      ws_data = [
        ["VÔO", "ICAO", "ETA", "ETD", "PREFIXO", "MODELO", "POSIÇÃO"],
        ["LA3396", "SBPS", "22:50", "00:00", "PR-XMB", "A320", "J12"],
        ["G31644", "SBRJ", "14:30", "15:30", "PR-GEA", "B738", "J10"],
      ];
      ws_name = "Voos";
      break;
    case 'operators':
      ws_data = [
        ["MATRICULA", "NOME_COMPLETO", "NOME_DE_GUERRA", "CARGO", "EMPRESA", "ALA", "ESCALA"],
        ["12345", "João Silva", "SILVA", "OPERADOR", "BR Aviation", "A", "Turno 1"],
        ["54321", "Maria Santos", "SANTOS", "LÍDER", "BR Aviation", "B", "Turno 2"],
      ];
      ws_name = "Operadores";
      break;
    default:
      return;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // Auto-size columns to fit content
  const colWidths = ws_data[0].map((col) => ({ wch: col.length + 5 }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, ws_name);
  
  // Create file and trigger download
  XLSX.writeFile(wb, `modelo_importacao_${module}.xlsx`);
};
