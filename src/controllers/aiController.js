const aiPreporuke = require("../services/aiPreporukaService");
const { generisiPreporuke } = require("../services/aiService");
const { greska, zahtevajId } = require("../utils/http");

async function kreiraj(req, res) {
  const tekst = typeof req.body?.tekst === "string" ? req.body.tekst.trim() : "";
  const izvor = req.body?.izvor === undefined ? "tekst" : req.body.izvor;
  if (tekst.length < 3 || tekst.length > 2000) {
    throw greska(400, "Opišite svoja interesovanja, sposobnosti i ciljeve (3–2000 znakova).");
  }
  if (!["tekst", "glas"].includes(izvor)) {
    throw greska(400, "Izvor mora biti tekst ili glas.");
  }

  const { aktivnosti: kandidati, mojaInteresovanja, mojRaspored } =
    await aiPreporuke.kontekstKorisnika(req.korisnik.id);
  const rezultat = await generisiPreporuke({
    tekst, aktivnosti: kandidati, mojaInteresovanja, mojRaspored
  });
  const red = await aiPreporuke.sacuvaj(req.korisnik.id, tekst, {
    uvod: rezultat.uvod,
    preporuke: rezultat.preporuke,
    model: rezultat.model,
    izvor
  });
  return res.status(201).json({ preporuka: await aiPreporuke.prikazi(red) });
}

async function pregled(req, res) {
  const data = await aiPreporuke.istorija(req.korisnik.id);
  return res.json({
    preporuke: data.map(red => {
      const odgovor = aiPreporuke.procitajOdgovor(red);
      return {
        id: red.id,
        pitanje: red.pitanje,
        kreirano_at: red.kreirano_at,
        uvod: odgovor.uvod || "",
        broj_preporuka: (odgovor.preporuke || []).length
      };
    })
  });
}

async function detalji(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID preporuke.");
  const red = await aiPreporuke.moja(id, req.korisnik.id);
  return res.json({ preporuka: await aiPreporuke.prikazi(red) });
}

async function obrisi(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID preporuke.");
  await aiPreporuke.obrisi(id, req.korisnik.id);
  return res.json({ poruka: "Preporuka je obrisana." });
}

module.exports = { kreiraj, pregled, detalji, obrisi };
