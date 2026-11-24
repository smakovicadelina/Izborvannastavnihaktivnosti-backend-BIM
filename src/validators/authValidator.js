const v = require("./zajednicko");

const DOZVOLJENE_ULOGE = ["ucenik", "profesor"];

// POST /api/auth/registracija
function registracija(req) {
  const b = v.telo(req);
  // "ime" je zadrzano kao alternativni naziv polja zbog starijeg frontenda.
  const ime = typeof b.ime_i_prezime === "string" ? b.ime_i_prezime : b.ime;
  const trazenaUloga = b.uloga === undefined ? "ucenik" : b.uloga;

  const podaci = {
    imeIPrezime: v.imeIPrezime(ime),
    email: v.email(b.email),
    lozinka: v.lozinka(b.lozinka)
  };
  if (!DOZVOLJENE_ULOGE.includes(trazenaUloga)) {
    throw v.greska(400, "Uloga mora biti ucenik ili profesor.");
  }
  return { ...podaci, trazenaUloga };
}

// POST /api/auth/prijava
function prijava(req) {
  const { email, lozinka } = v.telo(req);
  if (
    typeof email !== "string" ||
    !v.EMAIL_REGEX.test(email.trim()) ||
    typeof lozinka !== "string" ||
    !lozinka
  ) {
    throw v.greska(400, "Unesite ispravan email i lozinku.");
  }
  return { email: email.trim().toLowerCase(), lozinka };
}

// POST /api/auth/osvezi-token
function osveziToken(req) {
  const refreshToken = v.telo(req).refresh_token;
  if (typeof refreshToken !== "string" || !refreshToken.trim()) {
    throw v.greska(400, "Refresh token je obavezan.");
  }
  return { refreshToken: refreshToken.trim() };
}

module.exports = { registracija, prijava, osveziToken };
