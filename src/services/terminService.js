// POSLOVNA LOGIKA ZA TERMINE.
// termini(id, dan_u_nedelji 1-7, vreme_od, vreme_do, prostorija_id -> prostorije.id)
// Pravilo: u istoj prostoriji ne smeju postojati dva termina koja se preklapaju
// (proverava ga i backend i sama baza kroz EXCLUDE ogranicenje).

const { dbSupabase } = require("../config/supabase");
const { greska } = require("../utils/http");
const { upit, upitOpcione } = require("../utils/upit");
const { terminiSePreklapaju, opisTermina, nazivDana, sortirajTermine } = require("../utils/vreme");
const { jeValidanTermin } = require("../validators/terminValidator");
const aktivnosti = require("./aktivnostService");
const obavestenja = require("./obavestenjaService");

const KOLONE = "id, dan_u_nedelji, vreme_od, vreme_do, prostorija_id";

// Termini koji se u istoj prostoriji preklapaju sa zadatim intervalom.
async function preklapanjaUProstoriji({ prostorija_id, dan_u_nedelji, vreme_od, vreme_do }, izuzmiId = null) {
  const termini = await upit(
    dbSupabase
      .from("termini")
      .select(KOLONE)
      .eq("prostorija_id", prostorija_id)
      .eq("dan_u_nedelji", dan_u_nedelji)
  );
  return termini.filter(
    t => t.id !== izuzmiId && terminiSePreklapaju(t, { dan_u_nedelji, vreme_od, vreme_do })
  );
}

async function zahtevajProstoriju(prostorijaId) {
  const { data, error } = await dbSupabase
    .from("prostorije")
    .select("id, naziv, kapacitet")
    .eq("id", prostorijaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(400, "Izabrana prostorija ne postoji.");
  return data;
}

async function proveriDostupnostProstorije(termin, izuzmiId = null) {
  const preklapanja = await preklapanjaUProstoriji(termin, izuzmiId);
  if (preklapanja.length) {
    throw greska(
      409,
      `Prostorija je zauzeta: postoji termin koji se preklapa (${opisTermina(preklapanja[0])}).`
    );
  }
}

// Aktivnosti koje koriste neki od termina.
async function aktivnostiTermina(terminIds) {
  if (!terminIds.length) return [];
  const [veze, direktne] = await Promise.all([
    upitOpcione(dbSupabase.from("aktivnost_termini").select("aktivnost_id").in("termin_id", terminIds)),
    upit(dbSupabase.from("aktivnosti").select("id").in("termin_id", terminIds))
  ]);
  const ids = [...new Set([...veze.map(v => v.aktivnost_id), ...direktne.map(a => a.id)])];
  if (!ids.length) return [];
  return upit(
    dbSupabase.from("aktivnosti").select("id, naziv, maksimalno_mesta, aktivna").in("id", ids)
  );
}

async function terminPoId(id) {
  const { data, error } = await dbSupabase.from("termini").select(KOLONE).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// READ - lista termina sa nazivom dana i prostorijom.
async function lista({ prostorijaId, dan }) {
  let q = dbSupabase.from("termini").select(KOLONE).order("dan_u_nedelji").order("vreme_od");
  if (prostorijaId !== undefined) q = q.eq("prostorija_id", prostorijaId);
  if (dan !== undefined) q = q.eq("dan_u_nedelji", dan);
  const termini = await upit(q);

  const ids = [...new Set(termini.map(t => t.prostorija_id))];
  const prostorije = ids.length
    ? await upit(dbSupabase.from("prostorije").select("id, naziv, kapacitet").in("id", ids))
    : [];
  const poId = new Map(prostorije.map(p => [p.id, p]));

  return termini.map(t => ({
    ...t,
    dan: nazivDana(t.dan_u_nedelji),
    prostorija: poId.get(t.prostorija_id) || null
  }));
}

// READ - jedan termin sa aktivnostima koje ga koriste.
async function detalji(id) {
  const termin = await terminPoId(id);
  if (!termin) throw greska(404, "Termin nije pronađen.");
  return {
    ...termin,
    dan: nazivDana(termin.dan_u_nedelji),
    aktivnosti: await aktivnostiTermina([id])
  };
}

// CREATE
async function kreiraj(termin) {
  await zahtevajProstoriju(termin.prostorija_id);
  await proveriDostupnostProstorije(termin);
  const { data, error } = await dbSupabase.from("termini").insert(termin).select().single();
  if (error) throw error;
  return data;
}

// UPDATE - posle izmene osvezava tekst termina povezanih aktivnosti
// i obavestava ucenike prijavljene na njih.
async function izmeni(id, unos) {
  const postojeci = await terminPoId(id);
  if (!postojeci) throw greska(404, "Termin nije pronađen.");

  const novi = { ...postojeci, ...unos };
  if (!jeValidanTermin(novi)) throw greska(400, "Neispravni podaci za izmenu.");

  const povezaneAktivnosti = await aktivnostiTermina([id]);

  // Nova prostorija mora imati dovoljan kapacitet za aktivnosti u ovom terminu.
  if (unos.prostorija_id && unos.prostorija_id !== postojeci.prostorija_id) {
    const prostorija = await zahtevajProstoriju(unos.prostorija_id);
    const prevelika = povezaneAktivnosti.find(
      a => a.aktivna && a.maksimalno_mesta > prostorija.kapacitet
    );
    if (prevelika) {
      throw greska(
        409,
        `Prostorija ${prostorija.naziv} (kapacitet ${prostorija.kapacitet}) je premala za aktivnost "${prevelika.naziv}" (${prevelika.maksimalno_mesta} mesta).`
      );
    }
  }
  await proveriDostupnostProstorije(novi, id);

  const { data, error } = await dbSupabase
    .from("termini")
    .update(unos)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;

  for (const a of povezaneAktivnosti) {
    const puna = await aktivnosti.zahtevajAktivnost(a.id);
    const termini = sortirajTermine(await aktivnosti.terminiAktivnosti(puna));
    if (termini.length) await aktivnosti.osveziTekstTermina(a.id, termini);
  }

  for (const a of povezaneAktivnosti.filter(x => x.aktivna)) {
    await obavestenja.obavestiUcenikeAktivnosti(a.id, {
      tip: "promena_termina",
      naslov: "Promena termina",
      poruka: `Termin aktivnosti "${a.naziv}" je promenjen: ${opisTermina(data)}.`
    });
  }
  return data;
}

// DELETE - nije dozvoljeno ako termin koristi neka aktivnost.
async function obrisi(id) {
  const povezaneAktivnosti = await aktivnostiTermina([id]);
  if (povezaneAktivnosti.length) {
    throw greska(409, `Termin je povezan sa aktivnošću "${povezaneAktivnosti[0].naziv}".`);
  }
  const { data, error } = await dbSupabase
    .from("termini")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Termin nije pronađen.");
}

module.exports = {
  preklapanjaUProstoriji,
  aktivnostiTermina,
  lista,
  detalji,
  kreiraj,
  izmeni,
  obrisi
};
