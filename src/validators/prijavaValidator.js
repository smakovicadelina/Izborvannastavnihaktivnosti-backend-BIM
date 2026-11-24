const v = require("./zajednicko");
const { aktivnostId } = require("./aktivnostValidator");

const PORUKA_STATUSA = "Status prijave mora biti prijavljen, na_cekanju ili otkazano.";

const prijavaId = req => v.idParam(req, "prijavaId", "Neispravan ID prijave.");

// POST/DELETE /api/aktivnosti/:aktivnostId/prijava (ucenik)
function ucenikovaPrijava(req) {
  return { aktivnostId: aktivnostId(req) };
}

// GET /api/aktivnosti/:aktivnostId/prijave?status=
function pregled(req) {
  return {
    aktivnostId: aktivnostId(req),
    status: v.opcioniStatusPrijave(req.query.status, PORUKA_STATUSA)
  };
}

// POST /api/aktivnosti/:aktivnostId/prijave  { ucenik_id }
function upis(req) {
  const id = aktivnostId(req);
  const ucenikId = v.telo(req).ucenik_id;
  if (!v.jeUuid(ucenikId)) throw v.greska(400, "ucenik_id mora biti UUID učenika.");
  return { aktivnostId: id, ucenikId };
}

// PATCH /api/aktivnosti/:aktivnostId/prijave/:prijavaId  { status_prijave }
function promenaStatusa(req) {
  const id = aktivnostId(req);
  const pId = prijavaId(req);
  const status = v.telo(req).status_prijave;
  if (!v.STATUSI_PRIJAVE.includes(status)) throw v.greska(400, PORUKA_STATUSA);
  return { aktivnostId: id, prijavaId: pId, status };
}

// DELETE /api/aktivnosti/:aktivnostId/prijave/:prijavaId
function brisanje(req) {
  return { aktivnostId: aktivnostId(req), prijavaId: prijavaId(req) };
}

module.exports = { ucenikovaPrijava, pregled, upis, promenaStatusa, brisanje };
