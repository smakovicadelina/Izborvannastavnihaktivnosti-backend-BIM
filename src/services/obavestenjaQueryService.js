const { dbSupabase } = require("../config/supabase");
const { greska } = require("../utils/http");

async function lista(korisnikId, samoNeprocitana, limit) {
  let q = dbSupabase
    .from("obavestenja")
    .select("id, tip, naslov, poruka, aktivnost_id, procitano, kreirano_at")
    .eq("korisnik_id", korisnikId)
    .order("kreirano_at", { ascending: false })
    .limit(limit);
  if (samoNeprocitana) q = q.eq("procitano", false);

  const { data, error } = await q;
  if (error) throw error;

  const { count, error: countError } = await dbSupabase
    .from("obavestenja")
    .select("id", { count: "exact", head: true })
    .eq("korisnik_id", korisnikId)
    .eq("procitano", false);
  if (countError) throw countError;
  return { obavestenja: data, broj_neprocitanih: count || 0 };
}

async function procitajSve(korisnikId) {
  const { error } = await dbSupabase
    .from("obavestenja")
    .update({ procitano: true })
    .eq("korisnik_id", korisnikId)
    .eq("procitano", false);
  if (error) throw error;
}

async function procitajJedno(id, korisnikId) {
  const { data, error } = await dbSupabase
    .from("obavestenja")
    .update({ procitano: true })
    .eq("id", id)
    .eq("korisnik_id", korisnikId)
    .select("id, procitano")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Obaveštenje nije pronađeno.");
  return data;
}

async function obrisi(id, korisnikId) {
  const { data, error } = await dbSupabase
    .from("obavestenja")
    .delete()
    .eq("id", id)
    .eq("korisnik_id", korisnikId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Obaveštenje nije pronađeno.");
}

module.exports = { lista, procitajSve, procitajJedno, obrisi };
