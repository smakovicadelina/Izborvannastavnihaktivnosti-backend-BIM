
const express = require("express");

const kontroler = require("../controllers/aktivnostController");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");

const router = express.Router();

// PREGLED SVIH AKTIVNOSTI
router.get("/", kontroler.pregled);

// SLOBODNA MESTA
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

// PROFESOR - UREDJIVANJE
router.patch(
  "/:aktivnostId",
  zahtevajPrijavu,
  zahtevajUlogu("profesor"),
  kontroler.uredivanje
);

// PROFESOR - DEAKTIVACIJA
router.patch(
  "/:aktivnostId/deaktiviraj",
  zahtevajPrijavu,
  zahtevajUlogu("profesor"),
  kontroler.deaktiviranje
);

// PROFESOR - PREGLED PRIJAVA
router.get(
  "/:aktivnostId/prijave",
  zahtevajPrijavu,
  zahtevajUlogu("profesor"),
  kontroler.prijaveAktivnosti
);

// PROFESOR - PROMENA STATUSA PRIJAVE
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
