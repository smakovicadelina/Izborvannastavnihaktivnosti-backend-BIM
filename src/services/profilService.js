// Profil ulogovanog korisnika i njegova interesovanja.
// korisnici(id = auth.users.id, ime_i_prezime, uloga, razred_odeljenje, ...)
// korisnik_interesovanja(korisnik_id -> korisnici, interesovanje_id -> interesovanja)

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

// Zamenjuje sva interesovanja korisnika novim skupom (brisanje + upis u poveznu tabelu).
async function postaviInteresovanja(korisnikId, ids) {
  if (ids.length) {
    const { data, error } = await dbSupabase.from("interesovanja").select("id").in("id", ids);
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

// READ - kompletan profil (red iz "korisnici" + email iz Auth-a + interesovanja)
async function profil(korisnikId, email) {
  const { data, error } = await dbSupabase
    .from("korisnici")
    .select(KOLONE_PROFILA)
    .eq("id", korisnikId)
    .single();
  if (error) throw error;
  return { ...data, email, interesovanja: await interesovanjaKorisnika(korisnikId) };
}

// UPDATE - izmena profila; korisnicko ime mora biti jedinstveno.
async function izmeni(korisnikId, email, { unos, interesovanjaIds }) {
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
    const { error } = await dbSupabase.from("korisnici").update(unos).eq("id", korisnikId);
    if (error) throw error;
  }
  if (interesovanjaIds !== undefined) {
    await postaviInteresovanja(korisnikId, interesovanjaIds);
  }
  return profil(korisnikId, email);
}

module.exports = {
  KOLONE_PROFILA,
  interesovanjaKorisnika,
  postaviInteresovanja,
  profil,
  izmeni
};
