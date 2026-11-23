const servis = require("../services/prostorijaService");
const {
  greska,
  imaPolje,
  zahtevajId,
  parsirajId,
  jeNeprazanTekst,
  opcioniTekst
} = require("../utils/http");
const { ispravnoVreme, sekundeOdPonoci, nazivDana } = require("../utils/vreme");

async function pregled(req, res) {
  return res.json({ prostorije: await servis.lista() });
}

async function detalji(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID prostorije.");
  const data = await servis.detalji(id);
  return res.json({
    prostorija: {
      ...data,
      termini: data.termini.map(t => ({ ...t, dan: nazivDana(t.dan_u_nedelji) }))
    }
  });
}

async function dostupnost(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID prostorije.");
  const dan = parsirajId(req.query.dan);
  const { vreme_od, vreme_do } = req.query;
  if (
    !dan || dan > 7 ||
    !ispravnoVreme(vreme_od) ||
    !ispravnoVreme(vreme_do) ||
    sekundeOdPonoci(vreme_od) >= sekundeOdPonoci(vreme_do)
  ) {
    throw greska(400, "Navedite dan (1–7), vreme_od i vreme_do (HH:MM), gde je vreme_od pre vreme_do.");
  }
  return res.json(await servis.dostupnost(id, {
    prostorija_id: id,
    dan_u_nedelji: dan,
    vreme_od,
    vreme_do
  }));
}

async function kreiranje(req, res) {
  const { naziv, kapacitet, opis = null } = req.body || {};
  const opisV = opcioniTekst(opis, 2000);
  if (
    !jeNeprazanTekst(naziv, 100) ||
    !Number.isInteger(kapacitet) ||
    kapacitet < 1 ||
    !opisV.ok
  ) throw greska(400, "Neispravni podaci o prostoriji.");

  const data = await servis.kreiraj({
    naziv: naziv.trim(), kapacitet, opis: opisV.vrednost
  });
  return res.status(201).json({ prostorija: data });
}

async function uredivanje(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID prostorije.");
  const unos = {};
  const body = req.body || {};
  if (imaPolje(body, "naziv")) {
    if (!jeNeprazanTekst(body.naziv, 100)) throw greska(400, "Naziv nije ispravan.");
    unos.naziv = body.naziv.trim();
  }
  if (imaPolje(body, "kapacitet")) {
    if (!Number.isInteger(body.kapacitet) || body.kapacitet < 1) {
      throw greska(400, "Kapacitet nije ispravan.");
    }
    unos.kapacitet = body.kapacitet;
  }
  if (imaPolje(body, "opis")) {
    const opis = opcioniTekst(body.opis, 2000);
    if (!opis.ok) throw greska(400, "Opis nije ispravan.");
    unos.opis = opis.vrednost;
  }
  if (!Object.keys(unos).length) throw greska(400, "Nema podataka za izmenu.");
  return res.json({ prostorija: await servis.izmeni(id, unos) });
}

async function brisanje(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID prostorije.");
  await servis.obrisi(id);
  return res.json({ poruka: "Prostorija je obrisana." });
}

module.exports = { pregled, detalji, dostupnost, kreiranje, uredivanje, brisanje };
