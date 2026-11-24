const v = require("./zajednicko");

// GET /api/obavestenja?neprocitana=true&limit=50
function pregled(req) {
  const samoNeprocitana = v.daLi(req.query.neprocitana);
  let limit = 50;
  if (req.query.limit !== undefined) {
    limit = v.parsirajId(req.query.limit);
    if (!limit) throw v.greska(400, "limit mora biti pozitivan ceo broj.");
  }
  return { samoNeprocitana, limit: Math.min(limit, 200) };
}

function samoId(req) {
  return { id: v.idParam(req, "id", "Neispravan ID obaveštenja.") };
}

module.exports = { pregled, samoId };
