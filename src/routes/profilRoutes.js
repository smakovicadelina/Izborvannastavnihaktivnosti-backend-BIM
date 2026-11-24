// /api/profil - profil ulogovanog korisnika
const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const validiraj = require("../middleware/validiraj");
const v = require("../validators/profilValidator");
const kontroler = require("../controllers/profilController");

const router = express.Router();
router.use(zahtevajPrijavu);

router.get("/", kontroler.pregled);
router.patch("/", validiraj(v.izmena), kontroler.izmena);
router.get("/interesovanja", kontroler.interesovanja);
router.put("/interesovanja", validiraj(v.interesovanja), kontroler.izmenaInteresovanja);

module.exports = router;
