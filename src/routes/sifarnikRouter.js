// Zajednicki CRUD ruter za jednostavne sifarnike (kategorije, interesovanja):
// citanje je javno, izmene su dozvoljene samo profesoru.

const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const validiraj = require("../middleware/validiraj");
const v = require("../validators/sifarnikValidator");
const napraviSifarnikServis = require("../services/sifarnikService");
const napraviSifarnikKontroler = require("../controllers/sifarnikController");

function napraviSifarnikRouter(konfiguracija) {
  const router = express.Router();
  const profesor = [zahtevajPrijavu, zahtevajUlogu("profesor")];
  const servis = napraviSifarnikServis(konfiguracija);
  const kontroler = napraviSifarnikKontroler(servis, konfiguracija);

  router.get("/", kontroler.pregled);
  router.get("/:id", validiraj(v.samoId), kontroler.detalji);
  router.post("/", ...profesor, validiraj(v.kreiranje), kontroler.kreiranje);
  router.patch("/:id", ...profesor, validiraj(v.uredivanje), kontroler.uredivanje);
  router.delete("/:id", ...profesor, validiraj(v.samoId), kontroler.brisanje);

  return router;
}

module.exports = napraviSifarnikRouter;
