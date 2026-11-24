// /api/prisustva - evidencija prisustva (QR skeniranje i rucni unos)
const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const validiraj = require("../middleware/validiraj");
const v = require("../validators/prisustvoValidator");
const kontroler = require("../controllers/prisustvoController");

const router = express.Router();
const profesor = zahtevajUlogu("profesor");
router.use(zahtevajPrijavu);

router.post("/skeniraj", zahtevajUlogu("ucenik"), validiraj(v.skeniranje), kontroler.skeniraj);
router.get("/", profesor, validiraj(v.pregled), kontroler.pregled);
router.post("/", profesor, validiraj(v.kreiranje), kontroler.kreiranje);
router.patch("/:id", profesor, validiraj(v.uredivanje), kontroler.uredivanje);
router.delete("/:id", profesor, validiraj(v.samoId), kontroler.brisanje);

module.exports = router;
