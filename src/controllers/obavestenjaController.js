const { zahtevajId } = require("../utils/http");
const servis = require("../services/obavestenjaQueryService");

async function pregled(req, res) {
  const samoNeprocitana = ["true", "1"].includes(String(req.query.neprocitana));
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  return res.json(await servis.lista(req.korisnik.id, samoNeprocitana, limit));
}

async function procitajSve(req, res) {
  await servis.procitajSve(req.korisnik.id);
  return res.json({ poruka: "Sva obaveštenja su označena kao pročitana." });
}

async function procitajJedno(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID obaveštenja.");
  const data = await servis.procitajJedno(id, req.korisnik.id);
  return res.json({ obavestenje: data });
}

async function obrisi(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID obaveštenja.");
  await servis.obrisi(id, req.korisnik.id);
  return res.json({ poruka: "Obaveštenje je obrisano." });
}

module.exports = { pregled, procitajSve, procitajJedno, obrisi };
