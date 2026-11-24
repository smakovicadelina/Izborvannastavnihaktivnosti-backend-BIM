const v = require("./zajednicko");

// PATCH /api/profil
function izmena(req) {
  const b = v.telo(req);
  const unos = {};

  if (v.imaPolje(b, "ime_i_prezime")) {
    unos.ime_i_prezime = v.imeIPrezime(
      b.ime_i_prezime,
      "Ime i prezime mora imati od 2 do 120 znakova."
    );
  }

  Object.assign(unos, v.opcionaTekstPolja(b, [
    ["razred_odeljenje", 20],
    ["korisnicko_ime", 50],
    ["biografija", 2000],
    ["avatar_url", 2000]
  ]));

  if (unos.korisnicko_ime && !/^[a-zA-Z0-9._-]{3,50}$/.test(unos.korisnicko_ime)) {
    throw v.greska(
      400,
      "Korisničko ime sme sadržati slova, brojeve, tačku, crticu i donju crtu (3–50 znakova)."
    );
  }
  if (unos.avatar_url && !/^https?:\/\//i.test(unos.avatar_url)) {
    throw v.greska(400, "URL avatara mora počinjati sa http:// ili https://.");
  }

  const interesovanjaIds = v.imaPolje(b, "interesovanja_ids")
    ? v.nizIdIliGreska(b.interesovanja_ids, "interesovanja_ids mora biti niz ID-jeva.")
    : undefined;

  v.zahtevajIzmene(unos, interesovanjaIds);
  return { unos, interesovanjaIds };
}

// PUT /api/profil/interesovanja  { interesovanja_ids: [1, 2] }
function interesovanja(req) {
  return {
    interesovanjaIds: v.nizIdIliGreska(
      v.telo(req).interesovanja_ids,
      "interesovanja_ids mora biti niz ID-jeva."
    )
  };
}

module.exports = { izmena, interesovanja };
