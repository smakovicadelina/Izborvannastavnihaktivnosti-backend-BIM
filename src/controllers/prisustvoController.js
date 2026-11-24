const prisustvoService = require("../services/prisustvoService");

// POST /api/prisustva/skeniraj (ucenik) -> 201 novo prisustvo / 200 vec evidentirano
async function skeniraj(req, res) {
  const { prisustvo, novo, aktivnost } = await prisustvoService.skeniraj(
    req.korisnik.id,
    req.podaci.kod
  );
  return res.status(novo ? 201 : 200).json({
    poruka: `Prisustvo na aktivnosti "${aktivnost.naziv}" je evidentirano.`,
    prisustvo
  });
}

// GET /api/prisustva?aktivnost_id=&datum= (profesor)
async function pregled(req, res) {
  const { aktivnostId, datum } = req.podaci;
  return res.status(200).json({ prisustva: await prisustvoService.zaAktivnost(aktivnostId, datum) });
}

// POST /api/prisustva (profesor)
async function kreiranje(req, res) {
  const { prisustvo, novo } = await prisustvoService.evidentirajRucno(req.podaci);
  return res.status(novo ? 201 : 200).json({ prisustvo });
}

// PATCH /api/prisustva/:id (profesor)
async function uredivanje(req, res) {
  const { id, unos } = req.podaci;
  return res.status(200).json({ prisustvo: await prisustvoService.izmeni(id, unos) });
}

// DELETE /api/prisustva/:id (profesor)
async function brisanje(req, res) {
  await prisustvoService.obrisi(req.podaci.id);
  return res.status(200).json({ poruka: "Evidencija prisustva je obrisana." });
}

module.exports = { skeniraj, pregled, kreiranje, uredivanje, brisanje };
