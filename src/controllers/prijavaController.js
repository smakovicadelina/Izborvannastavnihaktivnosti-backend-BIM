const prijavaService = require("../services/prijavaService");

// --- UCENIK ---------------------------------------------------------------

// POST /api/aktivnosti/:aktivnostId/prijava -> 201 Created
async function prijava(req, res) {
  const prijava = await prijavaService.prijaviSe(req.korisnik.id, req.podaci.aktivnostId);
  return res.status(201).json({ poruka: "Uspešno ste se prijavili.", prijava });
}

// DELETE /api/aktivnosti/:aktivnostId/prijava
async function otkazivanje(req, res) {
  await prijavaService.otkazi(req.korisnik.id, req.podaci.aktivnostId);
  return res.status(200).json({ poruka: "Prijava je uspešno otkazana." });
}

// --- PROFESOR -------------------------------------------------------------

// GET /api/aktivnosti/:aktivnostId/prijave?status=
async function pregled(req, res) {
  const { aktivnostId, status } = req.podaci;
  return res.status(200).json(await prijavaService.listaZaAktivnost(aktivnostId, status));
}

// POST /api/aktivnosti/:aktivnostId/prijave -> 201 Created
async function upis(req, res) {
  const { aktivnostId, ucenikId } = req.podaci;
  const prijava = await prijavaService.upisiUcenika(aktivnostId, ucenikId);
  return res.status(201).json({ poruka: "Učenik je upisan.", prijava });
}

// PATCH /api/aktivnosti/:aktivnostId/prijave/:prijavaId
async function promenaStatusa(req, res) {
  const { aktivnostId, prijavaId, status } = req.podaci;
  const prijava = await prijavaService.promeniStatus(aktivnostId, prijavaId, status);
  return res.status(200).json({ poruka: "Status prijave je ažuriran.", prijava });
}

// DELETE /api/aktivnosti/:aktivnostId/prijave/:prijavaId
async function brisanje(req, res) {
  const { aktivnostId, prijavaId } = req.podaci;
  await prijavaService.obrisi(aktivnostId, prijavaId);
  return res.status(200).json({ poruka: "Prijava je obrisana." });
}

module.exports = { prijava, otkazivanje, pregled, upis, promenaStatusa, brisanje };
