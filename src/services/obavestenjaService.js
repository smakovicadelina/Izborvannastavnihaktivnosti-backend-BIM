
const { tabelaNedostaje } = require("../utils/http");
const { dbSupabase } = require("../config/supabase");

let upozorenjeIspisano = false;

// Kreira obavestenja za listu korisnika. Nikada ne baca gresku:
// neuspeh slanja obavestenja ne sme da obori glavnu radnju (prijavu, izmenu...).
async function obavesti(db, korisnikIds, { tip, naslov, poruka, aktivnost_id = null }) {
  const ids = [...new Set((korisnikIds || []).filter(Boolean))];
  if (!ids.length) return 0;

  try {
    const { error } = await db.from("obavestenja").insert(
      ids.map(korisnik_id => ({
        korisnik_id,
        tip,
        naslov,
        poruka,
        aktivnost_id
      }))
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

// Svi ucenici sa aktivnom prijavom (prijavljen / na_cekanju) na aktivnost.
async function uceniciAktivnosti(db, aktivnostId) {
  const { data, error } = await db
    .from("prijave")
    .select("ucenik_id")
    .eq("aktivnost_id", aktivnostId)
    .in("status_prijave", ["prijavljen", "na_cekanju"]);

  if (error) {
    console.error("Učitavanje učenika za obaveštenje:", error);
    return [];
  }

  return data.map(p => p.ucenik_id);
}

async function obavestiUcenikeAktivnosti(db, aktivnostId, sadrzaj) {
  const ucenici = await uceniciAktivnosti(db, aktivnostId);
  return obavesti(db, ucenici, { ...sadrzaj, aktivnost_id: aktivnostId });
}

module.exports = {
  obavesti,
  obavestiUcenikeAktivnosti,
  api: {
    obavesti: (korisnikIds, sadrzaj) =>
      obavesti(dbSupabase, korisnikIds, sadrzaj),
    obavestiUcenikeAktivnosti: (aktivnostId, sadrzaj) =>
      obavestiUcenikeAktivnosti(dbSupabase, aktivnostId, sadrzaj)
  }
};
