// Glavni ruter: povezuje sve grupe ruta sa njihovim prefiksom.
// U app.js se montira pod /api, pa npr. "/aktivnosti" postaje "/api/aktivnosti".

const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => {
  return res.status(200).json({ status: "ok", poruka: "Backend server radi!" });
});

router.use("/auth", require("./authRoutes"));
router.use("/aktivnosti", require("./aktivnostRoutes"));
router.use("/moje-prijave", require("./mojePrijaveRoutes"));
router.use("/prostorije", require("./prostorijaRoutes"));
router.use("/termini", require("./terminRoutes"));
router.use("/kategorije", require("./kategorijaRoutes"));
router.use("/interesovanja", require("./interesovanjeRoutes"));
router.use("/profil", require("./profilRoutes"));
router.use("/obavestenja", require("./obavestenjaRoutes"));
router.use("/prisustva", require("./prisustvoRoutes"));
router.use("/ai", require("./aiRoutes"));
router.use("/admin", require("./adminRoutes"));

module.exports = router;
