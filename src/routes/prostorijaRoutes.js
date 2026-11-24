// /api/prostorije - citanje: svaki prijavljeni korisnik; izmene: profesor
const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const validiraj = require("../middleware/validiraj");
const v = require("../validators/prostorijaValidator");
const kontroler = require("../controllers/prostorijaController");

const router = express.Router();
const profesor = zahtevajUlogu("profesor");
router.use(zahtevajPrijavu);

router.get("/", kontroler.pregled);
router.get("/:id", validiraj(v.samoId), kontroler.detalji);
router.get("/:id/dostupnost", validiraj(v.dostupnost), kontroler.dostupnost);
router.post("/", profesor, validiraj(v.kreiranje), kontroler.kreiranje);
router.patch("/:id", profesor, validiraj(v.uredivanje), kontroler.uredivanje);
router.delete("/:id", profesor, validiraj(v.samoId), kontroler.brisanje);

module.exports = router;
