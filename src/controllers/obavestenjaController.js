const obavestenjaService = require("../services/obavestenjaService");

// GET /api/obavestenja?neprocitana=true&limit=50
async function pregled(req, res) {
  return res.status(200).json(await obavestenjaService.lista(req.korisnik.id, req.podaci));
}

// PATCH /api/obavestenja/procitaj-sve
async function procitajSve(req, res) {
  await obavestenjaService.procitajSve(req.korisnik.id);
  return res.status(200).json({ poruka: "Sva obaveštenja su označena kao pročitana." });
}

// PATCH /api/obavestenja/:id/procitano
async function procitajJedno(req, res) {
  const obavestenje = await obavestenjaService.procitajJedno(req.podaci.id, req.korisnik.id);
  return res.status(200).json({ obavestenje });
}

// DELETE /api/obavestenja/:id
async function obrisi(req, res) {
  await obavestenjaService.obrisi(req.podaci.id, req.korisnik.id);
  return res.status(200).json({ poruka: "Obaveštenje je obrisano." });
}

module.exports = { pregled, procitajSve, procitajJedno, obrisi };
