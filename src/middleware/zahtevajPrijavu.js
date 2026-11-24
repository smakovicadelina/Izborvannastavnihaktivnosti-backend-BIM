// AUTENTIFIKACIJA - provera ko salje zahtev.
//
// Klijent (Postman, React Native aplikacija) salje zaglavlje:
//   Authorization: Bearer <access_token>
// Token je dobijen pri prijavi (POST /api/auth/prijava). Middleware ga
// proverava kod Supabase Auth-a, ucitava profil iz tabele "korisnici" i
// upisuje ga u req.korisnik / req.profil, pa ga kontroleri i servisi koriste
// (npr. req.korisnik.id kao ID ulogovanog ucenika).

const { authSupabase, dbSupabase } = require("../config/supabase");
const { greska } = require("../utils/http");

function izvuciToken(req) {
  const authorization = req.headers.authorization || "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match ? match[1] : null;
}

// Vraca { korisnik, profil } ili baca HttpGreska (401/403).
async function ucitajKorisnika(token) {
  // Supabase proverava potpis i rok vazenja JWT tokena.
  const { data, error } = await authSupabase.auth.getUser(token);
  if (error || !data?.user) {
    throw greska(401, "Nevažeći ili istekao token.");
  }

  const { data: profil, error: profilGreska } = await dbSupabase
    .from("korisnici")
    .select("id, ime_i_prezime, uloga, razred_odeljenje")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profilGreska) throw profilGreska;
  if (!profil) throw greska(403, "Korisnički profil ne postoji.");

  return { korisnik: data.user, profil };
}

// Za zasticene rute: bez ispravnog tokena zahtev se odbija sa 401.
async function zahtevajPrijavu(req, res, next) {
  try {
    const token = izvuciToken(req);
    if (!token) throw greska(401, "Morate biti prijavljeni.");

    const { korisnik, profil } = await ucitajKorisnika(token);
    req.korisnik = korisnik;
    req.profil = profil;
    return next();
  } catch (error) {
    return next(error);
  }
}

// Za javne rute: ako je token poslat i ispravan, popunjava req.korisnik/req.profil,
// a u suprotnom zahtev nastavlja kao anonimni.
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
