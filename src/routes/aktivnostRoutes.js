
const express = require("express");

const kontroler = require("../controllers/aktivnostController");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const { opcionaPrijava } = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");

const router = express.Router();
const profesor = [zahtevajPrijavu, zahtevajUlogu("profesor")];
const ucenik = [zahtevajPrijavu, zahtevajUlogu("ucenik")];

// PREGLED, PRETRAGA I FILTRIRANJE AKTIVNOSTI (javno; token je opcion)
router.get("/", opcionaPrijava, kontroler.pregled);

// DETALJI AKTIVNOSTI
router.get("/:aktivnostId", opcionaPrijava, kontroler.detalji);

// SLOBODNA MESTA (zadrzano zbog kompatibilnosti sa frontendom)
router.get("/:aktivnostId/mesta", zahtevajPrijavu, kontroler.mesta);

// PROFESOR - KREIRANJE AKTIVNOSTI
router.post("/", ...profesor, kontroler.kreiranje);

// PROFESOR - UREDJIVANJE
router.patch("/:aktivnostId", ...profesor, kontroler.uredivanje);

// PROFESOR - BRISANJE (samo aktivnost bez prijava)
router.delete("/:aktivnostId", ...profesor, kontroler.brisanje);

// PROFESOR - DEAKTIVACIJA / AKTIVACIJA
router.patch("/:aktivnostId/deaktiviraj", ...profesor, kontroler.deaktiviranje);
router.patch("/:aktivnostId/aktiviraj", ...profesor, kontroler.aktiviranje);

// PROFESOR - QR KOD ZA PRISUSTVO
router.get("/:aktivnostId/qr", ...profesor, kontroler.qrKod);

// PROFESOR - UPRAVLJANJE PRIJAVAMA
router.get("/:aktivnostId/prijave", ...profesor, kontroler.prijaveAktivnosti);
router.post("/:aktivnostId/prijave", ...profesor, kontroler.upisUcenika);
router.patch("/:aktivnostId/prijave/:prijavaId", ...profesor, kontroler.azurirajPrijavu);
router.delete("/:aktivnostId/prijave/:prijavaId", ...profesor, kontroler.brisanjePrijave);

// UCENIK - PRIJAVA I OTKAZIVANJE
router.post("/:aktivnostId/prijava", ...ucenik, kontroler.prijava);
router.delete("/:aktivnostId/prijava", ...ucenik, kontroler.otkazivanje);

module.exports = router;
