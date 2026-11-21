
const express = require("express");
const { dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const { upit } = require("../services/aktivnostService");
const {
  preklapanjaUProstoriji,
  aktivnostiTermina
} = require("../services/terminService");
const {
  greska,
  imaPolje,
  zahtevajId,
  parsirajId,
  jeNeprazanTekst,
  opcioniTekst
} = require("../utils/http");
const { ispravnoVreme, sekundeOdPonoci, nazivDana } = require("../utils/vreme");

const router = express.Router();
const profesor = zahtevajUlogu("profesor");

router.use(zahtevajPrijavu);

router.get("/", async (req, res) => {
  const { data, error } = await dbSupabase
    .from("prostorije")
    .select("id, naziv, kapacitet, opis")
    .order("naziv");
  if (error) throw error;
  return res.json({ prostorije: data || [] });
});

router.get("/:id", async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID prostorije.");
  const { data, error } = await dbSupabase
    .from("prostorije")
    .select("id, naziv, kapacitet, opis")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Prostorija nije pronađena.");

  const termini = await upit(
    dbSupabase
      .from("termini")
      .select("id, dan_u_nedelji, vreme_od, vreme_do")
      .eq("prostorija_id", id)
      .order("dan_u_nedelji")
      .order("vreme_od")
  );

  return res.json({
    prostorija: {
      ...data,
      termini: termini.map(t => ({ ...t, dan: nazivDana(t.dan_u_nedelji) }))
    }
  });
});

// PROVERA DOSTUPNOSTI PROSTORIJE ZA DAN I VREME
router.get("/:id/dostupnost", async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID prostorije.");
  const dan = parsirajId(req.query.dan);
  const { vreme_od, vreme_do } = req.query;

  if (
    !dan || dan > 7 ||
    !ispravnoVreme(vreme_od) ||
    !ispravnoVreme(vreme_do) ||
    sekundeOdPonoci(vreme_od) >= sekundeOdPonoci(vreme_do)
  ) {
    throw greska(400, "Navedite dan (1–7), vreme_od i vreme_do (HH:MM), gde je vreme_od pre vreme_do.");
  }

  const preklapanja = await preklapanjaUProstoriji(dbSupabase, {
    prostorija_id: id,
    dan_u_nedelji: dan,
    vreme_od,
    vreme_do
  });

  return res.json({
    dostupna: preklapanja.length === 0,
    preklapanja
  });
});

router.post("/", profesor, async (req, res) => {
  const { naziv, kapacitet, opis = null } = req.body || {};
  const opisV = opcioniTekst(opis, 2000);

  if (
    !jeNeprazanTekst(naziv, 100) ||
    !Number.isInteger(kapacitet) ||
    kapacitet < 1 ||
    !opisV.ok
  ) {
    throw greska(400, "Neispravni podaci o prostoriji.");
  }

  const { data, error } = await dbSupabase
    .from("prostorije")
    .insert({ naziv: naziv.trim(), kapacitet, opis: opisV.vrednost })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw greska(409, "Prostorija već postoji.");
    throw error;
  }

  return res.status(201).json({ prostorija: data });
});

router.patch("/:id", profesor, async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID prostorije.");
  const unos = {};
  const body = req.body || {};

  if (imaPolje(body, "naziv")) {
    if (!jeNeprazanTekst(body.naziv, 100)) throw greska(400, "Naziv nije ispravan.");
    unos.naziv = body.naziv.trim();
  }

  if (imaPolje(body, "kapacitet")) {
    if (!Number.isInteger(body.kapacitet) || body.kapacitet < 1) {
      throw greska(400, "Kapacitet nije ispravan.");
    }
    unos.kapacitet = body.kapacitet;
  }

  if (imaPolje(body, "opis")) {
    const opis = opcioniTekst(body.opis, 2000);
    if (!opis.ok) throw greska(400, "Opis nije ispravan.");
    unos.opis = opis.vrednost;
  }

  if (!Object.keys(unos).length) throw greska(400, "Nema podataka za izmenu.");

  // Kapacitet ne sme pasti ispod broja mesta aktivnosti koje koriste prostoriju.
  if (unos.kapacitet) {
    const termini = await upit(
      dbSupabase.from("termini").select("id").eq("prostorija_id", id)
    );
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
  return res.json({ prostorija: data });
});

router.delete("/:id", profesor, async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID prostorije.");

  const { count, error: countError } = await dbSupabase
    .from("termini")
    .select("id", { count: "exact", head: true })
    .eq("prostorija_id", id);
  if (countError) throw countError;
  if (count) {
    throw greska(409, "Prostorija ima termine i ne može se obrisati. Najpre obrišite ili premestite termine.");
  }

  const { data, error } = await dbSupabase
    .from("prostorije")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Prostorija nije pronađena.");

  return res.json({ poruka: "Prostorija je obrisana." });
});

module.exports = router;
