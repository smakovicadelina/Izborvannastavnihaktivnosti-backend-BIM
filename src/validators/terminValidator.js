const v = require("./zajednicko");
const { ispravnoVreme, sekundeOdPonoci } = require("../utils/vreme");

const POLJA = ["dan_u_nedelji", "vreme_od", "vreme_do", "prostorija_id"];
const id = req => v.idParam(req, "id", "Neispravan ID termina.");

// Kompletan termin: dan 1-7, vreme HH:MM, vreme_od < vreme_do, postojeci ID prostorije.
function jeValidanTermin(t) {
  return Number.isInteger(t.dan_u_nedelji) &&
    t.dan_u_nedelji >= 1 && t.dan_u_nedelji <= 7 &&
    ispravnoVreme(t.vreme_od) && ispravnoVreme(t.vreme_do) &&
    sekundeOdPonoci(t.vreme_od) < sekundeOdPonoci(t.vreme_do) &&
    Number.isSafeInteger(t.prostorija_id) && t.prostorija_id > 0;
}

// GET /api/termini?prostorija_id=&dan=
function pregled(req) {
  const filteri = {};
  if (req.query.prostorija_id !== undefined) {
    filteri.prostorijaId = v.parsirajId(req.query.prostorija_id);
    if (!filteri.prostorijaId) throw v.greska(400, "Neispravan ID prostorije.");
  }
  if (req.query.dan !== undefined) {
    const dan = v.parsirajId(req.query.dan);
    if (!dan || dan > 7) throw v.greska(400, "Dan mora biti broj od 1 do 7.");
    filteri.dan = dan;
  }
  return filteri;
}

function samoId(req) {
  return { id: id(req) };
}

// POST /api/termini
function kreiranje(req) {
  const b = v.telo(req);
  const termin = Object.fromEntries(POLJA.map(p => [p, b[p]]));
  if (!jeValidanTermin(termin)) throw v.greska(400, "Neispravni podaci o terminu.");
  return { termin };
}

// PATCH /api/termini/:id - salju se samo polja koja se menjaju.
// Kompletna provera (npr. vreme_od < vreme_do) radi se u servisu,
// posle spajanja sa postojecim terminom iz baze.
function uredivanje(req) {
  const b = v.telo(req);
  const unos = {};
  for (const polje of POLJA) {
    if (v.imaPolje(b, polje)) unos[polje] = b[polje];
  }
  v.zahtevajIzmene(unos);
  return { id: id(req), unos };
}

module.exports = { jeValidanTermin, pregled, samoId, kreiranje, uredivanje };
