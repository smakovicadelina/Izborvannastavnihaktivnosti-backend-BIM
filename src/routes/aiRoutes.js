// /api/ai - AI preporuke aktivnosti (samo ucenik)
const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const validiraj = require("../middleware/validiraj");
const v = require("../validators/aiValidator");
const kontroler = require("../controllers/aiController");

const router = express.Router();
router.use(zahtevajPrijavu, zahtevajUlogu("ucenik"));

router.post("/preporuke", validiraj(v.kreiranje), kontroler.kreiraj);
router.get("/preporuke", kontroler.pregled);
router.get("/preporuke/:id", validiraj(v.samoId), kontroler.detalji);
router.delete("/preporuke/:id", validiraj(v.samoId), kontroler.obrisi);

module.exports = router;
