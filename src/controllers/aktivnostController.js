const aktivnostService = require("../services/aktivnostService");

// Ulogovani korisnik ili null (rute sa opcionom prijavom).
const korisnik = req => (req.korisnik ? { id: req.korisnik.id, uloga: req.profil.uloga } : null);

// GET /api/aktivnosti - pregled, pretraga i filtriranje (javno)
async function pregled(req, res) {
  return res.status(200).json(await aktivnostService.pregled(req.podaci, korisnik(req)));
}

// GET /api/aktivnosti/:aktivnostId
async function detalji(req, res) {
  const aktivnost = await aktivnostService.detalji(req.podaci.aktivnostId, korisnik(req));
  return res.status(200).json({ aktivnost });
}

// POST /api/aktivnosti (profesor) -> 201 Created
async function kreiranje(req, res) {
  const aktivnost = await aktivnostService.kreiraj(req.korisnik.id, req.podaci);
  return res.status(201).json(aktivnost);
}

// PATCH /api/aktivnosti/:aktivnostId (profesor)
async function uredivanje(req, res) {
  const { aktivnostId, unos, veze } = req.podaci;
  return res.status(200).json(await aktivnostService.uredi(aktivnostId, { unos, veze }));
}

// PATCH /api/aktivnosti/:aktivnostId/deaktiviraj (profesor)
async function deaktiviranje(req, res) {
  const aktivnost = await aktivnostService.postaviAktivnost(req.podaci.aktivnostId, false);
  return res.status(200).json({ poruka: "Aktivnost je deaktivirana.", aktivnost });
}

// PATCH /api/aktivnosti/:aktivnostId/aktiviraj (profesor)
async function aktiviranje(req, res) {
  const aktivnost = await aktivnostService.postaviAktivnost(req.podaci.aktivnostId, true);
  return res.status(200).json({ poruka: "Aktivnost je aktivirana.", aktivnost });
}

// DELETE /api/aktivnosti/:aktivnostId (profesor)
async function brisanje(req, res) {
  await aktivnostService.obrisi(req.podaci.aktivnostId);
  return res.status(200).json({ poruka: "Aktivnost je obrisana." });
}

// GET /api/aktivnosti/:aktivnostId/qr (profesor)
async function qrKod(req, res) {
  return res.status(200).json(await aktivnostService.qrKod(req.podaci));
}

module.exports = {
  pregled,
  detalji,
  kreiranje,
  uredivanje,
  deaktiviranje,
  aktiviranje,
  brisanje,
  qrKod
};
