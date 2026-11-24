// /api/aktivnosti - aktivnosti i prijave na njih
const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const { opcionaPrijava } = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const validiraj = require("../middleware/validiraj");
const v = require("../validators/aktivnostValidator");
const vp = require("../validators/prijavaValidator");
const kontroler = require("../controllers/aktivnostController");
const prijave = require("../controllers/prijavaController");

const router = express.Router();
const profesor = [zahtevajPrijavu, zahtevajUlogu("profesor")];
const ucenik = [zahtevajPrijavu, zahtevajUlogu("ucenik")];

// READ - pregled, pretraga i filtriranje (javno; token je opcion)
router.get("/", opcionaPrijava, validiraj(v.pregled), kontroler.pregled);
router.get("/:aktivnostId", opcionaPrijava, validiraj(v.samoId), kontroler.detalji);
// Slobodna mesta (zadrzano zbog kompatibilnosti sa frontendom; isto sto i detalji)
router.get("/:aktivnostId/mesta", zahtevajPrijavu, validiraj(v.samoId), kontroler.detalji);

// CREATE / UPDATE / DELETE - samo profesor
router.post("/", ...profesor, validiraj(v.kreiranje), kontroler.kreiranje);
router.patch("/:aktivnostId", ...profesor, validiraj(v.uredivanje), kontroler.uredivanje);
router.delete("/:aktivnostId", ...profesor, validiraj(v.samoId), kontroler.brisanje);
router.patch("/:aktivnostId/deaktiviraj", ...profesor, validiraj(v.samoId), kontroler.deaktiviranje);
router.patch("/:aktivnostId/aktiviraj", ...profesor, validiraj(v.samoId), kontroler.aktiviranje);

// QR kod za evidenciju prisustva - profesor
router.get("/:aktivnostId/qr", ...profesor, validiraj(v.qrKod), kontroler.qrKod);

// PRIJAVE - profesor upravlja prijavama na aktivnost
router.get("/:aktivnostId/prijave", ...profesor, validiraj(vp.pregled), prijave.pregled);
router.post("/:aktivnostId/prijave", ...profesor, validiraj(vp.upis), prijave.upis);
router.patch("/:aktivnostId/prijave/:prijavaId", ...profesor, validiraj(vp.promenaStatusa), prijave.promenaStatusa);
router.delete("/:aktivnostId/prijave/:prijavaId", ...profesor, validiraj(vp.brisanje), prijave.brisanje);

// PRIJAVA - ucenik se prijavljuje / otkazuje
router.post("/:aktivnostId/prijava", ...ucenik, validiraj(vp.ucenikovaPrijava), prijave.prijava);
router.delete("/:aktivnostId/prijava", ...ucenik, validiraj(vp.ucenikovaPrijava), prijave.otkazivanje);

module.exports = router;
