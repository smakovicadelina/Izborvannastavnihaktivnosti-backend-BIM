// AI preporuke aktivnosti: cuvanje u bazi i priprema konteksta za AI.
// ai_preporuke(id, korisnik_id -> korisnici, pitanje, odgovor JSON, kreirano_at)
// ai_preporuka_aktivnosti(preporuka_id -> ai_preporuke, aktivnost_id -> aktivnosti)

const { dbSupabase } = require("../config/supabase");
const { greska, tabelaNedostaje } = require("../utils/http");
const { upit } = require("../utils/upit");
const { AKTIVNI_STATUSI } = require("../utils/konstante");
const { opisTermina } = require("../utils/vreme");
const aktivnosti = require("./aktivnostService");
const { interesovanjaKorisnika } = require("./profilService");
const { generisiPreporuke } = require("./aiService");

function procitajOdgovor(red) {
  try {
    return JSON.parse(red.odgovor);
  } catch {
    return { uvod: red.odgovor, preporuke: [] };
  }
}

// Sta AI sme da preporuci: samo aktivne aktivnosti sa slobodnim mestima
// na koje ucenik vec nije prijavljen, plus njegova interesovanja i raspored.
async function kontekstKorisnika(korisnikId) {
  const [dostupne, mojaInteresovanja, mojePrijave] = await Promise.all([
    aktivnosti.pregled({}, { id: korisnikId, uloga: "ucenik" }),
    interesovanjaKorisnika(korisnikId),
    upit(
      dbSupabase
        .from("prijave")
        .select("aktivnost_id")
        .eq("ucenik_id", korisnikId)
        .in("status_prijave", AKTIVNI_STATUSI)
    )
  ]);
  const vecPrijavljen = new Set(mojePrijave.map(p => p.aktivnost_id));
  return {
    aktivnosti: dostupne.filter(a => !vecPrijavljen.has(a.id) && a.slobodna_mesta > 0),
    mojaInteresovanja,
    mojRaspored: dostupne
      .filter(a => vecPrijavljen.has(a.id))
      .map(a => ({
        naziv: a.naziv,
        termini: a.termini.length ? a.termini.map(opisTermina) : [a.termin]
      }))
  };
}

// Preporuka spremna za prikaz (sa punim podacima o preporucenim aktivnostima).
async function prikazi(red) {
  const odgovor = procitajOdgovor(red);
  const preporuke = odgovor.preporuke || [];
  const obogacene = await aktivnosti.aktivnostiPoIds(preporuke.map(p => p.aktivnost_id));
  const poId = new Map(obogacene.map(a => [a.id, a]));
  return {
    id: red.id,
    pitanje: red.pitanje,
    kreirano_at: red.kreirano_at,
    izvor: odgovor.izvor || "tekst",
    model: odgovor.model || null,
    uvod: odgovor.uvod || "",
    preporuke: preporuke.map(p => ({ ...p, aktivnost: poId.get(p.aktivnost_id) || null }))
  };
}

async function moja(id, korisnikId) {
  const { data, error } = await dbSupabase
    .from("ai_preporuke")
    .select("id, korisnik_id, pitanje, odgovor, kreirano_at")
    .eq("id", id)
    .eq("korisnik_id", korisnikId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Preporuka nije pronađena.");
  return data;
}

// CREATE - generise preporuke (Claude ili lokalni algoritam) i cuva ih u bazi.
async function kreiraj(korisnikId, { tekst, izvor }) {
  const kontekst = await kontekstKorisnika(korisnikId);
  const rezultat = await generisiPreporuke({ tekst, ...kontekst });
  const odgovor = {
    uvod: rezultat.uvod,
    preporuke: rezultat.preporuke,
    model: rezultat.model,
    izvor
  };

  const { data: red, error } = await dbSupabase
    .from("ai_preporuke")
    .insert({ korisnik_id: korisnikId, pitanje: tekst, odgovor: JSON.stringify(odgovor) })
    .select("id, pitanje, odgovor, kreirano_at")
    .single();
  if (error) throw error;

  if (odgovor.preporuke.length) {
    const { error: vezeGreska } = await dbSupabase
      .from("ai_preporuka_aktivnosti")
      .insert(odgovor.preporuke.map(p => ({ preporuka_id: red.id, aktivnost_id: p.aktivnost_id })));
    if (vezeGreska && !tabelaNedostaje(vezeGreska)) throw vezeGreska;
  }
  return prikazi(red);
}

// READ - istorija preporuka (skraceni prikaz).
async function istorija(korisnikId) {
  const redovi = await upit(
    dbSupabase
      .from("ai_preporuke")
      .select("id, pitanje, odgovor, kreirano_at")
      .eq("korisnik_id", korisnikId)
      .order("kreirano_at", { ascending: false })
      .limit(50)
  );
  return redovi.map(red => {
    const odgovor = procitajOdgovor(red);
    return {
      id: red.id,
      pitanje: red.pitanje,
      kreirano_at: red.kreirano_at,
      uvod: odgovor.uvod || "",
      broj_preporuka: (odgovor.preporuke || []).length
    };
  });
}

// READ - jedna preporuka
async function detalji(id, korisnikId) {
  return prikazi(await moja(id, korisnikId));
}

// DELETE
async function obrisi(id, korisnikId) {
  await moja(id, korisnikId);
  const { error: vezeGreska } = await dbSupabase
    .from("ai_preporuka_aktivnosti")
    .delete()
    .eq("preporuka_id", id);
  if (vezeGreska && !tabelaNedostaje(vezeGreska)) throw vezeGreska;

  const { error } = await dbSupabase
    .from("ai_preporuke")
    .delete()
    .eq("id", id)
    .eq("korisnik_id", korisnikId);
  if (error) throw error;
}

module.exports = { kreiraj, istorija, detalji, obrisi, kontekstKorisnika, procitajOdgovor };
