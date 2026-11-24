const terminService = require("../services/terminService");

// GET /api/termini?prostorija_id=&dan=
async function pregled(req, res) {
  return res.status(200).json({ termini: await terminService.lista(req.podaci) });
}

// GET /api/termini/:id
async function detalji(req, res) {
  return res.status(200).json({ termin: await terminService.detalji(req.podaci.id) });
}

// POST /api/termini -> 201 Created
async function kreiranje(req, res) {
  const termin = await terminService.kreiraj(req.podaci.termin);
  return res.status(201).json({ poruka: "Termin je uspešno kreiran.", termin });
}

// PATCH /api/termini/:id
async function uredivanje(req, res) {
  const { id, unos } = req.podaci;
  const termin = await terminService.izmeni(id, unos);
  return res.status(200).json({ poruka: "Termin je izmenjen.", termin });
}

// DELETE /api/termini/:id
async function brisanje(req, res) {
  await terminService.obrisi(req.podaci.id);
  return res.status(200).json({ poruka: "Termin je obrisan." });
}

module.exports = { pregled, detalji, kreiranje, uredivanje, brisanje };
