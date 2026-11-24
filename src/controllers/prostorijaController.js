const prostorijaService = require("../services/prostorijaService");

// GET /api/prostorije
async function pregled(req, res) {
  return res.status(200).json({ prostorije: await prostorijaService.lista() });
}

// GET /api/prostorije/:id
async function detalji(req, res) {
  return res.status(200).json({ prostorija: await prostorijaService.detalji(req.podaci.id) });
}

// GET /api/prostorije/:id/dostupnost?dan=&vreme_od=&vreme_do=
async function dostupnost(req, res) {
  return res.status(200).json(await prostorijaService.dostupnost(req.podaci.termin));
}

// POST /api/prostorije -> 201 Created
async function kreiranje(req, res) {
  return res.status(201).json({ prostorija: await prostorijaService.kreiraj(req.podaci.unos) });
}

// PATCH /api/prostorije/:id
async function uredivanje(req, res) {
  const { id, unos } = req.podaci;
  return res.status(200).json({ prostorija: await prostorijaService.izmeni(id, unos) });
}

// DELETE /api/prostorije/:id
async function brisanje(req, res) {
  await prostorijaService.obrisi(req.podaci.id);
  return res.status(200).json({ poruka: "Prostorija je obrisana." });
}

module.exports = { pregled, detalji, dostupnost, kreiranje, uredivanje, brisanje };
