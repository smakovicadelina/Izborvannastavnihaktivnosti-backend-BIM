const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const kontroler = require("../controllers/terminController");

const router = express.Router();
const profesor = zahtevajUlogu("profesor");
router.use(zahtevajPrijavu);

router.get("/", kontroler.pregled);
router.get("/:id", kontroler.detalji);
router.post("/", profesor, kontroler.kreiranje);
router.patch("/:id", profesor, kontroler.uredivanje);
router.delete("/:id", profesor, kontroler.brisanje);

module.exports = router;
