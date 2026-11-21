
const express = require("express");
const { dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const { greska, zahtevajId } = require("../utils/http");

const router = express.Router();
router.use(zahtevajPrijavu);

// MOJA OBAVESTENJA (korisnik vidi samo svoja)
router.get("/", async (req, res) => {
  const samoNeprocitana = ["true", "1"].includes(String(req.query.neprocitana));
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  let q = dbSupabase
    .from("obavestenja")
    .select("id, tip, naslov, poruka, aktivnost_id, procitano, kreirano_at")
    .eq("korisnik_id", req.korisnik.id)
    .order("kreirano_at", { ascending: false })
    .limit(limit);

  if (samoNeprocitana) q = q.eq("procitano", false);

  const { data, error } = await q;
  if (error) throw error;

  const { count, error: countError } = await dbSupabase
    .from("obavestenja")
    .select("id", { count: "exact", head: true })
    .eq("korisnik_id", req.korisnik.id)
    .eq("procitano", false);
  if (countError) throw countError;

  return res.json({
    obavestenja: data,
    broj_neprocitanih: count || 0
  });
});

router.patch("/procitaj-sve", async (req, res) => {
  const { error } = await dbSupabase
    .from("obavestenja")
    .update({ procitano: true })
    .eq("korisnik_id", req.korisnik.id)
    .eq("procitano", false);
  if (error) throw error;
  return res.json({ poruka: "Sva obaveštenja su označena kao pročitana." });
});

router.patch("/:id/procitano", async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID obaveštenja.");
  const { data, error } = await dbSupabase
    .from("obavestenja")
    .update({ procitano: true })
    .eq("id", id)
    .eq("korisnik_id", req.korisnik.id)
    .select("id, procitano")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Obaveštenje nije pronađeno.");
  return res.json({ obavestenje: data });
});

router.delete("/:id", async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID obaveštenja.");
  const { data, error } = await dbSupabase
    .from("obavestenja")
    .delete()
    .eq("id", id)
    .eq("korisnik_id", req.korisnik.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Obaveštenje nije pronađeno.");
  return res.json({ poruka: "Obaveštenje je obrisano." });
});

module.exports = router;
