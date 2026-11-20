
const express = require("express");
const { dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");

const router = express.Router();

function ispravnoVreme(value) {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)
  );
}

function sekundeOdPonoci(vreme) {
  const [sati, minuti, sekunde = "0"] = vreme.split(":");
  return Number(sati) * 3600 + Number(minuti) * 60 + Number(sekunde);
}

router.use(zahtevajPrijavu);

// PREGLED TERMINA
router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await dbSupabase
      .from("termini")
      .select(
        "id, dan_u_nedelji, vreme_od, vreme_do, prostorija_id"
      )
      .order("dan_u_nedelji")
      .order("vreme_od");

    if (error) throw error;

    return res.status(200).json({
      termini: data || []
    });
  } catch (error) {
    next(error);
  }
});

// KREIRANJE TERMINA
router.post(
  "/",
  zahtevajUlogu("profesor"),
  async (req, res, next) => {
    try {
      const {
        dan_u_nedelji,
        vreme_od,
        vreme_do,
        prostorija_id
      } = req.body || {};

      if (
        !Number.isInteger(dan_u_nedelji) ||
        dan_u_nedelji < 1 ||
        dan_u_nedelji > 7 ||
        !ispravnoVreme(vreme_od) ||
        !ispravnoVreme(vreme_do) ||
        sekundeOdPonoci(vreme_od) >= sekundeOdPonoci(vreme_do) ||
        !Number.isSafeInteger(prostorija_id) ||
        prostorija_id < 1
      ) {
        return res.status(400).json({
          greska: "Neispravni podaci o terminu."
        });
      }

      const { data, error } = await dbSupabase
        .from("termini")
        .insert({
          dan_u_nedelji,
          vreme_od,
          vreme_do,
          prostorija_id
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        poruka: "Termin je uspesno kreiran.",
        termin: data
      });
    } catch (error) {
      next(error);
    }
  }
);

// IZMENA TERMINA
router.patch(
  "/:id",
  zahtevajUlogu("profesor"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          greska: "Neispravan ID termina."
        });
      }

      const dozvoljenaPolja = [
        "dan_u_nedelji",
        "vreme_od",
        "vreme_do",
        "prostorija_id"
      ];

      const unos = {};

      for (const polje of dozvoljenaPolja) {
        if (Object.hasOwn(req.body || {}, polje)) {
          unos[polje] = req.body[polje];
        }
      }

      if (Object.keys(unos).length === 0) {
        return res.status(400).json({
          greska: "Nema podataka za izmenu."
        });
      }

      const { data: postojeci, error: greskaCitanja } =
        await dbSupabase
          .from("termini")
          .select("dan_u_nedelji, vreme_od, vreme_do, prostorija_id")
          .eq("id", id)
          .maybeSingle();

      if (greskaCitanja) throw greskaCitanja;

      if (!postojeci) {
        return res.status(404).json({
          greska: "Termin nije pronadjen."
        });
      }

      const novi = { ...postojeci, ...unos };

      if (
        !Number.isInteger(novi.dan_u_nedelji) ||
        novi.dan_u_nedelji < 1 ||
        novi.dan_u_nedelji > 7 ||
        !ispravnoVreme(novi.vreme_od) ||
        !ispravnoVreme(novi.vreme_do) ||
        sekundeOdPonoci(novi.vreme_od) >= sekundeOdPonoci(novi.vreme_do) ||
        !Number.isSafeInteger(novi.prostorija_id) ||
        novi.prostorija_id < 1
      ) {
        return res.status(400).json({
          greska: "Neispravni podaci za izmenu."
        });
      }

      const { data, error } = await dbSupabase
        .from("termini")
        .update(unos)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;

      return res.status(200).json({
        poruka: "Termin je izmenjen.",
        termin: data
      });
    } catch (error) {
      next(error);
    }
  }
);

// BRISANJE TERMINA
router.delete(
  "/:id",
  zahtevajUlogu("profesor"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          greska: "Neispravan ID termina."
        });
      }

      // Ne dozvoljavamo brisanje termina
      // koji je povezan sa aktivnostima.
      const { data: veze, error: greskaVeza } =
        await dbSupabase
          .from("aktivnost_termini")
          .select("aktivnost_id")
          .eq("termin_id", id)
          .limit(1);

      if (greskaVeza) throw greskaVeza;

      const { data: direktne, error: greskaDirektnih } =
        await dbSupabase
          .from("aktivnosti")
          .select("id")
          .eq("termin_id", id)
          .limit(1);

      if (greskaDirektnih) throw greskaDirektnih;

      if (veze.length || direktne.length) {
        return res.status(409).json({
          greska: "Termin je povezan sa aktivnoscu."
        });
      }

      const { data, error } = await dbSupabase
        .from("termini")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({
          greska: "Termin nije pronadjen."
        });
      }

      return res.status(200).json({
        poruka: "Termin je obrisan."
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
