const v = require("./zajednicko");

const STATUSI_ZAHTEVA = ["na_cekanju", "odobren", "odbijen"];

const ucenikId = req => v.uuidParam(req, "id", "Neispravan ID učenika.");

// GET /api/admin/ucenici?q=&razred=
function listaUcenika(req) {
  const { q, razred } = req.query;
  return {
    q: typeof q === "string" && q.trim() ? q.trim() : undefined,
    razred: typeof razred === "string" && razred.trim() ? razred.trim() : undefined
  };
}

function samoUcenikId(req) {
  return { id: ucenikId(req) };
}

// POST /api/admin/ucenici
function kreiranjeUcenika(req) {
  const b = v.telo(req);
  const imeIPrezime = v.imeIPrezime(b.ime_i_prezime);
  const email = v.email(b.email);
  const lozinka = v.lozinka(b.lozinka);
  const razred = v.opcioniTekst(b.razred_odeljenje, 20);
  if (!razred.ok) throw v.greska(400, "Razred/odeljenje nije ispravno.");
  const interesovanjaIds = v.imaPolje(b, "interesovanja_ids")
    ? v.nizIdIliGreska(b.interesovanja_ids, "interesovanja_ids mora biti niz ID-jeva.")
    : [];
  return { imeIPrezime, email, lozinka, razred: razred.vrednost, interesovanjaIds };
}

// PATCH /api/admin/ucenici/:id
function azuriranjeUcenika(req) {
  const id = ucenikId(req);
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
    ["biografija", 2000]
  ]));
  const interesovanjaIds = v.imaPolje(b, "interesovanja_ids")
    ? v.nizIdIliGreska(b.interesovanja_ids, "interesovanja_ids mora biti niz ID-jeva.")
    : undefined;
  v.zahtevajIzmene(unos, interesovanjaIds);
  return { id, unos, interesovanjaIds };
}

// GET /api/admin/zahtevi-za-profesora?status=
function listaZahteva(req) {
  const { status } = req.query;
  if (status !== undefined && !STATUSI_ZAHTEVA.includes(status)) {
    throw v.greska(400, "Status mora biti na_cekanju, odobren ili odbijen.");
  }
  return { status };
}

// PATCH /api/admin/zahtevi-za-profesora/:id  { status: "odobren" | "odbijen" }
function obradaZahteva(req) {
  const id = v.idParam(req, "id", "Neispravan ID zahteva.");
  const status = v.telo(req).status;
  if (!["odobren", "odbijen"].includes(status)) {
    throw v.greska(400, "Status mora biti odobren ili odbijen.");
  }
  return { id, status };
}

// GET /api/admin/prijave?status=&aktivnost_id=
function listaPrijava(req) {
  const { aktivnost_id } = req.query;
  const status = v.opcioniStatusPrijave(req.query.status);
  let aktivnostId;
  if (aktivnost_id !== undefined) {
    aktivnostId = v.parsirajId(aktivnost_id);
    if (!aktivnostId) throw v.greska(400, "Neispravan ID aktivnosti.");
  }
  return { status, aktivnostId };
}

module.exports = {
  listaUcenika,
  samoUcenikId,
  kreiranjeUcenika,
  azuriranjeUcenika,
  listaZahteva,
  obradaZahteva,
  listaPrijava
};
