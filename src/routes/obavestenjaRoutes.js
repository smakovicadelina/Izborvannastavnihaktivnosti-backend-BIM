const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const kontroler = require("../controllers/obavestenjaController");

const router = express.Router();
router.use(zahtevajPrijavu);

router.get("/", kontroler.pregled);
router.patch("/procitaj-sve", kontroler.procitajSve);
router.patch("/:id/procitano", kontroler.procitajJedno);
router.delete("/:id", kontroler.obrisi);

module.exports = router;
