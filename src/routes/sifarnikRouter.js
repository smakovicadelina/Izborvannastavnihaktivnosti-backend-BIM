
// Zajednicki CRUD ruter za jednostavne sifarnike (kategorije, interesovanja):
// citanje je javno, izmene su dozvoljene samo profesoru.

const express = require("express");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const napraviSifarnikKontroler = require("../controllers/sifarnikController");

function napraviSifarnikRouter(konfiguracija) {
  const router = express.Router();
  const profesor = [zahtevajPrijavu, zahtevajUlogu("profesor")];
  const kontroler = napraviSifarnikKontroler(konfiguracija);

  router.get("/", kontroler.pregled);
  router.get("/:id", kontroler.detalji);
  router.post("/", ...profesor, kontroler.kreiranje);
  router.patch("/:id", ...profesor, kontroler.uredivanje);
  router.delete("/:id", ...profesor, kontroler.brisanje);

  return router;
}

module.exports = napraviSifarnikRouter;
