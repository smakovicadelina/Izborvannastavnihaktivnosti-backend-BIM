// /api/admin - upravljacki panel; SVE rute zahtevaju ulogu profesor
const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const validiraj = require("../middleware/validiraj");
const v = require("../validators/adminValidator");
const kontroler = require("../controllers/adminController");

const router = express.Router();
router.use(zahtevajPrijavu, zahtevajUlogu("profesor"));

// UCENICI - CRUD
router.get("/ucenici", validiraj(v.listaUcenika), kontroler.pregledUcenika);
router.get("/ucenici/:id", validiraj(v.samoUcenikId), kontroler.detaljiUcenika);
router.post("/ucenici", validiraj(v.kreiranjeUcenika), kontroler.kreiranjeUcenika);
router.patch("/ucenici/:id", validiraj(v.azuriranjeUcenika), kontroler.azuriranjeUcenika);
router.delete("/ucenici/:id", validiraj(v.samoUcenikId), kontroler.brisanjeUcenika);

// ZAHTEVI ZA PROFESORSKI NALOG
router.get("/zahtevi-za-profesora", validiraj(v.listaZahteva), kontroler.pregledZahteva);
router.patch("/zahtevi-za-profesora/:id", validiraj(v.obradaZahteva), kontroler.obradaZahteva);

// PREGLED SVIH PRIJAVA I STATISTIKA
router.get("/prijave", validiraj(v.listaPrijava), kontroler.pregledPrijava);
router.get("/statistika", kontroler.statistika);

module.exports = router;
