
const express = require("express");
const { authSupabase, dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOZVOLJENE_ULOGE = ["ucenik", "profesor"];

async function dohvatiZahtjevProfesora(korisnikId) {
  const { data, error } = await dbSupabase
    .from("zahtevi_za_profesora")
    .select("id, status, kreiran_at, obradjen_at")
    .eq("korisnik_id", korisnikId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function kreirajIliVratiZahtjevProfesora(korisnikId) {
  const { data, error } = await dbSupabase
    .from("zahtevi_za_profesora")
    .upsert(
      { korisnik_id: korisnikId },
      { onConflict: "korisnik_id" }
    )
    .select("id, status, kreiran_at, obradjen_at")
    .single();

  if (error) throw error;
  return data;
}

function tabelaZahtjevaNedostaje(error) {
  return error.code === "42P01" || error.code === "PGRST205";
}

// REGISTRACIJA NALOGA
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
    const trazenaUloga =
      body.uloga === undefined ? "ucenik" : body.uloga;

    if (ime_i_prezime.length < 2) {
      return res.status(400).json({
        greska: "Unesite ime i prezime."
      });
    }

    if (!EMAIL_REGEX.test(email)) {
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

    if (!DOZVOLJENE_ULOGE.includes(trazenaUloga)) {
      return res.status(400).json({
        greska: "Uloga mora biti ucenik ili profesor."
      });
    }

    const { data, error } = await authSupabase.auth.signUp({
      email,
      password: lozinka,
      options: {
        data: {
          ime_i_prezime,
          requested_role: trazenaUloga
        }
      }
    });

    if (error) {
      const duplikat =
        error.code === "user_already_exists" ||
        /already (been )?(registered|exists)/i.test(error.message || "");
      const problemSupabaseBaze =
        error.code === "unexpected_failure" ||
        /database error|internal server error/i.test(error.message || "");
      const status = duplikat
        ? 409
        : !problemSupabaseBaze &&
          (error.status === 400 || error.status === 422)
          ? 400
          : 503;

      console.error("Supabase Auth registracija:", {
        status: error.status,
        code: error.code,
        message: error.message
      });

      return res.status(status).json({
        greska: duplikat
          ? "Nalog sa ovom email adresom već postoji."
          : status === 400
            ? "Podaci za registraciju nisu prihvaćeni."
            : "Supabase Auth trenutno nije dostupan."
      });
    }

    if (!data.user || data.user.identities?.length === 0) {
      return res.status(409).json({
        greska: "Registracija nije moguća ili nalog već postoji."
      });
    }

    const { data: profil, error: profilGreska } =
      await dbSupabase
        .from("korisnici")
        .upsert({
          id: data.user.id,
          ime_i_prezime,
          uloga: "ucenik"
        }, { onConflict: "id" })
        .select("id, ime_i_prezime, uloga")
        .single();

    if (profilGreska) {
      console.error("Kreiranje profila:", profilGreska);

      return res.status(500).json({
        greska: "Nalog je kreiran, ali profil nije upisan."
      });
    }

    let zahtevZaProfesora = null;

    if (trazenaUloga === "profesor") {
      try {
        zahtevZaProfesora = await kreirajIliVratiZahtjevProfesora(
          data.user.id
        );
      } catch (error) {
        console.error("Evidentiranje zahtjeva za profesora:", error);

        return res.status(tabelaZahtjevaNedostaje(error) ? 503 : 500).json({
          greska: tabelaZahtjevaNedostaje(error)
            ? "Nalog je kreiran kao učenik. Ne registrujte se ponovo. Izvršite SQL za zahtjeve profesora, prijavite se postojećim nalogom i pozovite POST /api/auth/zahtev-za-profesora."
            : "Nalog je kreiran kao učenik, ali zahtjev nije evidentiran."
        });
      }
    }

    return res.status(201).json({
      poruka: "Registracija je uspešna.",
      korisnik: {
        ...profil,
        email: data.user.email
      },
      zahtev_za_profesora: zahtevZaProfesora,
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

// PRIJAVA
router.post("/prijava", async (req, res) => {
  try {
    const { email, lozinka } = req.body || {};

    if (
      typeof email !== "string" ||
      !EMAIL_REGEX.test(email.trim()) ||
      typeof lozinka !== "string" ||
      !lozinka
    ) {
      return res.status(400).json({
        greska: "Unesite ispravan email i lozinku."
      });
    }

    const { data, error } =
      await authSupabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: lozinka
      });

    if (error || !data.user || !data.session) {
      return res.status(401).json({
        greska: "Pogrešni podaci ili nalog nije potvrđen."
      });
    }

    const { data: profil, error: profilGreska } =
      await dbSupabase
        .from("korisnici")
        .select("id, ime_i_prezime, uloga, razred_odeljenje")
        .eq("id", data.user.id)
        .maybeSingle();

    if (profilGreska) throw profilGreska;

    if (!profil) {
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

// TRENUTNI KORISNIK
router.get("/me", zahtevajPrijavu, async (req, res) => {
  return res.status(200).json({
    korisnik: {
      ...req.profil,
      email: req.korisnik.email
    }
  });
});

router.get(
  "/zahtev-za-profesora",
  zahtevajPrijavu,
  async (req, res) => {
    try {
      const zahtev = await dohvatiZahtjevProfesora(req.korisnik.id);
      return res.status(200).json({ zahtev_za_profesora: zahtev });
    } catch (error) {
      console.error("Učitavanje zahtjeva za profesora:", error);

      return res.status(tabelaZahtjevaNedostaje(error) ? 503 : 500).json({
        greska: tabelaZahtjevaNedostaje(error)
          ? "Tabela zahtjeva nije spremna. Izvršite SQL migraciju za profesorske zahtjeve."
          : "Greška pri učitavanju zahtjeva za profesora."
      });
    }
  }
);

router.post("/zahtev-za-profesora", zahtevajPrijavu, async (req, res) => {
  if (req.profil.uloga !== "ucenik") {
    return res.status(409).json({
      greska: "Zahtjev mogu podnijeti samo korisnici sa ulogom ucenik."
    });
  }

  try {
    const zahtev = await kreirajIliVratiZahtjevProfesora(req.korisnik.id);

    if (zahtev.status !== "na_cekanju") {
      return res.status(409).json({
        greska: "Zahtjev je već obrađen.",
        zahtev_za_profesora: zahtev
      });
    }

    return res.status(200).json({
      poruka: "Zahtjev za profesorski nalog je na čekanju.",
      zahtev_za_profesora: zahtev
    });
  } catch (error) {
    console.error("Evidentiranje zahtjeva za profesora:", error);

    return res.status(tabelaZahtjevaNedostaje(error) ? 503 : 500).json({
      greska: tabelaZahtjevaNedostaje(error)
        ? "Tabela zahtjeva nije spremna. Izvršite SQL migraciju za profesorske zahtjeve."
        : "Greška pri evidentiranju zahtjeva za profesora."
    });
  }
});

// OSVEZAVANJE TOKENA
router.post("/osvezi-token", async (req, res) => {
  try {
    const refresh_token = req.body?.refresh_token;

    if (
      typeof refresh_token !== "string" ||
      !refresh_token.trim()
    ) {
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

    return res.status(200).json({
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
