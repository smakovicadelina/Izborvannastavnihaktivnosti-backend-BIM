const v = require("./zajednicko");

// GET /api/moje-prijave?status=
function pregled(req) {
  return { status: v.opcioniStatusPrijave(req.query.status) };
}

module.exports = { pregled };
