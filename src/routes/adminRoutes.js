// Upravljacki panel profesora sa administratorskim ovlascenjima.

const express = require("express");
const kontroler = require("../controllers/adminController");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");

const router = express.Router();
router.use(zahtevajPrijavu);
router.use(zahtevajUlogu("profesor"));

// UCENICI
router.get("/ucenici", kontroler.pregledUcenika);
router.get("/ucenici/:id", kontroler.detaljiUcenika);
router.post("/ucenici", kontroler.kreiranjeUcenika);
router.patch("/ucenici/:id", kontroler.azuriranjeUcenika);
router.delete("/ucenici/:id", kontroler.brisanjeUcenika);

// ZAHTEVI ZA PROFESORSKI NALOG
router.get("/zahtevi-za-profesora", kontroler.pregledZahteva);
router.patch("/zahtevi-za-profesora/:id", kontroler.obradaZahteva);

// PREGLED SVIH PRIJAVA
router.get("/prijave", kontroler.pregledPrijava);

// STATISTIKA
router.get("/statistika", kontroler.statistika);

module.exports = router;
