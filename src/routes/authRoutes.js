const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const kontroler = require("../controllers/authController");

const router = express.Router();

router.post("/registracija", kontroler.registracija);
router.post("/prijava", kontroler.prijava);
router.get("/me", zahtevajPrijavu, kontroler.trenutniKorisnik);
router.get("/zahtev-za-profesora", zahtevajPrijavu, kontroler.pregledZahteva);
router.post("/zahtev-za-profesora", zahtevajPrijavu, kontroler.zahtevZaProfesora);
router.post("/osvezi-token", kontroler.osveziToken);
router.post("/odjava", zahtevajPrijavu, kontroler.odjava);

module.exports = router;
