
const express = require("express");
const { dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");

const router = express.Router();

router.use(zahtevajPrijavu);

router.get("/", async (req, res) => {
  try {
    const { data, error } = await dbSupabase
      .from("prostorije")
      .select("id, naziv, kapacitet, opis")
      .order("naziv");

    if (error) throw error;

    return res.json({ prostorije: data || [] });
  } catch (error) {
    console.error("Prostorije:", error);
    return res.status(500).json({
      greska: "Greška pri učitavanju prostorija."
    });
  }
});

router.post(
  "/",
  zahtevajUlogu("profesor", "administrator"),
  async (req, res) => {
    try {
      const { naziv, kapacitet, opis = null } = req.body || {};

      if (
        typeof naziv !== "string" ||
        !naziv.trim() ||
        !Number.isInteger(kapacitet) ||
        kapacitet < 1 ||
        (opis !== null && typeof opis !== "string")
      ) {
        return res.status(400).json({
          greska: "Neispravni podaci o prostoriji."
        });
      }

      const { data, error } = await dbSupabase
        .from("prostorije")
        .insert({
          naziv: naziv.trim(),
          kapacitet,
          opis
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({
            greska: "Prostorija već postoji."
          });
        }
        throw error;
      }

      return res.status(201).json({ prostorija: data });
    } catch (error) {
      console.error("Kreiranje prostorije:", error);
      return res.status(500).json({
        greska: "Greška pri kreiranju prostorije."
      });
    }
  }
);

router.patch(
  "/:id",
  zahtevajUlogu("profesor", "administrator"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          greska: "Neispravan ID prostorije."
        });
      }

      const unos = {};
      const body = req.body || {};

      if (Object.hasOwn(body, "naziv")) {
        if (typeof body.naziv !== "string" || !body.naziv.trim()) {
          return res.status(400).json({
            greska: "Naziv nije ispravan."
          });
        }
        unos.naziv = body.naziv.trim();
      }

      if (Object.hasOwn(body, "kapacitet")) {
        if (!Number.isInteger(body.kapacitet) || body.kapacitet < 1) {
          return res.status(400).json({
            greska: "Kapacitet nije ispravan."
          });
        }
        unos.kapacitet = body.kapacitet;
      }

      if (Object.hasOwn(body, "opis")) {
        if (body.opis !== null && typeof body.opis !== "string") {
          return res.status(400).json({
            greska: "Opis nije ispravan."
          });
        }
        unos.opis = body.opis;
      }

      if (!Object.keys(unos).length) {
        return res.status(400).json({
          greska: "Nema podataka za izmenu."
        });
      }

      const { data, error } = await dbSupabase
        .from("prostorije")
        .update(unos)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({
            greska: "Prostorija sa tim nazivom već postoji."
          });
        }
        if (error.code === "23514") {
          return res.status(409).json({
            greska: "Kapacitet prostorije nije dozvoljen."
          });
        }
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          greska: "Prostorija nije pronađena."
        });
      }

      return res.json({ prostorija: data });
    } catch (error) {
      console.error("Izmena prostorije:", error);
      return res.status(500).json({
        greska: "Greška pri izmeni prostorije."
      });
    }
  }
);

module.exports = router;
