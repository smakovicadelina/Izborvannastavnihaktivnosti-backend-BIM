const { dbSupabase } = require("../config/supabase");
const { greska } = require("../utils/http");

const KOLONE_PROFILA =
  "id, ime_i_prezime, uloga, razred_odeljenje, korisnicko_ime, biografija, avatar_url, kreirano_at";

async function interesovanjaKorisnika(korisnikId) {
  const { data: veze, error } = await dbSupabase
    .from("korisnik_interesovanja")
    .select("interesovanje_id")
    .eq("korisnik_id", korisnikId);
  if (error) throw error;
  if (!veze.length) return [];

  const { data, error: greskaInteresovanja } = await dbSupabase
    .from("interesovanja")
    .select("id, naziv, opis")
    .in("id", veze.map(v => v.interesovanje_id))
    .order("naziv");
  if (greskaInteresovanja) throw greskaInteresovanja;
  return data;
}

async function postaviInteresovanja(korisnikId, ids) {
  if (ids.length) {
    const { data, error } = await dbSupabase
      .from("interesovanja")
      .select("id")
      .in("id", ids);
    if (error) throw error;
    if (data.length !== ids.length) {
      throw greska(400, "Neka od izabranih interesovanja ne postoje.");
    }
  }

  const { error: brisanjeGreska } = await dbSupabase
    .from("korisnik_interesovanja")
    .delete()
    .eq("korisnik_id", korisnikId);
  if (brisanjeGreska) throw brisanjeGreska;

  if (ids.length) {
    const { error } = await dbSupabase
      .from("korisnik_interesovanja")
      .insert(ids.map(interesovanje_id => ({ korisnik_id: korisnikId, interesovanje_id })));
    if (error) throw error;
  }
}

async function ucitajProfil(korisnikId) {
  const { data, error } = await dbSupabase
    .from("korisnici")
    .select(KOLONE_PROFILA)
    .eq("id", korisnikId)
    .single();
  if (error) throw error;
  return data;
}

async function izmeniProfil(korisnikId, unos) {
  if (unos.korisnicko_ime) {
    const { data: zauzeto, error } = await dbSupabase
      .from("korisnici")
      .select("id")
      .ilike("korisnicko_ime", unos.korisnicko_ime)
      .neq("id", korisnikId)
      .limit(1);
    if (error) throw error;
    if (zauzeto.length) throw greska(409, "Korisničko ime je zauzeto.");
  }

  if (Object.keys(unos).length) {
    const { error } = await dbSupabase
      .from("korisnici")
      .update(unos)
      .eq("id", korisnikId);
    if (error) throw error;
  }
}

module.exports = {
  KOLONE_PROFILA,
  interesovanjaKorisnika,
  postaviInteresovanja,
  ucitajProfil,
  izmeniProfil
};
