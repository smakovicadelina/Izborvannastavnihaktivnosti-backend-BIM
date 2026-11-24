const v = require("./zajednicko");

// POST /api/ai/preporuke  { tekst, izvor?: "tekst" | "glas" }
function kreiranje(req) {
  const b = v.telo(req);
  const tekst = typeof b.tekst === "string" ? b.tekst.trim() : "";
  const izvor = b.izvor === undefined ? "tekst" : b.izvor;
  if (tekst.length < 3 || tekst.length > 2000) {
    throw v.greska(400, "Opišite svoja interesovanja, sposobnosti i ciljeve (3–2000 znakova).");
  }
  if (!["tekst", "glas"].includes(izvor)) {
    throw v.greska(400, "Izvor mora biti tekst ili glas.");
  }
  return { tekst, izvor };
}

function samoId(req) {
  return { id: v.idParam(req, "id", "Neispravan ID preporuke.") };
}

module.exports = { kreiranje, samoId };
