const servis = require("../services/prisustvoService");
const { proveriQrKod } = require("../services/qrService");
const {
  greska,
  imaPolje,
  zahtevajId,
  parsirajId,
  jeDatum,
  danasnjiDatum
} = require("../utils/http");

async function skeniraj(req, res) {
  let podaci;
  try {
    podaci = proveriQrKod(req.body?.kod);
  } catch (error) {
    throw greska(400, error.razlog || "QR kod nije ispravan.");
  }
  const aktivnost = await servis.aktivnostZaQr(podaci.aktivnostId);
  if (!aktivnost || !aktivnost.aktivna) throw greska(404, "Aktivnost nije dostupna.");

  const prijava = await servis.prijavaUcenika(req.korisnik.id, podaci.aktivnostId);
  if (!prijava) throw greska(403, "Niste prijavljeni na ovu aktivnost.");
  const { prisustvo, novo } = await servis.evidentiraj(prijava.id, podaci.datum, true);
  return res.status(novo ? 201 : 200).json({
    poruka: `Prisustvo na aktivnosti "${aktivnost.naziv}" je evidentirano.`,
    prisustvo
  });
}

async function pregled(req, res) {
  const aktivnostId = zahtevajId(req.query.aktivnost_id, "Parametar aktivnost_id je obavezan.");
  const { datum } = req.query;
  if (datum !== undefined && !jeDatum(datum)) {
    throw greska(400, "Datum mora biti u formatu YYYY-MM-DD.");
  }
  return res.json({
    prisustva: await servis.prisustvaZaAktivnost(aktivnostId, datum)
  });
}

async function kreiranje(req, res) {
  const b = req.body || {};
  const prijavaId = parsirajId(b.prijava_id);
  const datum = b.datum ?? danasnjiDatum();
  if (!prijavaId) throw greska(400, "prijava_id je obavezan.");
  if (!jeDatum(datum)) throw greska(400, "Datum mora biti u formatu YYYY-MM-DD.");
  if (imaPolje(b, "prisutan") && typeof b.prisutan !== "boolean") {
    throw greska(400, "Polje prisutan mora biti true ili false.");
  }
  await servis.potvrdiPrijavu(prijavaId);
  const { prisustvo, novo } = await servis.evidentiraj(
    prijavaId, datum, imaPolje(b, "prisutan") ? b.prisutan : true
  );
  return res.status(novo ? 201 : 200).json({ prisustvo });
}

async function uredivanje(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID prisustva.");
  const b = req.body || {};
  const unos = {};
  if (imaPolje(b, "prisutan")) {
    if (typeof b.prisutan !== "boolean") throw greska(400, "Polje prisutan mora biti true ili false.");
    unos.prisutan = b.prisutan;
  }
  if (imaPolje(b, "datum")) {
    if (!jeDatum(b.datum)) throw greska(400, "Datum mora biti u formatu YYYY-MM-DD.");
    unos.datum = b.datum;
  }
  if (!Object.keys(unos).length) throw greska(400, "Nema podataka za izmenu.");
  return res.json({ prisustvo: await servis.izmeni(id, unos) });
}

async function brisanje(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID prisustva.");
  await servis.obrisi(id);
  return res.json({ poruka: "Evidencija prisustva je obrisana." });
}

module.exports = { skeniraj, pregled, kreiranje, uredivanje, brisanje };
