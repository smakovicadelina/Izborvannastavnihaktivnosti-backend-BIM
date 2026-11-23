const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const kontroler = require("../controllers/profilController");

const router = express.Router();
router.use(zahtevajPrijavu);

router.get("/", kontroler.pregled);
router.patch("/", kontroler.izmena);
router.get("/interesovanja", kontroler.interesovanja);
router.put("/interesovanja", kontroler.izmenaInteresovanja);

module.exports = router;
