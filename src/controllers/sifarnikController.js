const servis = require("../services/sifarnikService");
const {
  greska,
  imaPolje,
  zahtevajId,
  jeNeprazanTekst,
  opcioniTekst
} = require("../utils/http");

function napraviSifarnikKontroler({ tabela, kljucListe, kljucJednog, naziv, koriscenje }) {
  function procitajTelo(body, delimicno) {
    const b = body || {};
    const unos = {};
    if (!delimicno || imaPolje(b, "naziv")) {
      if (!jeNeprazanTekst(b.naziv, 100)) {
        throw greska(400, "Naziv je obavezan (do 100 znakova).");
      }
      unos.naziv = b.naziv.trim();
    }
    if (imaPolje(b, "opis")) {
      const opis = opcioniTekst(b.opis, 2000);
      if (!opis.ok) throw greska(400, "Opis nije ispravan.");
      unos.opis = opis.vrednost;
    }
    if (!Object.keys(unos).length) throw greska(400, "Nema podataka za izmenu.");
    return unos;
  }

  return {
    async pregled(req, res) {
      return res.json({ [kljucListe]: await servis.lista(tabela) });
    },
    async detalji(req, res) {
      const id = zahtevajId(req.params.id);
      const data = await servis.jedan(tabela, id);
      if (!data) throw greska(404, `${naziv} nije pronađen(a).`);
      return res.json({ [kljucJednog]: data });
    },
    async kreiranje(req, res) {
      const unos = procitajTelo(req.body, false);
      const data = await servis.kreiraj(tabela, naziv, unos.naziv, unos);
      return res.status(201).json({ [kljucJednog]: data });
    },
    async uredivanje(req, res) {
      const id = zahtevajId(req.params.id);
      const unos = procitajTelo(req.body, true);
      const data = await servis.izmeni(tabela, naziv, id, unos);
      if (!data) throw greska(404, `${naziv} nije pronađen(a).`);
      return res.json({ [kljucJednog]: data });
    },
    async brisanje(req, res) {
      const id = zahtevajId(req.params.id);
      const data = await servis.obrisi(tabela, id, koriscenje);
      if (!data) throw greska(404, `${naziv} nije pronađen(a).`);
      return res.json({ poruka: `${naziv} je obrisan(a).` });
    }
  };
}

module.exports = napraviSifarnikKontroler;
