// Obavestenja korisnicima (promena termina, prijava, otkazivanje...).
// Tabela: obavestenja (korisnik_id -> korisnici, aktivnost_id -> aktivnosti).

const { dbSupabase } = require("../config/supabase");
const { greska, tabelaNedostaje } = require("../utils/http");
const { AKTIVNI_STATUSI } = require("../utils/konstante");

let upozorenjeIspisano = false;

// ---------------------------------------------------------------------------
// Slanje obavestenja (koriste ga drugi servisi)
// ---------------------------------------------------------------------------

// Kreira obavestenje za svakog korisnika iz liste. Nikada ne baca gresku:
// neuspeh slanja obavestenja ne sme da obori glavnu radnju (prijavu, izmenu...).
async function obavesti(korisnikIds, { tip, naslov, poruka, aktivnost_id = null }) {
  const ids = [...new Set((korisnikIds || []).filter(Boolean))];
  if (!ids.length) return 0;

  try {
    const { error } = await dbSupabase.from("obavestenja").insert(
      ids.map(korisnik_id => ({ korisnik_id, tip, naslov, poruka, aktivnost_id }))
    );
    if (error) throw error;
    return ids.length;
  } catch (error) {
    if (tabelaNedostaje(error)) {
      if (!upozorenjeIspisano) {
        console.warn(
          "Tabela obavestenja ne postoji. Pokrenite supabase/migrations/004_obavestenja_interesovanja_prisustvo.sql."
        );
        upozorenjeIspisano = true;
      }
    } else {
      console.error("Slanje obaveštenja:", error);
    }
    return 0;
  }
}

// Obavestava sve ucenike sa aktivnom prijavom (prijavljen / na_cekanju) na aktivnost.
async function obavestiUcenikeAktivnosti(aktivnostId, sadrzaj) {
  const { data, error } = await dbSupabase
    .from("prijave")
    .select("ucenik_id")
    .eq("aktivnost_id", aktivnostId)
    .in("status_prijave", AKTIVNI_STATUSI);

  if (error) {
    console.error("Učitavanje učenika za obaveštenje:", error);
    return 0;
  }
  return obavesti(data.map(p => p.ucenik_id), { ...sadrzaj, aktivnost_id: aktivnostId });
}

// ---------------------------------------------------------------------------
// CRUD nad sopstvenim obavestenjima (GET/PATCH/DELETE /api/obavestenja)
// ---------------------------------------------------------------------------

async function lista(korisnikId, { samoNeprocitana, limit }) {
  let q = dbSupabase
    .from("obavestenja")
    .select("id, tip, naslov, poruka, aktivnost_id, procitano, kreirano_at")
    .eq("korisnik_id", korisnikId)
    .order("kreirano_at", { ascending: false })
    .limit(limit);
  if (samoNeprocitana) q = q.eq("procitano", false);

  const { data, error } = await q;
  if (error) throw error;

  const { count, error: countError } = await dbSupabase
    .from("obavestenja")
    .select("id", { count: "exact", head: true })
    .eq("korisnik_id", korisnikId)
    .eq("procitano", false);
  if (countError) throw countError;

  return { obavestenja: data, broj_neprocitanih: count || 0 };
}

async function procitajSve(korisnikId) {
  const { error } = await dbSupabase
    .from("obavestenja")
    .update({ procitano: true })
    .eq("korisnik_id", korisnikId)
    .eq("procitano", false);
  if (error) throw error;
}

// Filter po korisnik_id garantuje da korisnik menja samo SVOJA obavestenja.
async function procitajJedno(id, korisnikId) {
  const { data, error } = await dbSupabase
    .from("obavestenja")
    .update({ procitano: true })
    .eq("id", id)
    .eq("korisnik_id", korisnikId)
    .select("id, procitano")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Obaveštenje nije pronađeno.");
  return data;
}

async function obrisi(id, korisnikId) {
  const { data, error } = await dbSupabase
    .from("obavestenja")
    .delete()
    .eq("id", id)
    .eq("korisnik_id", korisnikId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Obaveštenje nije pronađeno.");
}

module.exports = {
  obavesti,
  obavestiUcenikeAktivnosti,
  lista,
  procitajSve,
  procitajJedno,
  obrisi
};
