const servis = require("../services/mojePrijaveService");
const { greska } = require("../utils/http");
const { sortirajTermine } = require("../utils/vreme");

const STATUSI = ["prijavljen", "na_cekanju", "otkazano"];

async function pregled(req, res) {
  const { status } = req.query;
  if (status !== undefined && !STATUSI.includes(status)) {
    throw greska(400, "Status mora biti prijavljen, na_cekanju ili otkazano.");
  }
  return res.status(200).json({
    prijave: await servis.mojePrijave(req.korisnik.id, status ? [status] : null)
  });
}

async function raspored(req, res) {
  const prijave = await servis.mojePrijave(req.korisnik.id, ["prijavljen"]);
  const stavke = [];
  const bezTermina = [];

  for (const p of prijave) {
    if (!p.aktivnost || !p.aktivnost.aktivna) continue;

    if (!p.aktivnost.termini.length) {
      bezTermina.push({
        aktivnost_id: p.aktivnost.id,
        naziv: p.aktivnost.naziv,
        termin: p.aktivnost.termin,
        prostorija: p.aktivnost.prostorija
      });
      continue;
    }

    for (const t of p.aktivnost.termini) {
      stavke.push({
        ...t,
        aktivnost_id: p.aktivnost.id,
        naziv: p.aktivnost.naziv,
        prijava_id: p.id
      });
    }
  }

  return res.json({
    raspored: sortirajTermine(stavke),
    bez_strukturisanog_termina: bezTermina
  });
}

async function istorija(req, res) {
  const prijave = await servis.mojePrijave(req.korisnik.id, null);
  const prisustva = await servis.prisustvaZaPrijave(prijave);
  return res.json({
    istorija: prijave.map(p => {
      const moja = prisustva.filter(x => x.prijava_id === p.id);
      return {
        ...p,
        prisustva: moja,
        broj_prisustva: moja.filter(x => x.prisutan).length,
        broj_odsustva: moja.filter(x => !x.prisutan).length
      };
    })
  });
}

module.exports = { pregled, raspored, istorija };
