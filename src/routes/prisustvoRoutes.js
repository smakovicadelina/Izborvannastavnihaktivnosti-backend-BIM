
const express = require("express");
const { dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const { proveriQrKod } = require("../services/qrService");
const {
  greska,
  imaPolje,
  zahtevajId,
  parsirajId,
  jeDatum,
  danasnjiDatum
} = require("../utils/http");

const router = express.Router();
router.use(zahtevajPrijavu);

const profesor = zahtevajUlogu("profesor");

// Upisuje ili azurira prisustvo za (prijava, datum).
async function evidentiraj(prijavaId, datum, prisutan) {
  const { data: postojece, error } = await dbSupabase
    .from("prisustva")
    .select("id")
    .eq("prijava_id", prijavaId)
    .eq("datum", datum)
    .maybeSingle();
  if (error) throw error;

  const upit = postojece
    ? dbSupabase
        .from("prisustva")
        .update({ prisutan, evidentirano_at: new Date().toISOString() })
        .eq("id", postojece.id)
    : dbSupabase
        .from("prisustva")
        .insert({ prijava_id: prijavaId, datum, prisutan });

  const { data, error: upisGreska } = await upit
    .select("id, prijava_id, datum, prisutan, evidentirano_at")
    .single();
  if (upisGreska) throw upisGreska;

  return { prisustvo: data, novo: !postojece };
}

// UCENIK SKENIRA QR KOD (kamera) I POTVRDJUJE PRISUSTVO
router.post("/skeniraj", zahtevajUlogu("ucenik"), async (req, res) => {
  let podaci;
  try {
    podaci = proveriQrKod(req.body?.kod);
  } catch (error) {
    throw greska(400, error.razlog || "QR kod nije ispravan.");
  }

  const { data: aktivnost, error: aktivnostGreska } = await dbSupabase
    .from("aktivnosti")
    .select("id, naziv, aktivna")
    .eq("id", podaci.aktivnostId)
    .maybeSingle();
  if (aktivnostGreska) throw aktivnostGreska;
  if (!aktivnost || !aktivnost.aktivna) {
    throw greska(404, "Aktivnost nije dostupna.");
  }

  const { data: prijava, error } = await dbSupabase
    .from("prijave")
    .select("id")
    .eq("ucenik_id", req.korisnik.id)
    .eq("aktivnost_id", podaci.aktivnostId)
    .eq("status_prijave", "prijavljen")
    .maybeSingle();
  if (error) throw error;
  if (!prijava) {
    throw greska(403, "Niste prijavljeni na ovu aktivnost.");
  }

  const { prisustvo, novo } = await evidentiraj(prijava.id, podaci.datum, true);

  return res.status(novo ? 201 : 200).json({
    poruka: `Prisustvo na aktivnosti "${aktivnost.naziv}" je evidentirano.`,
    prisustvo
  });
});

// PROFESOR: PREGLED PRISUSTVA ZA AKTIVNOST (opciono za datum)
router.get("/", profesor, async (req, res) => {
  const aktivnostId = zahtevajId(req.query.aktivnost_id, "Parametar aktivnost_id je obavezan.");
  const { datum } = req.query;
  if (datum !== undefined && !jeDatum(datum)) {
    throw greska(400, "Datum mora biti u formatu YYYY-MM-DD.");
  }

  const { data: prijave, error } = await dbSupabase
    .from("prijave")
    .select("id, ucenik_id, status_prijave")
    .eq("aktivnost_id", aktivnostId);
  if (error) throw error;
  if (!prijave.length) return res.json({ prisustva: [] });

  let q = dbSupabase
    .from("prisustva")
    .select("id, prijava_id, datum, prisutan, evidentirano_at")
    .in("prijava_id", prijave.map(p => p.id))
    .order("datum", { ascending: false });
  if (datum) q = q.eq("datum", datum);

  const { data: prisustva, error: greskaPrisustva } = await q;
  if (greskaPrisustva) throw greskaPrisustva;

  const { data: ucenici, error: greskaUcenika } = await dbSupabase
    .from("korisnici")
    .select("id, ime_i_prezime, razred_odeljenje")
    .in("id", [...new Set(prijave.map(p => p.ucenik_id))]);
  if (greskaUcenika) throw greskaUcenika;

  const prijavePoId = new Map(prijave.map(p => [p.id, p]));
  const uceniciPoId = new Map(ucenici.map(u => [u.id, u]));

  return res.json({
    prisustva: prisustva.map(p => ({
      ...p,
      ucenik: uceniciPoId.get(prijavePoId.get(p.prijava_id)?.ucenik_id) || null
    }))
  });
});

// PROFESOR: RUCNA EVIDENCIJA PRISUSTVA
router.post("/", profesor, async (req, res) => {
  const b = req.body || {};
  const prijavaId = parsirajId(b.prijava_id);
  const datum = b.datum ?? danasnjiDatum();

  if (!prijavaId) throw greska(400, "prijava_id je obavezan.");
  if (!jeDatum(datum)) throw greska(400, "Datum mora biti u formatu YYYY-MM-DD.");
  if (imaPolje(b, "prisutan") && typeof b.prisutan !== "boolean") {
    throw greska(400, "Polje prisutan mora biti true ili false.");
  }

  const { data: prijava, error } = await dbSupabase
    .from("prijave")
    .select("id, status_prijave")
    .eq("id", prijavaId)
    .maybeSingle();
  if (error) throw error;
  if (!prijava) throw greska(404, "Prijava nije pronađena.");
  if (prijava.status_prijave !== "prijavljen") {
    throw greska(409, "Prisustvo se evidentira samo za potvrđene prijave.");
  }

  const { prisustvo, novo } = await evidentiraj(
    prijavaId,
    datum,
    imaPolje(b, "prisutan") ? b.prisutan : true
  );

  return res.status(novo ? 201 : 200).json({ prisustvo });
});

router.patch("/:id", profesor, async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID prisustva.");
  const b = req.body || {};
  const unos = {};

  if (imaPolje(b, "prisutan")) {
    if (typeof b.prisutan !== "boolean") {
      throw greska(400, "Polje prisutan mora biti true ili false.");
    }
    unos.prisutan = b.prisutan;
  }
  if (imaPolje(b, "datum")) {
    if (!jeDatum(b.datum)) throw greska(400, "Datum mora biti u formatu YYYY-MM-DD.");
    unos.datum = b.datum;
  }
  if (!Object.keys(unos).length) throw greska(400, "Nema podataka za izmenu.");

  const { data, error } = await dbSupabase
    .from("prisustva")
    .update(unos)
    .eq("id", id)
    .select("id, prijava_id, datum, prisutan, evidentirano_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Evidencija prisustva nije pronađena.");
  return res.json({ prisustvo: data });
});

router.delete("/:id", profesor, async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID prisustva.");
  const { data, error } = await dbSupabase
    .from("prisustva")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Evidencija prisustva nije pronađena.");
  return res.json({ poruka: "Evidencija prisustva je obrisana." });
});

module.exports = router;
