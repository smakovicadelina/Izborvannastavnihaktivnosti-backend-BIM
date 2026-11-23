const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const kontroler = require("../controllers/mojePrijaveController");

const router = express.Router();
router.use(zahtevajPrijavu);
router.use(zahtevajUlogu("ucenik"));

router.get("/", kontroler.pregled);
router.get("/raspored", kontroler.raspored);
router.get("/istorija", kontroler.istorija);

module.exports = router;
