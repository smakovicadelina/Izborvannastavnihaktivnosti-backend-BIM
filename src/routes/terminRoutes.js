
const express = require("express");
const { dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const {
  upit,
  zahtevajAktivnost,
  terminiAktivnosti
} = require("../services/aktivnostService");
const {
  zahtevajProstoriju,
  proveriDostupnostProstorije,
  aktivnostiTermina
} = require("../services/terminService");
const { obavestiUcenikeAktivnosti } = require("../services/obavestenjaService");
const { greska, imaPolje, zahtevajId, parsirajId } = require("../utils/http");
const {
  ispravnoVreme,
  sekundeOdPonoci,
  nazivDana,
  opisTermina,
  sortirajTermine
} = require("../utils/vreme");

const router = express.Router();
const profesor = zahtevajUlogu("profesor");

function validanTermin(t) {
  return (
    Number.isInteger(t.dan_u_nedelji) &&
    t.dan_u_nedelji >= 1 &&
    t.dan_u_nedelji <= 7 &&
    ispravnoVreme(t.vreme_od) &&
    ispravnoVreme(t.vreme_do) &&
    sekundeOdPonoci(t.vreme_od) < sekundeOdPonoci(t.vreme_do) &&
    Number.isSafeInteger(t.prostorija_id) &&
    t.prostorija_id > 0
  );
}

async function terminSaProstorijom(id) {
  const { data, error } = await dbSupabase
    .from("termini")
    .select("id, dan_u_nedelji, vreme_od, vreme_do, prostorija_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

router.use(zahtevajPrijavu);

// PREGLED TERMINA (opciono ?prostorija_id=&dan=)
router.get("/", async (req, res) => {
  let q = dbSupabase
    .from("termini")
    .select("id, dan_u_nedelji, vreme_od, vreme_do, prostorija_id")
    .order("dan_u_nedelji")
    .order("vreme_od");

  if (req.query.prostorija_id !== undefined) {
    q = q.eq("prostorija_id", zahtevajId(req.query.prostorija_id, "Neispravan ID prostorije."));
  }
  if (req.query.dan !== undefined) {
    const dan = parsirajId(req.query.dan);
    if (!dan || dan > 7) throw greska(400, "Dan mora biti broj od 1 do 7.");
    q = q.eq("dan_u_nedelji", dan);
  }

  const termini = await upit(q);
  const prostorijaIds = [...new Set(termini.map(t => t.prostorija_id))];
  const prostorije = prostorijaIds.length
    ? await upit(dbSupabase.from("prostorije").select("id, naziv, kapacitet").in("id", prostorijaIds))
    : [];
  const poId = new Map(prostorije.map(p => [p.id, p]));

  return res.status(200).json({
    termini: termini.map(t => ({
      ...t,
      dan: nazivDana(t.dan_u_nedelji),
      prostorija: poId.get(t.prostorija_id) || null
    }))
  });
});

router.get("/:id", async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID termina.");
  const termin = await terminSaProstorijom(id);
  if (!termin) throw greska(404, "Termin nije pronađen.");

  const aktivnosti = await aktivnostiTermina(dbSupabase, [id]);
  return res.json({
    termin: { ...termin, dan: nazivDana(termin.dan_u_nedelji), aktivnosti }
  });
});

// KREIRANJE TERMINA (provera dostupnosti prostorije)
router.post("/", profesor, async (req, res) => {
  const { dan_u_nedelji, vreme_od, vreme_do, prostorija_id } = req.body || {};
  const novi = { dan_u_nedelji, vreme_od, vreme_do, prostorija_id };

  if (!validanTermin(novi)) {
    throw greska(400, "Neispravni podaci o terminu.");
  }

  await zahtevajProstoriju(dbSupabase, prostorija_id);
  await proveriDostupnostProstorije(dbSupabase, novi);

  const { data, error } = await dbSupabase
    .from("termini")
    .insert(novi)
    .select()
    .single();
  if (error) throw error;

  return res.status(201).json({
    poruka: "Termin je uspešno kreiran.",
    termin: data
  });
});

// IZMENA TERMINA
router.patch("/:id", profesor, async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID termina.");
  const unos = {};

  for (const polje of ["dan_u_nedelji", "vreme_od", "vreme_do", "prostorija_id"]) {
    if (imaPolje(req.body, polje)) unos[polje] = req.body[polje];
  }

  if (!Object.keys(unos).length) {
    throw greska(400, "Nema podataka za izmenu.");
  }

  const postojeci = await terminSaProstorijom(id);
  if (!postojeci) throw greska(404, "Termin nije pronađen.");

  const novi = { ...postojeci, ...unos };
  if (!validanTermin(novi)) {
    throw greska(400, "Neispravni podaci za izmenu.");
  }

  const aktivnosti = await aktivnostiTermina(dbSupabase, [id]);

  if (unos.prostorija_id && unos.prostorija_id !== postojeci.prostorija_id) {
    const prostorija = await zahtevajProstoriju(dbSupabase, unos.prostorija_id);
    const prevelika = aktivnosti.find(a => a.aktivna && a.maksimalno_mesta > prostorija.kapacitet);
    if (prevelika) {
      throw greska(
        409,
        `Prostorija ${prostorija.naziv} (kapacitet ${prostorija.kapacitet}) je premala za aktivnost "${prevelika.naziv}" (${prevelika.maksimalno_mesta} mesta).`
      );
    }
  }

  await proveriDostupnostProstorije(dbSupabase, novi, id);

  const { data, error } = await dbSupabase
    .from("termini")
    .update(unos)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;

  // Osvezavamo tekstualni opis termina/prostorije u povezanim aktivnostima.
  for (const a of aktivnosti) {
    const puna = await zahtevajAktivnost(dbSupabase, a.id);
    const termini = sortirajTermine(await terminiAktivnosti(dbSupabase, puna));
    if (!termini.length) continue;
    const { error: tekstGreska } = await dbSupabase
      .from("aktivnosti")
      .update({
        termin: termini.map(opisTermina).join("; "),
        prostorija: [...new Set(termini.map(t => t.prostorija?.naziv).filter(Boolean))].join(", ") || null
      })
      .eq("id", a.id);
    if (tekstGreska) throw tekstGreska;
  }

  // Obavestavamo ucenike svih aktivnosti koje koriste ovaj termin.
  for (const a of aktivnosti.filter(x => x.aktivna)) {
    await obavestiUcenikeAktivnosti(dbSupabase, a.id, {
      tip: "promena_termina",
      naslov: "Promena termina",
      poruka: `Termin aktivnosti "${a.naziv}" je promenjen: ${opisTermina(data)}.`
    });
  }

  return res.status(200).json({
    poruka: "Termin je izmenjen.",
    termin: data
  });
});

// BRISANJE TERMINA (nije dozvoljeno ako je povezan sa aktivnoscu)
router.delete("/:id", profesor, async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID termina.");

  const aktivnosti = await aktivnostiTermina(dbSupabase, [id]);
  if (aktivnosti.length) {
    throw greska(409, `Termin je povezan sa aktivnošću "${aktivnosti[0].naziv}".`);
  }

  const { data, error } = await dbSupabase
    .from("termini")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Termin nije pronađen.");

  return res.status(200).json({ poruka: "Termin je obrisan." });
});

module.exports = router;
