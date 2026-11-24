// Prijave, nedeljni raspored i istorija ULOGOVANOG ucenika.
// Svi upiti filtriraju po ucenik_id = req.korisnik.id, pa ucenik vidi samo svoje podatke.

const { dbSupabase } = require("../config/supabase");
const { upit } = require("../utils/upit");
const { sortirajTermine } = require("../utils/vreme");
const aktivnosti = require("./aktivnostService");

// statusi = null (sve) ili niz statusa, npr. ["prijavljen"]
async function mojePrijave(ucenikId, statusi = null) {
  let q = dbSupabase
    .from("prijave")
    .select("id, aktivnost_id, status_prijave, prijavljen_at")
    .eq("ucenik_id", ucenikId)
    .order("prijavljen_at", { ascending: false });
  if (statusi) q = q.in("status_prijave", statusi);

  const prijave = await upit(q);
  const obogacene = await aktivnosti.aktivnostiPoIds([...new Set(prijave.map(p => p.aktivnost_id))]);
  const poId = new Map(obogacene.map(a => [a.id, a]));

  return prijave.map(p => {
    const a = poId.get(p.aktivnost_id);
    return {
      ...p,
      aktivnost: a
        ? {
            id: a.id,
            naziv: a.naziv,
            opis: a.opis,
            aktivna: a.aktivna,
            termin: a.termin,
            prostorija: a.prostorija,
            kategorija: a.kategorija,
            termini: a.termini,
            profesori: a.profesori,
            slobodna_mesta: a.slobodna_mesta
          }
        : null
    };
  });
}

// Nedeljni raspored: svi termini aktivnih aktivnosti na koje je ucenik prijavljen.
async function raspored(ucenikId) {
  const prijave = await mojePrijave(ucenikId, ["prijavljen"]);
  const stavke = [];
  const bezTermina = [];

  for (const p of prijave) {
    if (!p.aktivnost || !p.aktivnost.aktivna) continue;

    if (!p.aktivnost.termini.length) {
      bezTermina.push({
        aktivnost_id: p.aktivnost.id,
        naziv: p.aktivnost.naziv,
        termin: p.aktivnost.termin,
        prostorija: p.aktivnost.prostorija
      });
      continue;
    }
    for (const t of p.aktivnost.termini) {
      stavke.push({ ...t, aktivnost_id: p.aktivnost.id, naziv: p.aktivnost.naziv, prijava_id: p.id });
    }
  }

  return { raspored: sortirajTermine(stavke), bez_strukturisanog_termina: bezTermina };
}

// Istorija: sve prijave sa evidencijom prisustva.
async function istorija(ucenikId) {
  const prijave = await mojePrijave(ucenikId);
  const prisustva = prijave.length
    ? await upit(
        dbSupabase
          .from("prisustva")
          .select("id, prijava_id, datum, prisutan")
          .in("prijava_id", prijave.map(p => p.id))
          .order("datum", { ascending: false })
      )
    : [];

  return prijave.map(p => {
    const moja = prisustva.filter(x => x.prijava_id === p.id);
    return {
      ...p,
      prisustva: moja,
      broj_prisustva: moja.filter(x => x.prisutan).length,
      broj_odsustva: moja.filter(x => !x.prisutan).length
    };
  });
}

module.exports = { mojePrijave, raspored, istorija };
