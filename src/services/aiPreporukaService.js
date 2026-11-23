const { dbSupabase } = require("../config/supabase");
const { greska, tabelaNedostaje } = require("../utils/http");
const aktivnosti = require("./aktivnostService");
const { interesovanjaKorisnika } = require("./profilService");
const { opisTermina } = require("../utils/vreme");

function procitajOdgovor(red) {
  try {
    return JSON.parse(red.odgovor);
  } catch {
    return { uvod: red.odgovor, preporuke: [] };
  }
}

async function sacuvaj(korisnikId, tekst, odgovor) {
  const { data: red, error } = await dbSupabase
    .from("ai_preporuke")
    .insert({
      korisnik_id: korisnikId,
      pitanje: tekst,
      odgovor: JSON.stringify(odgovor)
    })
    .select("id, pitanje, odgovor, kreirano_at")
    .single();
  if (error) throw error;

  if (odgovor.preporuke.length) {
    const { error: vezeGreska } = await dbSupabase
      .from("ai_preporuka_aktivnosti")
      .insert(odgovor.preporuke.map(p => ({
        preporuka_id: red.id,
        aktivnost_id: p.aktivnost_id
      })));
    if (vezeGreska && !tabelaNedostaje(vezeGreska)) throw vezeGreska;
  }
  return red;
}

async function istorija(korisnikId) {
  const { data, error } = await dbSupabase
    .from("ai_preporuke")
    .select("id, pitanje, odgovor, kreirano_at")
    .eq("korisnik_id", korisnikId)
    .order("kreirano_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
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

async function kontekstKorisnika(korisnikId) {
  const [dostupne, mojaInteresovanja, mojePrijave] = await Promise.all([
    aktivnosti.api.pregledAktivnosti({ ucenikId: korisnikId }),
    interesovanjaKorisnika(korisnikId),
    aktivnosti.upit(
      dbSupabase.from("prijave")
        .select("aktivnost_id")
        .eq("ucenik_id", korisnikId)
        .in("status_prijave", aktivnosti.AKTIVNI_STATUSI)
    )
  ]);
  const vecPrijavljen = new Set(mojePrijave.map(p => p.aktivnost_id));
  return {
    aktivnosti: dostupne.filter(a => !vecPrijavljen.has(a.id) && a.slobodna_mesta > 0),
    mojaInteresovanja,
    mojRaspored: dostupne.filter(a => vecPrijavljen.has(a.id)).map(a => ({
      naziv: a.naziv,
      termini: a.termini.length ? a.termini.map(opisTermina) : [a.termin]
    }))
  };
}

async function prikazi(red) {
  const odgovor = procitajOdgovor(red);
  const preporuke = odgovor.preporuke || [];
  const obogacene = await aktivnosti.api.aktivnostiPoIds(
    preporuke.map(p => p.aktivnost_id)
  );
  const poId = new Map(obogacene.map(a => [a.id, a]));
  return {
    id: red.id,
    pitanje: red.pitanje,
    kreirano_at: red.kreirano_at,
    izvor: odgovor.izvor || "tekst",
    model: odgovor.model || null,
    uvod: odgovor.uvod || "",
    preporuke: preporuke.map(p => ({
      ...p,
      aktivnost: poId.get(p.aktivnost_id) || null
    }))
  };
}

module.exports = {
  sacuvaj,
  istorija,
  moja,
  obrisi,
  kontekstKorisnika,
  prikazi,
  procitajOdgovor
};
