// /api/moje-prijave - samo ucenik, samo sopstveni podaci
const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const validiraj = require("../middleware/validiraj");
const v = require("../validators/mojePrijaveValidator");
const kontroler = require("../controllers/mojePrijaveController");

const router = express.Router();
router.use(zahtevajPrijavu, zahtevajUlogu("ucenik"));

router.get("/", validiraj(v.pregled), kontroler.pregled);
router.get("/raspored", kontroler.raspored);
router.get("/istorija", kontroler.istorija);

module.exports = router;
