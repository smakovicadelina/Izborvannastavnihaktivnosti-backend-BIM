// Pomocne funkcije za izvrsavanje Supabase upita.
//
// Supabase klijent nikada ne baca izuzetak - uvek vraca objekat { data, error }.
// Ove funkcije pretvaraju "error" u pravi izuzetak, pa servis moze da pise:
//   const aktivnosti = await upit(dbSupabase.from("aktivnosti").select("*"));
// a greska automatski stize do centralnog errorHandler middleware-a.

const { tabelaNedostaje } = require("./http");

async function upit(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data || [];
}

// Za tabele iz novijih migracija: ako tabela jos ne postoji, vraca prazan niz.
async function upitOpcione(promise) {
  const { data, error } = await promise;
  if (error) {
    if (tabelaNedostaje(error)) return [];
    throw error;
  }
  return data || [];
}

// Ucitava sve redove u blokovima od 1000 (Supabase podrazumevano vraca najvise 1000).
async function sviRedovi(napraviUpit) {
  const rezultat = [];
  const korak = 1000;
  for (let od = 0; ; od += korak) {
    const { data, error } = await napraviUpit().range(od, od + korak - 1);
    if (error) throw error;
    rezultat.push(...data);
    if (data.length < korak) return rezultat;
  }
}

module.exports = { upit, upitOpcione, sviRedovi };
