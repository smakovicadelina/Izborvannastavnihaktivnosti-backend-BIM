
const express = require("express");

const { dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");

const router = express.Router();

router.use(zahtevajPrijavu);
router.use(zahtevajUlogu("ucenik"));

// UCENIK VIDI SAMO SVOJE PRIJAVE
router.get("/", async (req, res) => {
  try {
    const { data, error } = await dbSupabase
      .from("prijave")
      .select(
        "id, aktivnost_id, status_prijave, prijavljen_at"
      )
      .eq("ucenik_id", req.korisnik.id)
      .order("prijavljen_at", {
        ascending: false
      });

    if (error) throw error;

    return res.status(200).json({
      prijave: data || []
    });
  } catch (error) {
    console.error("Moje prijave:", error);

    return res.status(500).json({
      greska: "Greška pri učitavanju prijava."
    });
  }
});

module.exports = router;
