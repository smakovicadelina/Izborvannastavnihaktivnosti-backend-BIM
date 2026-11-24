const v = require("./zajednicko");
const { ispravnoVreme, sekundeOdPonoci } = require("../utils/vreme");

const id = req => v.idParam(req, "id", "Neispravan ID prostorije.");

function kapacitet(vrednost, poruka) {
  if (!Number.isInteger(vrednost) || vrednost < 1) throw v.greska(400, poruka);
  return vrednost;
}

function samoId(req) {
  return { id: id(req) };
}

// GET /api/prostorije/:id/dostupnost?dan=&vreme_od=&vreme_do=
function dostupnost(req) {
  const prostorijaId = id(req);
  const dan = v.parsirajId(req.query.dan);
  const { vreme_od, vreme_do } = req.query;
  if (
    !dan || dan > 7 ||
    !ispravnoVreme(vreme_od) ||
    !ispravnoVreme(vreme_do) ||
    sekundeOdPonoci(vreme_od) >= sekundeOdPonoci(vreme_do)
  ) {
    throw v.greska(
      400,
      "Navedite dan (1–7), vreme_od i vreme_do (HH:MM), gde je vreme_od pre vreme_do."
    );
  }
  return {
    id: prostorijaId,
    termin: { prostorija_id: prostorijaId, dan_u_nedelji: dan, vreme_od, vreme_do }
  };
}

// POST /api/prostorije  { naziv, kapacitet, opis? }
function kreiranje(req) {
  const b = v.telo(req);
  const opis = v.opcioniTekst(b.opis === undefined ? null : b.opis, 2000);
  if (!v.jeNeprazanTekst(b.naziv, 100) || !opis.ok) {
    throw v.greska(400, "Neispravni podaci o prostoriji.");
  }
  return {
    unos: {
      naziv: b.naziv.trim(),
      kapacitet: kapacitet(b.kapacitet, "Neispravni podaci o prostoriji."),
      opis: opis.vrednost
    }
  };
}

// PATCH /api/prostorije/:id
function uredivanje(req) {
  const b = v.telo(req);
  const unos = {};
  if (v.imaPolje(b, "naziv")) {
    if (!v.jeNeprazanTekst(b.naziv, 100)) throw v.greska(400, "Naziv nije ispravan.");
    unos.naziv = b.naziv.trim();
  }
  if (v.imaPolje(b, "kapacitet")) {
    unos.kapacitet = kapacitet(b.kapacitet, "Kapacitet nije ispravan.");
  }
  if (v.imaPolje(b, "opis")) {
    const opis = v.opcioniTekst(b.opis, 2000);
    if (!opis.ok) throw v.greska(400, "Opis nije ispravan.");
    unos.opis = opis.vrednost;
  }
  v.zahtevajIzmene(unos);
  return { id: id(req), unos };
}

module.exports = { samoId, dostupnost, kreiranje, uredivanje };
