const v = require("./zajednicko");
const { jeDatum, danasnjiDatum } = require("../utils/http");

const id = req => v.idParam(req, "id", "Neispravan ID prisustva.");

function prisutan(b) {
  if (!v.imaPolje(b, "prisutan")) return undefined;
  if (typeof b.prisutan !== "boolean") {
    throw v.greska(400, "Polje prisutan mora biti true ili false.");
  }
  return b.prisutan;
}

// POST /api/prisustva/skeniraj  { kod } - ucenik skenira QR kod
function skeniranje(req) {
  const kod = v.telo(req).kod;
  if (typeof kod !== "string" || !kod.trim() || kod.length > 1000) {
    throw v.greska(400, "QR kod nije ispravan.");
  }
  return { kod };
}

// GET /api/prisustva?aktivnost_id=&datum=
function pregled(req) {
  const aktivnostId = v.parsirajId(req.query.aktivnost_id);
  if (!aktivnostId) throw v.greska(400, "Parametar aktivnost_id je obavezan.");
  const { datum } = req.query;
  if (datum !== undefined && !jeDatum(datum)) {
    throw v.greska(400, "Datum mora biti u formatu YYYY-MM-DD.");
  }
  return { aktivnostId, datum };
}

// POST /api/prisustva  { prijava_id, datum?, prisutan? } - profesor rucno evidentira
function kreiranje(req) {
  const b = v.telo(req);
  const prijavaId = v.parsirajId(b.prijava_id);
  if (!prijavaId) throw v.greska(400, "prijava_id je obavezan.");
  const datum = v.datum(b.datum ?? danasnjiDatum());
  const p = prisutan(b);
  return { prijavaId, datum, prisutan: p === undefined ? true : p };
}

// PATCH /api/prisustva/:id  { prisutan?, datum? }
function uredivanje(req) {
  const b = v.telo(req);
  const unos = {};
  const p = prisutan(b);
  if (p !== undefined) unos.prisutan = p;
  if (v.imaPolje(b, "datum")) unos.datum = v.datum(b.datum);
  v.zahtevajIzmene(unos);
  return { id: id(req), unos };
}

function samoId(req) {
  return { id: id(req) };
}

module.exports = { skeniranje, pregled, kreiranje, uredivanje, samoId };
