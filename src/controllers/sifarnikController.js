// Generican kontroler za sifarnike (kategorije, interesovanja).
// kljucListe/kljucJednog odredjuju naziv polja u JSON odgovoru,
// npr. { "kategorije": [...] } ili { "kategorija": {...} }.

function napraviSifarnikKontroler(servis, { kljucListe, kljucJednog, naziv }) {
  return {
    async pregled(req, res) {
      return res.status(200).json({ [kljucListe]: await servis.lista() });
    },
    async detalji(req, res) {
      return res.status(200).json({ [kljucJednog]: await servis.jedan(req.podaci.id) });
    },
    async kreiranje(req, res) {
      return res.status(201).json({ [kljucJednog]: await servis.kreiraj(req.podaci.unos) });
    },
    async uredivanje(req, res) {
      const { id, unos } = req.podaci;
      return res.status(200).json({ [kljucJednog]: await servis.izmeni(id, unos) });
    },
    async brisanje(req, res) {
      await servis.obrisi(req.podaci.id);
      return res.status(200).json({ poruka: `${naziv} je obrisan(a).` });
    }
  };
}

module.exports = napraviSifarnikKontroler;
