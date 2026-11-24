const profilService = require("../services/profilService");

// GET /api/profil
async function pregled(req, res) {
  const profil = await profilService.profil(req.korisnik.id, req.korisnik.email);
  return res.status(200).json({ profil });
}

// PATCH /api/profil
async function izmena(req, res) {
  const profil = await profilService.izmeni(req.korisnik.id, req.korisnik.email, req.podaci);
  return res.status(200).json({ poruka: "Profil je ažuriran.", profil });
}

// GET /api/profil/interesovanja
async function interesovanja(req, res) {
  return res.status(200).json({
    interesovanja: await profilService.interesovanjaKorisnika(req.korisnik.id)
  });
}

// PUT /api/profil/interesovanja - zamenjuje ceo skup interesovanja
async function izmenaInteresovanja(req, res) {
  await profilService.postaviInteresovanja(req.korisnik.id, req.podaci.interesovanjaIds);
  return res.status(200).json({
    poruka: "Interesovanja su sačuvana.",
    interesovanja: await profilService.interesovanjaKorisnika(req.korisnik.id)
  });
}

module.exports = { pregled, izmena, interesovanja, izmenaInteresovanja };
