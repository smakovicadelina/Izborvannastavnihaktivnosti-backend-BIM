const aktivnosti = require("../services/aktivnostService").api;
const terminiService = require("../services/terminService").api;
const obavestenja = require("../services/obavestenjaService").api;
const { greska, imaPolje, zahtevajId, parsirajId } = require("../utils/http");
const {
  ispravnoVreme,
  sekundeOdPonoci,
  nazivDana,
  opisTermina,
  sortirajTermine
} = require("../utils/vreme");

function validanTermin(t) {
  return Number.isInteger(t.dan_u_nedelji) &&
    t.dan_u_nedelji >= 1 && t.dan_u_nedelji <= 7 &&
    ispravnoVreme(t.vreme_od) && ispravnoVreme(t.vreme_do) &&
    sekundeOdPonoci(t.vreme_od) < sekundeOdPonoci(t.vreme_do) &&
    Number.isSafeInteger(t.prostorija_id) && t.prostorija_id > 0;
}

async function terminSaProstorijom(id) {
  return terminiService.terminPoId(id);
}

async function pregled(req, res) {
  const filteri = {};
  if (req.query.prostorija_id !== undefined) {
    filteri.prostorijaId = zahtevajId(req.query.prostorija_id, "Neispravan ID prostorije.");
  }
  if (req.query.dan !== undefined) {
    const dan = parsirajId(req.query.dan);
    if (!dan || dan > 7) throw greska(400, "Dan mora biti broj od 1 do 7.");
    filteri.dan = dan;
  }

  const { termini, prostorije } = await terminiService.listaTermina(filteri);
  const poId = new Map(prostorije.map(p => [p.id, p]));
  return res.status(200).json({
    termini: termini.map(t => ({
      ...t,
      dan: nazivDana(t.dan_u_nedelji),
      prostorija: poId.get(t.prostorija_id) || null
    }))
  });
}

async function detalji(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID termina.");
  const termin = await terminSaProstorijom(id);
  if (!termin) throw greska(404, "Termin nije pronađen.");
  const povezaneAktivnosti = await terminiService.aktivnostiTermina([id]);
  return res.json({
    termin: { ...termin, dan: nazivDana(termin.dan_u_nedelji), aktivnosti: povezaneAktivnosti }
  });
}

async function kreiranje(req, res) {
  const { dan_u_nedelji, vreme_od, vreme_do, prostorija_id } = req.body || {};
  const novi = { dan_u_nedelji, vreme_od, vreme_do, prostorija_id };
  if (!validanTermin(novi)) throw greska(400, "Neispravni podaci o terminu.");
  const data = await terminiService.kreirajTermin(novi);
  return res.status(201).json({ poruka: "Termin je uspešno kreiran.", termin: data });
}

async function uredivanje(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID termina.");
  const unos = {};
  for (const polje of ["dan_u_nedelji", "vreme_od", "vreme_do", "prostorija_id"]) {
    if (imaPolje(req.body, polje)) unos[polje] = req.body[polje];
  }
  if (!Object.keys(unos).length) throw greska(400, "Nema podataka za izmenu.");

  const postojeci = await terminSaProstorijom(id);
  if (!postojeci) throw greska(404, "Termin nije pronađen.");
  const novi = { ...postojeci, ...unos };
  if (!validanTermin(novi)) throw greska(400, "Neispravni podaci za izmenu.");

  const povezaneAktivnosti = await terminiService.aktivnostiTermina([id]);
  if (unos.prostorija_id && unos.prostorija_id !== postojeci.prostorija_id) {
    const prostorija = await terminiService.zahtevajProstoriju(unos.prostorija_id);
    const prevelika = povezaneAktivnosti.find(a => a.aktivna && a.maksimalno_mesta > prostorija.kapacitet);
    if (prevelika) {
      throw greska(
        409,
        `Prostorija ${prostorija.naziv} (kapacitet ${prostorija.kapacitet}) je premala za aktivnost "${prevelika.naziv}" (${prevelika.maksimalno_mesta} mesta).`
      );
    }
  }
  await terminiService.proveriDostupnostProstorije(novi, id);

  const data = await terminiService.azurirajTermin(id, unos);

  for (const a of povezaneAktivnosti) {
    const puna = await aktivnosti.zahtevajAktivnost(a.id);
    const termini = sortirajTermine(await aktivnosti.terminiAktivnosti(puna));
    if (!termini.length) continue;
    await aktivnosti.osveziTekstTermina(a.id, termini);
  }

  for (const a of povezaneAktivnosti.filter(x => x.aktivna)) {
    await obavestenja.obavestiUcenikeAktivnosti(a.id, {
      tip: "promena_termina",
      naslov: "Promena termina",
      poruka: `Termin aktivnosti "${a.naziv}" je promenjen: ${opisTermina(data)}.`
    });
  }
  return res.status(200).json({ poruka: "Termin je izmenjen.", termin: data });
}

async function brisanje(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID termina.");
  const povezaneAktivnosti = await terminiService.aktivnostiTermina([id]);
  if (povezaneAktivnosti.length) {
    throw greska(409, `Termin je povezan sa aktivnošću "${povezaneAktivnosti[0].naziv}".`);
  }
  const data = await terminiService.obrisiTermin(id);
  if (!data) throw greska(404, "Termin nije pronađen.");
  return res.status(200).json({ poruka: "Termin je obrisan." });
}

module.exports = { pregled, detalji, kreiranje, uredivanje, brisanje };
