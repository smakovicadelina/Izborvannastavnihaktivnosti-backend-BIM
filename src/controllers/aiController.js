const aiPreporukaService = require("../services/aiPreporukaService");

// POST /api/ai/preporuke -> 201 Created
async function kreiraj(req, res) {
  const preporuka = await aiPreporukaService.kreiraj(req.korisnik.id, req.podaci);
  return res.status(201).json({ preporuka });
}

// GET /api/ai/preporuke
async function pregled(req, res) {
  return res.status(200).json({ preporuke: await aiPreporukaService.istorija(req.korisnik.id) });
}

// GET /api/ai/preporuke/:id
async function detalji(req, res) {
  const preporuka = await aiPreporukaService.detalji(req.podaci.id, req.korisnik.id);
  return res.status(200).json({ preporuka });
}

// DELETE /api/ai/preporuke/:id
async function obrisi(req, res) {
  await aiPreporukaService.obrisi(req.podaci.id, req.korisnik.id);
  return res.status(200).json({ poruka: "Preporuka je obrisana." });
}

module.exports = { kreiraj, pregled, detalji, obrisi };
