
const { authSupabase, dbSupabase } = require("../config/supabase");

async function zahtevajPrijavu(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        greska: "Morate biti prijavljeni."
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        greska: "Token nije pronađen."
      });
    }

    const { data, error } = await authSupabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        greska: "Nevažeći ili istekao token."
      });
    }

    const { data: profil, error: profilGreska } =
      await dbSupabase
        .from("korisnici")
        .select("id, ime_i_prezime, uloga, razred_odeljenje")
        .eq("id", data.user.id)
        .maybeSingle();

    if (profilGreska) {
      return res.status(500).json({
        greska: "Greška pri proveri korisnika."
      });
    }

    if (!profil) {
      return res.status(403).json({
        greska: "Korisnički profil ne postoji."
      });
    }

    req.korisnik = data.user;
    req.profil = profil;

    next();
  } catch (error) {
    console.error("Autentifikacija:", error);

    return res.status(500).json({
      greska: "Greška pri autentifikaciji."
    });
  }
}

module.exports = zahtevajPrijavu;
