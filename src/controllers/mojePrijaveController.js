const mojePrijaveService = require("../services/mojePrijaveService");

// GET /api/moje-prijave?status=
async function pregled(req, res) {
  const { status } = req.podaci;
  const prijave = await mojePrijaveService.mojePrijave(req.korisnik.id, status ? [status] : null);
  return res.status(200).json({ prijave });
}

// GET /api/moje-prijave/raspored
async function raspored(req, res) {
  return res.status(200).json(await mojePrijaveService.raspored(req.korisnik.id));
}

// GET /api/moje-prijave/istorija
async function istorija(req, res) {
  return res.status(200).json({ istorija: await mojePrijaveService.istorija(req.korisnik.id) });
}

module.exports = { pregled, raspored, istorija };
