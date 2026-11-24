// Validacija za jednostavne sifarnike (kategorije, interesovanja): { naziv, opis }.
const v = require("./zajednicko");

const id = req => v.idParam(req, "id", "Neispravan ID.");

function teloSifarnika(b, delimicno) {
  const unos = {};
  if (!delimicno || v.imaPolje(b, "naziv")) {
    if (!v.jeNeprazanTekst(b.naziv, 100)) {
      throw v.greska(400, "Naziv je obavezan (do 100 znakova).");
    }
    unos.naziv = b.naziv.trim();
  }
  if (v.imaPolje(b, "opis")) {
    const opis = v.opcioniTekst(b.opis, 2000);
    if (!opis.ok) throw v.greska(400, "Opis nije ispravan.");
    unos.opis = opis.vrednost;
  }
  v.zahtevajIzmene(unos);
  return unos;
}

function samoId(req) {
  return { id: id(req) };
}

function kreiranje(req) {
  return { unos: teloSifarnika(v.telo(req), false) };
}

function uredivanje(req) {
  return { id: id(req), unos: teloSifarnika(v.telo(req), true) };
}

module.exports = { samoId, kreiranje, uredivanje };
