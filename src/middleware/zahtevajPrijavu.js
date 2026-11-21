
const {
  authSupabase,
  dbSupabase
} = require("../config/supabase");

function izvuciToken(req) {
  const authorization = req.headers.authorization || "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match ? match[1] : null;
}

// Vraca { korisnik, profil } ili baca objekat { status, greska }.
async function ucitajKorisnika(token) {
  const { data, error } = await authSupabase.auth.getUser(token);

  if (error || !data?.user) {
    throw { status: 401, greska: "Nevažeći ili istekao token." };
  }

  const { data: profil, error: profilGreska } = await dbSupabase
    .from("korisnici")
    .select("id, ime_i_prezime, uloga, razred_odeljenje")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profilGreska) {
    console.error("Provera korisničkog profila:", profilGreska);
    throw { status: 500, greska: "Greška pri proveri korisnika." };
  }

  if (!profil) {
    throw { status: 403, greska: "Korisnički profil ne postoji." };
  }

  return { korisnik: data.user, profil };
}

async function zahtevajPrijavu(req, res, next) {
  try {
    const token = izvuciToken(req);

    if (!token) {
      return res.status(401).json({
        greska: "Morate biti prijavljeni."
      });
    }

    const { korisnik, profil } = await ucitajKorisnika(token);
    req.korisnik = korisnik;
    req.profil = profil;

    return next();
  } catch (error) {
    if (error && error.status && error.greska) {
      return res.status(error.status).json({ greska: error.greska });
    }

    console.error("Autentifikacija:", error);

    return res.status(500).json({
      greska: "Greška pri autentifikaciji."
    });
  }
}

// Za javne rute: ako je token poslat i ispravan, popunjava req.korisnik/req.profil,
// a u suprotnom nastavlja kao anonimni korisnik.
async function opcionaPrijava(req, res, next) {
  const token = izvuciToken(req);
  if (!token) return next();

  try {
    const { korisnik, profil } = await ucitajKorisnika(token);
    req.korisnik = korisnik;
    req.profil = profil;
  } catch {
    // Neispravan token na javnoj ruti tretiramo kao anonimni zahtev.
  }

  return next();
}

module.exports = zahtevajPrijavu;
module.exports.opcionaPrijava = opcionaPrijava;
module.exports.izvuciToken = izvuciToken;
