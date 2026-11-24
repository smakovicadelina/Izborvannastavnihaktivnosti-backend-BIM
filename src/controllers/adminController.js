const adminService = require("../services/adminService");

// GET /api/admin/ucenici?q=&razred=
async function pregledUcenika(req, res) {
  return res.status(200).json({ ucenici: await adminService.listaUcenika(req.podaci) });
}

// GET /api/admin/ucenici/:id
async function detaljiUcenika(req, res) {
  return res.status(200).json({ ucenik: await adminService.detaljiUcenika(req.podaci.id) });
}

// POST /api/admin/ucenici -> 201 Created
async function kreiranjeUcenika(req, res) {
  const ucenik = await adminService.kreirajUcenika(req.podaci);
  return res.status(201).json({ poruka: "Učenik je kreiran.", ucenik });
}

// PATCH /api/admin/ucenici/:id
async function azuriranjeUcenika(req, res) {
  const { id, unos, interesovanjaIds } = req.podaci;
  const ucenik = await adminService.izmeniUcenika(id, { unos, interesovanjaIds });
  return res.status(200).json({ poruka: "Podaci učenika su ažurirani.", ucenik });
}

// DELETE /api/admin/ucenici/:id
async function brisanjeUcenika(req, res) {
  await adminService.obrisiUcenika(req.podaci.id);
  return res.status(200).json({ poruka: "Učenik je obrisan." });
}

// GET /api/admin/zahtevi-za-profesora?status=
async function pregledZahteva(req, res) {
  return res.status(200).json({ zahtevi: await adminService.listaZahteva(req.podaci.status) });
}

// PATCH /api/admin/zahtevi-za-profesora/:id
async function obradaZahteva(req, res) {
  const { id, status } = req.podaci;
  return res.status(200).json({ zahtev: await adminService.obradiZahtev(id, status) });
}

// GET /api/admin/prijave?status=&aktivnost_id=
async function pregledPrijava(req, res) {
  return res.status(200).json({ prijave: await adminService.listaPrijava(req.podaci) });
}

// GET /api/admin/statistika
async function statistika(req, res) {
  return res.status(200).json(await adminService.statistika());
}

module.exports = {
  pregledUcenika,
  detaljiUcenika,
  kreiranjeUcenika,
  azuriranjeUcenika,
  brisanjeUcenika,
  pregledZahteva,
  obradaZahteva,
  pregledPrijava,
  statistika
};
