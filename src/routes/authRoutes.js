
const express = require("express");
const {
  authSupabase,
  dbSupabase
} = require("../config/supabase");

const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");

const router = express.Router();

// REGISTRACIJA
router.post("/registracija", async (req, res) => {
  try {
    const body = req.body || {};

    const ime_i_prezime =
      typeof body.ime_i_prezime === "string"
        ? body.ime_i_prezime.trim()
        : typeof body.ime === "string"
          ? body.ime.trim()
          : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const lozinka = body.lozinka;

    if (ime_i_prezime.length < 2) {
      return res.status(400).json({
        greska: "Unesite ime i prezime."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        greska: "Unesite ispravnu email adresu."
      });
    }

    if (
      typeof lozinka !== "string" ||
      lozinka.length < 8
    ) {
      return res.status(400).json({
        greska: "Lozinka mora imati najmanje 8 znakova."
      });
    }

    // Korisnik ne može sam sebi dodeliti ulogu profesora.
    const { data, error } = await authSupabase.auth.signUp({
      email,
      password: lozinka,
      options: {
        data: { ime_i_prezime }
      }
    });

    if (error) {
      return res.status(400).json({
        greska: error.message
      });
    }

    if (!data.user || data.user.identities?.length === 0) {
      return res.status(409).json({
        greska: "Registracija nije moguća ili nalog već postoji."
      });
    }

    // Provera da li je profil već kreiran triggerom.
    const { data: postojeci, error: proveraGreska } =
      await dbSupabase
        .from("korisnici")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

    if (proveraGreska) {
      throw proveraGreska;
    }

    if (!postojeci) {
      const { error: profilGreska } = await dbSupabase
        .from("korisnici")
        .insert({
          id: data.user.id,
          ime_i_prezime,
          uloga: "ucenik"
        });

      if (profilGreska) {
        console.error("Greška profila:", profilGreska);

        return res.status(500).json({
          greska: "Auth nalog je kreiran, ali profil nije upisan. Kontaktirajte administratora."
        });
      }
    }

    return res.status(201).json({
      poruka: "Registracija je uspešna.",
      korisnik: {
        id: data.user.id,
        email: data.user.email,
        ime_i_prezime,
        uloga: "ucenik"
      },
      token: data.session?.access_token || null,
      refresh_token: data.session?.refresh_token || null,
      potvrdaEmailaPotrebna: !data.session
    });

  } catch (error) {
    console.error("Registracija:", error);

    return res.status(500).json({
      greska: "Greška prilikom registracije."
    });
  }
});

// LOGIN
router.post("/prijava", async (req, res) => {
  try {
    const { email, lozinka } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof lozinka !== "string" ||
      !email.trim() ||
      !lozinka
    ) {
      return res.status(400).json({
        greska: "Email i lozinka su obavezni."
      });
    }

    const { data, error } =
      await authSupabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: lozinka
      });

    if (error || !data.user || !data.session) {
      return res.status(401).json({
        greska: "Pogrešan email, lozinka ili nepotvrđen nalog."
      });
    }

    const { data: profil, error: profilGreska } =
      await dbSupabase
        .from("korisnici")
        .select("id, ime_i_prezime, uloga, razred_odeljenje")
        .eq("id", data.user.id)
        .maybeSingle();

    if (profilGreska || !profil) {
      return res.status(403).json({
        greska: "Korisnički profil nije pronađen."
      });
    }

    return res.status(200).json({
      poruka: "Uspešno ste prijavljeni.",
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      korisnik: {
        ...profil,
        email: data.user.email
      }
    });

  } catch (error) {
    console.error("Prijava:", error);

    return res.status(500).json({
      greska: "Greška prilikom prijavljivanja."
    });
  }
});

// TRENUTNO PRIJAVLJENI KORISNIK
router.get("/me", zahtevajPrijavu, async (req, res) => {
  try {
    const { data: profil, error } = await dbSupabase
      .from("korisnici")
      .select("id, ime_i_prezime, uloga, razred_odeljenje")
      .eq("id", req.korisnik.id)
      .maybeSingle();

    if (error || !profil) {
      return res.status(404).json({
        greska: "Profil nije pronađen."
      });
    }

    return res.json({
      korisnik: {
        ...profil,
        email: req.korisnik.email
      }
    });

  } catch (error) {
    console.error("Profil:", error);

    return res.status(500).json({
      greska: "Greška pri učitavanju profila."
    });
  }
});

// OSVEŽAVANJE SESIJE
router.post("/osvezi-token", async (req, res) => {
  try {
    const refresh_token = req.body?.refresh_token;

    if (typeof refresh_token !== "string" || !refresh_token) {
      return res.status(400).json({
        greska: "Refresh token je obavezan."
      });
    }

    const { data, error } =
      await authSupabase.auth.refreshSession({
        refresh_token
      });

    if (error || !data.session) {
      return res.status(401).json({
        greska: "Sesija je istekla. Prijavite se ponovo."
      });
    }

    return res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at
    });

  } catch (error) {
    console.error("Osvežavanje tokena:", error);

    return res.status(500).json({
      greska: "Greška pri osvežavanju sesije."
    });
  }
});

module.exports = router;
