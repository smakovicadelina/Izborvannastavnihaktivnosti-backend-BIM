const { dbSupabase } = require("../config/supabase");
const { greska } = require("../utils/http");

async function evidentiraj(prijavaId, datum, prisutan) {
  const { data: postojece, error } = await dbSupabase
    .from("prisustva")
    .select("id")
    .eq("prijava_id", prijavaId)
    .eq("datum", datum)
    .maybeSingle();
  if (error) throw error;

  const upit = postojece
    ? dbSupabase.from("prisustva")
        .update({ prisutan, evidentirano_at: new Date().toISOString() })
        .eq("id", postojece.id)
    : dbSupabase.from("prisustva").insert({ prijava_id: prijavaId, datum, prisutan });
  const { data, error: upisGreska } = await upit
    .select("id, prijava_id, datum, prisutan, evidentirano_at")
    .single();
  if (upisGreska) throw upisGreska;
  return { prisustvo: data, novo: !postojece };
}

async function potvrdiPrijavu(prijavaId) {
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
  return data;
}

async function prisustvaZaAktivnost(aktivnostId, datum) {
  const { data: prijave, error } = await dbSupabase
    .from("prijave")
    .select("id, ucenik_id, status_prijave")
    .eq("aktivnost_id", aktivnostId);
  if (error) throw error;
  if (!prijave.length) return [];

  let q = dbSupabase
    .from("prisustva")
    .select("id, prijava_id, datum, prisutan, evidentirano_at")
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

async function aktivnostZaQr(aktivnostId) {
  const { data, error } = await dbSupabase
    .from("aktivnosti")
    .select("id, naziv, aktivna")
    .eq("id", aktivnostId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function prijavaUcenika(ucenikId, aktivnostId) {
  const { data, error } = await dbSupabase
    .from("prijave")
    .select("id")
    .eq("ucenik_id", ucenikId)
    .eq("aktivnost_id", aktivnostId)
    .eq("status_prijave", "prijavljen")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function izmeni(id, unos) {
  const { data, error } = await dbSupabase
    .from("prisustva")
    .update(unos)
    .eq("id", id)
    .select("id, prijava_id, datum, prisutan, evidentirano_at")
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

module.exports = {
  evidentiraj,
  potvrdiPrijavu,
  prisustvaZaAktivnost,
  aktivnostZaQr,
  prijavaUcenika,
  izmeni,
  obrisi
};
