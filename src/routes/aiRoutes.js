
const express = require("express");
const { dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const aktivnosti = require("../services/aktivnostService");
const { generisiPreporuke } = require("../services/aiService");
const { interesovanjaKorisnika } = require("./profilRoutes");
const { greska, zahtevajId, tabelaNedostaje } = require("../utils/http");
const { opisTermina } = require("../utils/vreme");

const router = express.Router();

// Preporuke su licne: dostupne iskljucivo uceniku kome pripadaju.
router.use(zahtevajPrijavu);
router.use(zahtevajUlogu("ucenik"));

function procitajOdgovor(red) {
  try {
    return JSON.parse(red.odgovor);
  } catch {
    return { uvod: red.odgovor, preporuke: [] };
  }
}

// Dopunjava preporuke trenutnim podacima o aktivnostima.
async function prikaziPreporuku(red) {
  const odgovor = procitajOdgovor(red);
  const ids = (odgovor.preporuke || []).map(p => p.aktivnost_id);
  const redovi = ids.length
    ? await aktivnosti.upit(dbSupabase.from("aktivnosti").select("*").in("id", ids))
    : [];
  const obogacene = await aktivnosti.obogatiAktivnosti(dbSupabase, redovi);
  const poId = new Map(obogacene.map(a => [a.id, a]));

  return {
    id: red.id,
    pitanje: red.pitanje,
    kreirano_at: red.kreirano_at,
    izvor: odgovor.izvor || "tekst",
    model: odgovor.model || null,
    uvod: odgovor.uvod || "",
    preporuke: (odgovor.preporuke || []).map(p => ({
      ...p,
      aktivnost: poId.get(p.aktivnost_id) || null
    }))
  };
}

async function mojaPreporuka(id, korisnikId) {
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

// NOVA PREPORUKA (tekstualni ili glasovni unos pretvoren u tekst)
router.post("/preporuke", async (req, res) => {
  const tekst = typeof req.body?.tekst === "string" ? req.body.tekst.trim() : "";
  const izvor = req.body?.izvor === undefined ? "tekst" : req.body.izvor;

  if (tekst.length < 3 || tekst.length > 2000) {
    throw greska(400, "Opišite svoja interesovanja, sposobnosti i ciljeve (3–2000 znakova).");
  }
  if (!["tekst", "glas"].includes(izvor)) {
    throw greska(400, "Izvor mora biti tekst ili glas.");
  }

  const [dostupne, mojaInteresovanja, mojePrijave] = await Promise.all([
    aktivnosti.pregledAktivnosti(dbSupabase, { ucenikId: req.korisnik.id }),
    interesovanjaKorisnika(req.korisnik.id),
    aktivnosti.upit(
      dbSupabase
        .from("prijave")
        .select("aktivnost_id")
        .eq("ucenik_id", req.korisnik.id)
        .in("status_prijave", aktivnosti.AKTIVNI_STATUSI)
    )
  ]);

  const vecPrijavljen = new Set(mojePrijave.map(p => p.aktivnost_id));
  const kandidati = dostupne.filter(
    a => !vecPrijavljen.has(a.id) && a.slobodna_mesta > 0
  );
  const mojRaspored = dostupne
    .filter(a => vecPrijavljen.has(a.id))
    .map(a => ({
      naziv: a.naziv,
      termini: a.termini.length ? a.termini.map(opisTermina) : [a.termin]
    }));

  const rezultat = await generisiPreporuke({
    tekst,
    aktivnosti: kandidati,
    mojaInteresovanja,
    mojRaspored
  });

  const zaCuvanje = {
    uvod: rezultat.uvod,
    preporuke: rezultat.preporuke,
    model: rezultat.model,
    izvor
  };

  const { data: red, error } = await dbSupabase
    .from("ai_preporuke")
    .insert({
      korisnik_id: req.korisnik.id,
      pitanje: tekst,
      odgovor: JSON.stringify(zaCuvanje)
    })
    .select("id, pitanje, odgovor, kreirano_at")
    .single();
  if (error) throw error;

  if (rezultat.preporuke.length) {
    const { error: vezeGreska } = await dbSupabase
      .from("ai_preporuka_aktivnosti")
      .insert(
        rezultat.preporuke.map(p => ({
          preporuka_id: red.id,
          aktivnost_id: p.aktivnost_id
        }))
      );
    if (vezeGreska && !tabelaNedostaje(vezeGreska)) throw vezeGreska;
  }

  return res.status(201).json({ preporuka: await prikaziPreporuku(red) });
});

// ISTORIJA MOJIH PREPORUKA
router.get("/preporuke", async (req, res) => {
  const { data, error } = await dbSupabase
    .from("ai_preporuke")
    .select("id, pitanje, odgovor, kreirano_at")
    .eq("korisnik_id", req.korisnik.id)
    .order("kreirano_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  return res.json({
    preporuke: data.map(red => {
      const odgovor = procitajOdgovor(red);
      return {
        id: red.id,
        pitanje: red.pitanje,
        kreirano_at: red.kreirano_at,
        uvod: odgovor.uvod || "",
        broj_preporuka: (odgovor.preporuke || []).length
      };
    })
  });
});

router.get("/preporuke/:id", async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID preporuke.");
  const red = await mojaPreporuka(id, req.korisnik.id);
  return res.json({ preporuka: await prikaziPreporuku(red) });
});

router.delete("/preporuke/:id", async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID preporuke.");
  await mojaPreporuka(id, req.korisnik.id);

  const { error: vezeGreska } = await dbSupabase
    .from("ai_preporuka_aktivnosti")
    .delete()
    .eq("preporuka_id", id);
  if (vezeGreska && !tabelaNedostaje(vezeGreska)) throw vezeGreska;

  const { error } = await dbSupabase
    .from("ai_preporuke")
    .delete()
    .eq("id", id)
    .eq("korisnik_id", req.korisnik.id);
  if (error) throw error;

  return res.json({ poruka: "Preporuka je obrisana." });
});

module.exports = router;
