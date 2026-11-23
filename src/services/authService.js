const { authSupabase, dbSupabase } = require("../config/supabase");

async function odjaviToken(token) {
  const { error } = await authSupabase.auth.admin.signOut(token, "global");
  if (error) throw error;
}

async function registrujNalog({ email, lozinka, imeIPrezime, trazenaUloga }) {
  return authSupabase.auth.signUp({
    email,
    password: lozinka,
    options: { data: { ime_i_prezime: imeIPrezime, requested_role: trazenaUloga } }
  });
}

async function sacuvajProfil({ id, imeIPrezime }) {
  return dbSupabase
    .from("korisnici")
    .upsert({ id, ime_i_prezime: imeIPrezime, uloga: "ucenik" }, { onConflict: "id" })
    .select("id, ime_i_prezime, uloga")
    .single();
}

async function prijaviNalog(email, lozinka) {
  return authSupabase.auth.signInWithPassword({ email, password: lozinka });
}

async function profilKorisnika(id) {
  return dbSupabase
    .from("korisnici")
    .select("id, ime_i_prezime, uloga, razred_odeljenje")
    .eq("id", id)
    .maybeSingle();
}

async function osveziSesiju(refresh_token) {
  return authSupabase.auth.refreshSession({ refresh_token });
}

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
    .upsert({ korisnik_id: korisnikId }, { onConflict: "korisnik_id" })
    .select("id, status, kreiran_at, obradjen_at")
    .single();
  if (error) throw error;
  return data;
}

function tabelaZahtjevaNedostaje(error) {
  return error.code === "42P01" || error.code === "PGRST205";
}

module.exports = {
  odjaviToken,
  registrujNalog,
  sacuvajProfil,
  prijaviNalog,
  profilKorisnika,
  osveziSesiju,
  dohvatiZahtjevProfesora,
  kreirajIliVratiZahtjevProfesora,
  tabelaZahtjevaNedostaje
};
