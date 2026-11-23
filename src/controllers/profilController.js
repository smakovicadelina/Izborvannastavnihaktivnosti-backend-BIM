const profilService = require("../services/profilService");
const {
  greska,
  imaPolje,
  jeNeprazanTekst,
  opcioniTekst,
  nizId
} = require("../utils/http");

async function pregled(req, res) {
  const data = await profilService.ucitajProfil(req.korisnik.id);
  return res.json({
    profil: {
      ...data,
      email: req.korisnik.email,
      interesovanja: await profilService.interesovanjaKorisnika(req.korisnik.id)
    }
  });
}

async function izmena(req, res) {
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

  await profilService.izmeniProfil(req.korisnik.id, unos);
  if (interesovanjaIds !== undefined) {
    await profilService.postaviInteresovanja(req.korisnik.id, interesovanjaIds);
  }

  const data = await profilService.ucitajProfil(req.korisnik.id);
  return res.json({
    poruka: "Profil je ažuriran.",
    profil: {
      ...data,
      email: req.korisnik.email,
      interesovanja: await profilService.interesovanjaKorisnika(req.korisnik.id)
    }
  });
}

async function interesovanja(req, res) {
  return res.json({
    interesovanja: await profilService.interesovanjaKorisnika(req.korisnik.id)
  });
}

async function izmenaInteresovanja(req, res) {
  const ids = nizId(req.body?.interesovanja_ids);
  if (!ids) {
    throw greska(400, "interesovanja_ids mora biti niz ID-jeva.");
  }

  await profilService.postaviInteresovanja(req.korisnik.id, ids);
  return res.json({
    poruka: "Interesovanja su sačuvana.",
    interesovanja: await profilService.interesovanjaKorisnika(req.korisnik.id)
  });
}

module.exports = { pregled, izmena, interesovanja, izmenaInteresovanja };
