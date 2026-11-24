// Kontroler: prima HTTP zahtev, poziva servis i vraca HTTP odgovor.
// Podaci su vec provereni u validiraj middleware-u (req.podaci), a greske
// iz servisa (throw) Express 5 automatski prosledjuje errorHandler-u.

const authService = require("../services/authService");
const { izvuciToken } = require("../middleware/zahtevajPrijavu");

// POST /api/auth/registracija -> 201 Created
async function registracija(req, res) {
  const rezultat = await authService.registruj(req.podaci);
  return res.status(201).json(rezultat);
}

// POST /api/auth/prijava -> 200 OK + token
async function prijava(req, res) {
  return res.status(200).json(await authService.prijavi(req.podaci));
}

// POST /api/auth/osvezi-token
async function osveziToken(req, res) {
  return res.status(200).json(await authService.osveziSesiju(req.podaci));
}

// POST /api/auth/odjava (zasticena ruta)
async function odjava(req, res) {
  await authService.odjavi(izvuciToken(req));
  return res.status(200).json({ poruka: "Uspešno ste odjavljeni." });
}

// GET /api/auth/me - podatke je vec ucitao middleware zahtevajPrijavu
async function trenutniKorisnik(req, res) {
  return res.status(200).json({ korisnik: { ...req.profil, email: req.korisnik.email } });
}

// GET /api/auth/zahtev-za-profesora
async function pregledZahteva(req, res) {
  const zahtev = await authService.zahtevProfesora(req.korisnik.id);
  return res.status(200).json({ zahtev_za_profesora: zahtev });
}

// POST /api/auth/zahtev-za-profesora
async function zahtevZaProfesora(req, res) {
  const zahtev = await authService.podnesiZahtevProfesora(req.profil);
  return res.status(200).json({
    poruka: "Zahtjev za profesorski nalog je na čekanju.",
    zahtev_za_profesora: zahtev
  });
}

module.exports = {
  registracija,
  prijava,
  osveziToken,
  odjava,
  trenutniKorisnik,
  pregledZahteva,
  zahtevZaProfesora
};
