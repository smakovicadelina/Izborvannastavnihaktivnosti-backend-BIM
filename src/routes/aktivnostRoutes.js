const express = require("express");
const kontroler = require("../controllers/aktivnostController");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");

const router = express.Router();

// PREGLED AKTIVNOSTI
router.get("/", kontroler.pregled);

// BROJ SLOBODNIH MESTA
router.get(
  "/:aktivnostId/mesta",
  zahtevajPrijavu,
  kontroler.mesta
);

// PROFESOR - KREIRANJE AKTIVNOSTI
router.post(
  "/",
  zahtevajPrijavu,
  zahtevajUlogu("profesor"),
  kontroler.kreiranje
);

// PROFESOR - UREDJIVANJE AKTIVNOSTI
router.patch(
  "/:aktivnostId",
  zahtevajPrijavu,
  zahtevajUlogu("profesor"),
  kontroler.uredivanje
);

// PROFESOR - DEAKTIVACIJA AKTIVNOSTI
router.patch(
  "/:aktivnostId/deaktiviraj",
  zahtevajPrijavu,
  zahtevajUlogu("profesor"),
  kontroler.deaktiviranje
);

// PROFESOR - PREGLED I AZURIRANJE PRIJAVA
router.get(
  "/:aktivnostId/prijave",
  zahtevajPrijavu,
  zahtevajUlogu("profesor"),
  kontroler.prijaveAktivnosti
);

router.patch(
  "/:aktivnostId/prijave/:prijavaId",
  zahtevajPrijavu,
  zahtevajUlogu("profesor"),
  kontroler.azurirajPrijavu
);

// UCENIK - PRIJAVA NA AKTIVNOST
router.post(
  "/:aktivnostId/prijava",
  zahtevajPrijavu,
  zahtevajUlogu("ucenik"),
  kontroler.prijava
);

// UCENIK - OTKAZIVANJE PRIJAVE
router.delete(
  "/:aktivnostId/prijava",
  zahtevajPrijavu,
  zahtevajUlogu("ucenik"),
  kontroler.otkazivanje
);

module.exports = router;
