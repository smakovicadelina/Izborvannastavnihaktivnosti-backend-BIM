// AUTENTIFIKACIJA preko Supabase Auth-a.
//
// Supabase Auth cuva naloge (email + hash lozinke) u semi auth.users i izdaje
// JWT tokene. Nasa tabela public.korisnici cuva profil i ULOGU (ucenik/profesor),
// sa istim id-jem kao auth.users (veza 1:1).
//
// Novi nalog UVEK dobija ulogu "ucenik". Ko zeli profesorski nalog, dobija zahtev
// u tabeli zahtevi_za_profesora, koji odobrava postojeci profesor (admin panel).

const { authSupabase, dbSupabase } = require("../config/supabase");
const { greska, tabelaNedostaje } = require("../utils/http");

const KOLONE_PROFILA = "id, ime_i_prezime, uloga, razred_odeljenje";
const KOLONE_ZAHTEVA = "id, status, kreiran_at, obradjen_at";

const PORUKA_MIGRACIJE =
  "Tabela zahtjeva nije spremna. Izvršite SQL migraciju za profesorske zahtjeve.";

// Supabase Auth greska pri registraciji -> HttpGreska
function prevediAuthGresku(error) {
  console.error("Supabase Auth registracija:", {
    status: error.status,
    code: error.code,
    message: error.message
  });
  const duplikat =
    error.code === "user_already_exists" ||
    /already (been )?(registered|exists)/i.test(error.message || "");
  if (duplikat) return greska(409, "Nalog sa ovom email adresom već postoji.");

  const problemSupabaseBaze =
    error.code === "unexpected_failure" ||
    /database error|internal server error/i.test(error.message || "");
  if (!problemSupabaseBaze && (error.status === 400 || error.status === 422)) {
    return greska(400, "Podaci za registraciju nisu prihvaćeni.");
  }
  return greska(503, "Supabase Auth trenutno nije dostupan.");
}

async function profilKorisnika(id) {
  const { data, error } = await dbSupabase
    .from("korisnici")
    .select(KOLONE_PROFILA)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function kreirajIliVratiZahtevProfesora(korisnikId) {
  const { data, error } = await dbSupabase
    .from("zahtevi_za_profesora")
    .upsert({ korisnik_id: korisnikId }, { onConflict: "korisnik_id" })
    .select(KOLONE_ZAHTEVA)
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// REGISTRACIJA
// ---------------------------------------------------------------------------
async function registruj({ imeIPrezime, email, lozinka, trazenaUloga }) {
  // 1) Nalog u Supabase Auth-u. Trazena uloga se cuva samo kao "requested_role"
  //    u metapodacima - nikada kao stvarna uloga.
  const { data, error } = await authSupabase.auth.signUp({
    email,
    password: lozinka,
    options: { data: { ime_i_prezime: imeIPrezime, requested_role: trazenaUloga } }
  });
  if (error) throw prevediAuthGresku(error);
  if (!data.user || data.user.identities?.length === 0) {
    throw greska(409, "Registracija nije moguća ili nalog već postoji.");
  }

  // 2) Profil u tabeli korisnici (uloga je uvek "ucenik").
  const { data: profil, error: profilGreska } = await dbSupabase
    .from("korisnici")
    .upsert(
      { id: data.user.id, ime_i_prezime: imeIPrezime, uloga: "ucenik" },
      { onConflict: "id" }
    )
    .select("id, ime_i_prezime, uloga")
    .single();
  if (profilGreska) {
    console.error("Kreiranje profila:", profilGreska);
    throw greska(500, "Nalog je kreiran, ali profil nije upisan.");
  }

  // 3) Ako je trazen profesorski nalog - zahtev na cekanju.
  let zahtevZaProfesora = null;
  if (trazenaUloga === "profesor") {
    try {
      zahtevZaProfesora = await kreirajIliVratiZahtevProfesora(data.user.id);
    } catch (e) {
      console.error("Evidentiranje zahtjeva za profesora:", e);
      throw tabelaNedostaje(e)
        ? greska(
            503,
            "Nalog je kreiran kao učenik. Ne registrujte se ponovo. Izvršite SQL za zahtjeve profesora, prijavite se postojećim nalogom i pozovite POST /api/auth/zahtev-za-profesora."
          )
        : greska(500, "Nalog je kreiran kao učenik, ali zahtjev nije evidentiran.");
    }
  }

  return {
    poruka: "Registracija je uspešna.",
    korisnik: { ...profil, email: data.user.email },
    zahtev_za_profesora: zahtevZaProfesora,
    token: data.session?.access_token || null,
    refresh_token: data.session?.refresh_token || null,
    // Ako je u Supabase-u ukljucena potvrda emaila, sesija stize tek posle potvrde.
    potvrdaEmailaPotrebna: !data.session
  };
}

// ---------------------------------------------------------------------------
// PRIJAVA - vraca access token (JWT) koji klijent salje u zaglavlju Authorization
// ---------------------------------------------------------------------------
async function prijavi({ email, lozinka }) {
  const { data, error } = await authSupabase.auth.signInWithPassword({ email, password: lozinka });
  if (error || !data.user || !data.session) {
    throw greska(401, "Pogrešni podaci ili nalog nije potvrđen.");
  }

  const profil = await profilKorisnika(data.user.id);
  if (!profil) throw greska(403, "Korisnički profil nije pronađen.");

  return {
    poruka: "Uspešno ste prijavljeni.",
    token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    korisnik: { ...profil, email: data.user.email }
  };
}

// Novi access token na osnovu refresh tokena (access token traje ograniceno).
async function osveziSesiju({ refreshToken }) {
  const { data, error } = await authSupabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    throw greska(401, "Sesija je istekla. Prijavite se ponovo.");
  }
  return {
    token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at
  };
}

// ODJAVA - ponistava sve sesije korisnika (refresh tokeni prestaju da vaze).
async function odjavi(token) {
  const { error } = await authSupabase.auth.admin.signOut(token, "global");
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// ZAHTEV ZA PROFESORSKI NALOG
// ---------------------------------------------------------------------------
async function zahtevProfesora(korisnikId) {
  try {
    const { data, error } = await dbSupabase
      .from("zahtevi_za_profesora")
      .select(KOLONE_ZAHTEVA)
      .eq("korisnik_id", korisnikId)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (e) {
    throw tabelaNedostaje(e) ? greska(503, PORUKA_MIGRACIJE) : e;
  }
}

async function podnesiZahtevProfesora(profil) {
  if (profil.uloga !== "ucenik") {
    throw greska(409, "Zahtjev mogu podnijeti samo korisnici sa ulogom ucenik.");
  }
  let zahtev;
  try {
    // ID uvek dolazi iz tokena (profil.id), nikada iz tela zahteva.
    zahtev = await kreirajIliVratiZahtevProfesora(profil.id);
  } catch (e) {
    throw tabelaNedostaje(e) ? greska(503, PORUKA_MIGRACIJE) : e;
  }
  if (zahtev.status !== "na_cekanju") {
    throw greska(409, "Zahtjev je već obrađen.", { zahtev_za_profesora: zahtev });
  }
  return zahtev;
}

module.exports = {
  registruj,
  prijavi,
  osveziSesiju,
  odjavi,
  zahtevProfesora,
  podnesiZahtevProfesora
};
