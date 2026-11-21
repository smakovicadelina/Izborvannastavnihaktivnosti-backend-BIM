
const express = require("express");

const { dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const aktivnosti = require("../services/aktivnostService");
const { greska } = require("../utils/http");
const { sortirajTermine } = require("../utils/vreme");

const router = express.Router();

router.use(zahtevajPrijavu);
router.use(zahtevajUlogu("ucenik"));

const STATUSI = ["prijavljen", "na_cekanju", "otkazano"];

// Prijave ucenika sa podacima o aktivnostima.
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

// UCENIK VIDI SAMO SVOJE PRIJAVE (status prijave)
router.get("/", async (req, res) => {
  const { status } = req.query;
  if (status !== undefined && !STATUSI.includes(status)) {
    throw greska(400, "Status mora biti prijavljen, na_cekanju ili otkazano.");
  }

  return res.status(200).json({
    prijave: await mojePrijave(req.korisnik.id, status ? [status] : null)
  });
});

// RASPORED: aktivne prijave razvrstane po danima i vremenu
router.get("/raspored", async (req, res) => {
  const prijave = await mojePrijave(req.korisnik.id, ["prijavljen"]);
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
      stavke.push({
        ...t,
        aktivnost_id: p.aktivnost.id,
        naziv: p.aktivnost.naziv,
        prijava_id: p.id
      });
    }
  }

  return res.json({
    raspored: sortirajTermine(stavke),
    bez_strukturisanog_termina: bezTermina
  });
});

// ISTORIJA: sve prijave (i otkazane) sa evidencijom prisustva
router.get("/istorija", async (req, res) => {
  const prijave = await mojePrijave(req.korisnik.id, null);
  const prisustva = prijave.length
    ? await aktivnosti.upit(
        dbSupabase
          .from("prisustva")
          .select("id, prijava_id, datum, prisutan")
          .in("prijava_id", prijave.map(p => p.id))
          .order("datum", { ascending: false })
      )
    : [];

  return res.json({
    istorija: prijave.map(p => {
      const moja = prisustva.filter(x => x.prijava_id === p.id);
      return {
        ...p,
        prisustva: moja,
        broj_prisustva: moja.filter(x => x.prisutan).length,
        broj_odsustva: moja.filter(x => !x.prisutan).length
      };
    })
  });
});

module.exports = router;
