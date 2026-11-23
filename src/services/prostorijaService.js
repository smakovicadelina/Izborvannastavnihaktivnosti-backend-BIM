const { dbSupabase } = require("../config/supabase");
const { upit } = require("./aktivnostService");
const { preklapanjaUProstoriji, aktivnostiTermina } = require("./terminService");
const { greska } = require("../utils/http");

async function lista() {
  const { data, error } = await dbSupabase
    .from("prostorije")
    .select("id, naziv, kapacitet, opis")
    .order("naziv");
  if (error) throw error;
  return data || [];
}

async function detalji(id) {
  const { data, error } = await dbSupabase
    .from("prostorije")
    .select("id, naziv, kapacitet, opis")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Prostorija nije pronađena.");
  const termini = await upit(
    dbSupabase.from("termini")
      .select("id, dan_u_nedelji, vreme_od, vreme_do")
      .eq("prostorija_id", id)
      .order("dan_u_nedelji")
      .order("vreme_od")
  );
  return { ...data, termini };
}

async function dostupnost(id, termin) {
  const preklapanja = await preklapanjaUProstoriji(dbSupabase, termin);
  return { dostupna: preklapanja.length === 0, preklapanja };
}

async function kreiraj(unos) {
  const { data, error } = await dbSupabase.from("prostorije").insert(unos).select().single();
  if (error) {
    if (error.code === "23505") throw greska(409, "Prostorija već postoji.");
    throw error;
  }
  return data;
}

async function izmeni(id, unos) {
  if (unos.kapacitet) {
    const termini = await upit(dbSupabase.from("termini").select("id").eq("prostorija_id", id));
    const aktivnosti = await aktivnostiTermina(dbSupabase, termini.map(t => t.id));
    const prevelika = aktivnosti.find(a => a.aktivna && a.maksimalno_mesta > unos.kapacitet);
    if (prevelika) {
      throw greska(
        409,
        `Kapacitet ne može biti manji od broja mesta aktivnosti "${prevelika.naziv}" (${prevelika.maksimalno_mesta}).`
      );
    }
  }
  const { data, error } = await dbSupabase
    .from("prostorije")
    .update(unos)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === "23505") throw greska(409, "Prostorija sa tim nazivom već postoji.");
    if (error.code === "23514") throw greska(409, "Kapacitet prostorije nije dozvoljen.");
    throw error;
  }
  if (!data) throw greska(404, "Prostorija nije pronađena.");
  return data;
}

async function obrisi(id) {
  const { count, error: countError } = await dbSupabase
    .from("termini").select("id", { count: "exact", head: true }).eq("prostorija_id", id);
  if (countError) throw countError;
  if (count) {
    throw greska(409, "Prostorija ima termine i ne može se obrisati. Najpre obrišite ili premestite termine.");
  }
  const { data, error } = await dbSupabase
    .from("prostorije").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Prostorija nije pronađena.");
}

module.exports = { lista, detalji, dostupnost, kreiraj, izmeni, obrisi };
