const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const kontroler = require("../controllers/aiController");

const router = express.Router();
router.use(zahtevajPrijavu);
router.use(zahtevajUlogu("ucenik"));

router.post("/preporuke", kontroler.kreiraj);
router.get("/preporuke", kontroler.pregled);
router.get("/preporuke/:id", kontroler.detalji);
router.delete("/preporuke/:id", kontroler.obrisi);

module.exports = router;
