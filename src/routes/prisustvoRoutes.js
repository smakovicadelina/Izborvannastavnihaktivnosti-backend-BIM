const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const kontroler = require("../controllers/prisustvoController");

const router = express.Router();
router.use(zahtevajPrijavu);
const profesor = zahtevajUlogu("profesor");

router.post("/skeniraj", zahtevajUlogu("ucenik"), kontroler.skeniraj);
router.get("/", profesor, kontroler.pregled);
router.post("/", profesor, kontroler.kreiranje);
router.patch("/:id", profesor, kontroler.uredivanje);
router.delete("/:id", profesor, kontroler.brisanje);

module.exports = router;
