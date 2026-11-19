
const {
  authSupabase,
  dbSupabase
} = require("../config/supabase");

async function zahtevajPrijavu(req, res, next) {
  try {
    const authorization =
      req.headers.authorization || "";

    const match = /^Bearer\s+(\S+)$/i.exec(
      authorization.trim()
    );

    if (!match) {
      return res.status(401).json({
        greska: "Morate biti prijavljeni."
      });
    }

    const token = match[1];

    const { data, error } =
      await authSupabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        greska: "Nevažeći ili istekao token."
      });
    }

    const { data: profil, error: profilGreska } =
      await dbSupabase
        .from("korisnici")
        .select(
          "id, ime_i_prezime, uloga, razred_odeljenje"
        )
        .eq("id", data.user.id)
        .maybeSingle();

    if (profilGreska) {
      console.error(
        "Provera korisničkog profila:",
        profilGreska
      );

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

    return next();
  } catch (error) {
    console.error("Autentifikacija:", error);

    return res.status(500).json({
      greska: "Greška pri autentifikaciji."
    });
  }
}

module.exports = zahtevajPrijavu;
