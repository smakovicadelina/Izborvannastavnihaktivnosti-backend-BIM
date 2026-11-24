// /api/obavestenja - sopstvena obavestenja prijavljenog korisnika
const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const validiraj = require("../middleware/validiraj");
const v = require("../validators/obavestenjaValidator");
const kontroler = require("../controllers/obavestenjaController");

const router = express.Router();
router.use(zahtevajPrijavu);

router.get("/", validiraj(v.pregled), kontroler.pregled);
// "/procitaj-sve" mora biti pre "/:id/..." da se "procitaj-sve" ne bi tumacilo kao ID
router.patch("/procitaj-sve", kontroler.procitajSve);
router.patch("/:id/procitano", validiraj(v.samoId), kontroler.procitajJedno);
router.delete("/:id", validiraj(v.samoId), kontroler.obrisi);

module.exports = router;
