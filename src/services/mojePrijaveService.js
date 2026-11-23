const { dbSupabase } = require("../config/supabase");
const aktivnosti = require("./aktivnostService");

async function mojePrijave(ucenikId, status) {
  let q = dbSupabase
    .from("prijave")
    .select("id, aktivnost_id, status_prijave, prijavljen_at")
    .eq("ucenik_id", ucenikId)
    .order("prijavljen_at", { ascending: false });

  if (status) q = q.in("status_prijave", status);

  const prijave = await aktivnosti.upit(q);
  const ids = [...new Set(prijave.map(p => p.aktivnost_id))];
  const redovi = ids.length
    ? await aktivnosti.upit(dbSupabase.from("aktivnosti").select("*").in("id", ids))
    : [];
  const obogacene = await aktivnosti.obogatiAktivnosti(dbSupabase, redovi);
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

async function prisustvaZaPrijave(prijave) {
  if (!prijave.length) return [];
  return aktivnosti.upit(
    dbSupabase
      .from("prisustva")
      .select("id, prijava_id, datum, prisutan")
      .in("prijava_id", prijave.map(p => p.id))
      .order("datum", { ascending: false })
  );
}

module.exports = { mojePrijave, prisustvaZaPrijave };
