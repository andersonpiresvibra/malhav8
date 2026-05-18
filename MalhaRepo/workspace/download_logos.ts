import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Buscando companhias sem logo...');
  
  const { data: airlines, error } = await supabase.from('companhias').select('*').is('logo_url', null);
  
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Encontradas ${airlines?.length || 0} companhias sem logo_url.`);
  if (!airlines) return;
  
  for (const airline of airlines) {
      const code = (airline.airline_code || '').toUpperCase();
      if (!code) continue;
      
      let initialUrl = `https://images.kiwi.com/airlines/64/${code}.png`;
      if (code === 'G3' || code === 'RG') {
        initialUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Gol_Linhas_A%C3%A9reas_Inteligentes_logo_2015.svg/320px-Gol_Linhas_A%C3%A9reas_Inteligentes_logo_2015.svg.png';
      }
      
      try {
        const res = await fetch(initialUrl);
        if (res.ok) {
           const arrayBuffer = await res.arrayBuffer();
           const buffer = Buffer.from(arrayBuffer);
           const base64 = buffer.toString('base64');
           const contentType = res.headers.get('content-type') || 'image/png';
           
           const dataUrl = `data:${contentType};base64,${base64}`;
           
           const { error: updateError } = await supabase
              .from('companhias')
              .update({ logo_url: dataUrl })
              .eq('id', airline.id);
              
           if (updateError) {
             console.error(`Erro ao atualizar ${code}:`, updateError.message);
           } else {
             console.log(`Sucesso: Logo de ${code} salvo no banco como base64!`);
           }
        } else {
           console.log(`Aviso: HTTP ${res.status} ao baixar logo para ${code}.`);
        }
      } catch (err) {
        console.error(`Erro de fetch para ${code}:`, err);
      }
  }
  console.log("Processo concluído!");
}

run();
