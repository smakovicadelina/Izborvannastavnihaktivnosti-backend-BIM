// Evidencija prisustva: prisustva(id, prijava_id -> prijave, datum, prisutan, evidentirano_at)
// Jedna prijava moze imati najvise jedan zapis po datumu (UNIQUE prijava_id + datum).

const { dbSupabase } = require("../config/supabase");
const { greska } = require("../utils/http");
const { proveriQrKod } = require("./qrService");

const KOLONE = "id, prijava_id, datum, prisutan, evidentirano_at";

// Upisuje novo prisustvo ili azurira postojece za isti datum.
async function evidentiraj(prijavaId, datum, prisutan) {
  const { data: postojece, error } = await dbSupabase
    .from("prisustva")
    .select("id")
    .eq("prijava_id", prijavaId)
    .eq("datum", datum)
    .maybeSingle();
  if (error) throw error;

  const upit = postojece
    ? dbSupabase
        .from("prisustva")
        .update({ prisutan, evidentirano_at: new Date().toISOString() })
        .eq("id", postojece.id)
    : dbSupabase.from("prisustva").insert({ prijava_id: prijavaId, datum, prisutan });

  const { data, error: upisGreska } = await upit.select(KOLONE).single();
  if (upisGreska) throw upisGreska;
  return { prisustvo: data, novo: !postojece };
}

// UCENIK skenira QR kod koji je generisao profesor.
async function skeniraj(ucenikId, kod) {
  let podaci;
  try {
    podaci = proveriQrKod(kod); // proverava HMAC potpis i rok vazenja
  } catch (error) {
    throw greska(400, error.razlog || "QR kod nije ispravan.");
  }

  const { data: aktivnost, error } = await dbSupabase
    .from("aktivnosti")
    .select("id, naziv, aktivna")
    .eq("id", podaci.aktivnostId)
    .maybeSingle();
  if (error) throw error;
  if (!aktivnost || !aktivnost.aktivna) throw greska(404, "Aktivnost nije dostupna.");

  const { data: prijava, error: prijavaGreska } = await dbSupabase
    .from("prijave")
    .select("id")
    .eq("ucenik_id", ucenikId)
    .eq("aktivnost_id", podaci.aktivnostId)
    .eq("status_prijave", "prijavljen")
    .maybeSingle();
  if (prijavaGreska) throw prijavaGreska;
  if (!prijava) throw greska(403, "Niste prijavljeni na ovu aktivnost.");

  const rezultat = await evidentiraj(prijava.id, podaci.datum, true);
  return { ...rezultat, aktivnost };
}

// PROFESOR rucno evidentira prisustvo za potvrdjenu prijavu.
async function evidentirajRucno({ prijavaId, datum, prisutan }) {
  const { data, error } = await dbSupabase
    .from("prijave")
    .select("id, status_prijave")
    .eq("id", prijavaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Prijava nije pronađena.");
  if (data.status_prijave !== "prijavljen") {
    throw greska(409, "Prisustvo se evidentira samo za potvrđene prijave.");
  }
  return evidentiraj(prijavaId, datum, prisutan);
}

// READ - evidencija prisustva za aktivnost (opciono za jedan datum).
async function zaAktivnost(aktivnostId, datum) {
  const { data: prijave, error } = await dbSupabase
    .from("prijave")
    .select("id, ucenik_id, status_prijave")
    .eq("aktivnost_id", aktivnostId);
  if (error) throw error;
  if (!prijave.length) return [];

  let q = dbSupabase
    .from("prisustva")
    .select(KOLONE)
    .in("prijava_id", prijave.map(p => p.id))
    .order("datum", { ascending: false });
  if (datum) q = q.eq("datum", datum);
  const { data: prisustva, error: prisustvaError } = await q;
  if (prisustvaError) throw prisustvaError;

  const { data: ucenici, error: uceniciError } = await dbSupabase
    .from("korisnici")
    .select("id, ime_i_prezime, razred_odeljenje")
    .in("id", [...new Set(prijave.map(p => p.ucenik_id))]);
  if (uceniciError) throw uceniciError;

  const prijavePoId = new Map(prijave.map(p => [p.id, p]));
  const uceniciPoId = new Map(ucenici.map(u => [u.id, u]));
  return prisustva.map(p => ({
    ...p,
    ucenik: uceniciPoId.get(prijavePoId.get(p.prijava_id)?.ucenik_id) || null
  }));
}

async function izmeni(id, unos) {
  const { data, error } = await dbSupabase
    .from("prisustva")
    .update(unos)
    .eq("id", id)
    .select(KOLONE)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Evidencija prisustva nije pronađena.");
  return data;
}

async function obrisi(id) {
  const { data, error } = await dbSupabase
    .from("prisustva")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Evidencija prisustva nije pronađena.");
}

module.exports = { skeniraj, evidentirajRucno, zaAktivnost, izmeni, obrisi };
