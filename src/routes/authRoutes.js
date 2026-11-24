// /api/auth - registracija, prijava, odjava, token
const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const validiraj = require("../middleware/validiraj");
const validator = require("../validators/authValidator");
const kontroler = require("../controllers/authController");

const router = express.Router();

// Javne rute
router.post("/registracija", validiraj(validator.registracija), kontroler.registracija);
router.post("/prijava", validiraj(validator.prijava), kontroler.prijava);
router.post("/osvezi-token", validiraj(validator.osveziToken), kontroler.osveziToken);

// Zasticene rute (potreban token)
router.post("/odjava", zahtevajPrijavu, kontroler.odjava);
router.get("/me", zahtevajPrijavu, kontroler.trenutniKorisnik);
router.get("/zahtev-za-profesora", zahtevajPrijavu, kontroler.pregledZahteva);
router.post("/zahtev-za-profesora", zahtevajPrijavu, kontroler.zahtevZaProfesora);

module.exports = router;
