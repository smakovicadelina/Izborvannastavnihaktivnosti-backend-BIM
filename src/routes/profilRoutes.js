
const express = require("express");
const { dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const {
  greska,
  imaPolje,
  jeNeprazanTekst,
  opcioniTekst,
  nizId
} = require("../utils/http");

const router = express.Router();
router.use(zahtevajPrijavu);

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

// Upisuje interesovanja korisnika (zamenjuje postojeca).
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

// MOJ PROFIL
router.get("/", async (req, res) => {
  const { data, error } = await dbSupabase
    .from("korisnici")
    .select(KOLONE_PROFILA)
    .eq("id", req.korisnik.id)
    .single();
  if (error) throw error;

  return res.json({
    profil: {
      ...data,
      email: req.korisnik.email,
      interesovanja: await interesovanjaKorisnika(req.korisnik.id)
    }
  });
});

// IZMENA PROFILA (uloga se ne moze menjati ovde)
router.patch("/", async (req, res) => {
  const b = req.body || {};
  const unos = {};

  if (imaPolje(b, "ime_i_prezime")) {
    if (!jeNeprazanTekst(b.ime_i_prezime, 120) || b.ime_i_prezime.trim().length < 2) {
      throw greska(400, "Ime i prezime mora imati od 2 do 120 znakova.");
    }
    unos.ime_i_prezime = b.ime_i_prezime.trim();
  }

  for (const [polje, maks] of [
    ["razred_odeljenje", 20],
    ["korisnicko_ime", 50],
    ["biografija", 2000],
    ["avatar_url", 2000]
  ]) {
    if (imaPolje(b, polje)) {
      const v = opcioniTekst(b[polje], maks);
      if (!v.ok) throw greska(400, `Polje ${polje} nije ispravno.`);
      unos[polje] = v.vrednost;
    }
  }

  if (unos.korisnicko_ime && !/^[a-zA-Z0-9._-]{3,50}$/.test(unos.korisnicko_ime)) {
    throw greska(400, "Korisničko ime sme sadržati slova, brojeve, tačku, crticu i donju crtu (3–50 znakova).");
  }

  if (unos.avatar_url && !/^https?:\/\//i.test(unos.avatar_url)) {
    throw greska(400, "URL avatara mora počinjati sa http:// ili https://.");
  }

  const interesovanjaIds = imaPolje(b, "interesovanja_ids")
    ? nizId(b.interesovanja_ids)
    : undefined;
  if (interesovanjaIds === null) {
    throw greska(400, "interesovanja_ids mora biti niz ID-jeva.");
  }

  if (!Object.keys(unos).length && interesovanjaIds === undefined) {
    throw greska(400, "Nema podataka za izmenu.");
  }

  if (unos.korisnicko_ime) {
    const { data: zauzeto, error } = await dbSupabase
      .from("korisnici")
      .select("id")
      .ilike("korisnicko_ime", unos.korisnicko_ime)
      .neq("id", req.korisnik.id)
      .limit(1);
    if (error) throw error;
    if (zauzeto.length) throw greska(409, "Korisničko ime je zauzeto.");
  }

  if (Object.keys(unos).length) {
    const { error } = await dbSupabase
      .from("korisnici")
      .update(unos)
      .eq("id", req.korisnik.id);
    if (error) throw error;
  }

  if (interesovanjaIds !== undefined) {
    await postaviInteresovanja(req.korisnik.id, interesovanjaIds);
  }

  const { data, error } = await dbSupabase
    .from("korisnici")
    .select(KOLONE_PROFILA)
    .eq("id", req.korisnik.id)
    .single();
  if (error) throw error;

  return res.json({
    poruka: "Profil je ažuriran.",
    profil: {
      ...data,
      email: req.korisnik.email,
      interesovanja: await interesovanjaKorisnika(req.korisnik.id)
    }
  });
});

// MOJA INTERESOVANJA
router.get("/interesovanja", async (req, res) => {
  return res.json({
    interesovanja: await interesovanjaKorisnika(req.korisnik.id)
  });
});

router.put("/interesovanja", async (req, res) => {
  const ids = nizId(req.body?.interesovanja_ids);
  if (!ids) {
    throw greska(400, "interesovanja_ids mora biti niz ID-jeva.");
  }

  await postaviInteresovanja(req.korisnik.id, ids);

  return res.json({
    poruka: "Interesovanja su sačuvana.",
    interesovanja: await interesovanjaKorisnika(req.korisnik.id)
  });
});

module.exports = router;
module.exports.interesovanjaKorisnika = interesovanjaKorisnika;
module.exports.postaviInteresovanja = postaviInteresovanja;
