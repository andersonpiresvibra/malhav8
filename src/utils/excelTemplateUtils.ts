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

    case 'operators':
      ws_data = [
        ["NOME GUERRA", "NOME COMPL.", "FUNÇÃO", "LT", "MATRI VIBRA", "MATR. GRU", "LOG. TMF", "TIP. S", "E-MAIL", "PÁTIO", "TURNO", "HR. ENT", "HR SAID", "STATUS"],
        ["CESARIO", "CESARIO DE SOUZA", "OPERADOR", "SIM", "12345", "98765", "cesario.tmf", "O+", "cesario@vibraenergia.com.br", "AERODROMO", "MANHÃ", "06:00", "15:00", "ATIVO"],
        ["MICHEL", "MICHEL SANTOS", "OPERADOR", "NÃO", "54321", "12309", "michel.tmf", "A-", "michel@vibraenergia.com.br", "AERODROMO", "MANHÃ", "05:00", "14:00", "ATIVO"]
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
