const v = require("./zajednicko");
const { jeDatum, danasnjiDatum } = require("../utils/http");

const aktivnostId = req => v.idParam(req, "aktivnostId", "Neispravan ID aktivnosti.");

// GET /api/aktivnosti?q=&kategorija_id=&interesovanje_id=&dan=&samo_slobodna=&moja_interesovanja=&ukljuci_neaktivne=
function pregled(req) {
  const { q, kategorija_id, interesovanje_id, dan } = req.query;
  const filteri = {
    samoSlobodna: v.daLi(req.query.samo_slobodna),
    ukljuciNeaktivne: v.daLi(req.query.ukljuci_neaktivne),
    mojaInteresovanja: v.daLi(req.query.moja_interesovanja)
  };

  if (q !== undefined) {
    if (typeof q !== "string" || q.length > 100) {
      throw v.greska(400, "Pojam za pretragu nije ispravan.");
    }
    filteri.q = q.trim();
  }
  if (kategorija_id !== undefined) {
    filteri.kategorijaId = v.parsirajId(kategorija_id);
    if (!filteri.kategorijaId) throw v.greska(400, "Neispravan ID kategorije.");
  }
  if (dan !== undefined) {
    const d = v.parsirajId(dan);
    if (!d || d > 7) throw v.greska(400, "Dan mora biti broj od 1 do 7.");
    filteri.dan = d;
  }
  if (interesovanje_id !== undefined) {
    const ids = v.nizId(String(interesovanje_id).split(","));
    if (!ids || !ids.length) throw v.greska(400, "Neispravan ID interesovanja.");
    filteri.interesovanjaIds = ids;
  }
  // Filter "moja interesovanja" ima smisla samo za prijavljenog korisnika.
  if (filteri.mojaInteresovanja && !req.korisnik) {
    throw v.greska(401, "Za filtriranje po vašim interesovanjima morate biti prijavljeni.");
  }
  return filteri;
}

// Telo zahteva za kreiranje (delimicno=false) ili izmenu (delimicno=true) aktivnosti.
// Vraca { unos, veze }: "unos" su kolone tabele aktivnosti, a "veze" ID-jevi
// za povezne tabele (aktivnost_termini, aktivnost_profesori, aktivnost_interesovanja).
function teloAktivnosti(b, delimicno) {
  const unos = {};
  const veze = {};
  const neispravno = poruka => v.greska(400, poruka);

  if (!delimicno || v.imaPolje(b, "naziv")) {
    if (!v.jeNeprazanTekst(b.naziv, 200)) {
      throw neispravno("Naziv aktivnosti je obavezan (do 200 znakova).");
    }
    unos.naziv = b.naziv.trim();
  }

  if (v.imaPolje(b, "opis")) {
    const opis = v.opcioniTekst(b.opis, 5000);
    if (!opis.ok) throw neispravno("Opis nije ispravan.");
    unos.opis = opis.vrednost;
  } else if (!delimicno) {
    unos.opis = null;
  }

  if (!delimicno || v.imaPolje(b, "maksimalno_mesta")) {
    if (
      !Number.isInteger(b.maksimalno_mesta) ||
      b.maksimalno_mesta < 1 ||
      b.maksimalno_mesta > 10000
    ) {
      throw neispravno("Maksimalan broj mesta mora biti ceo broj veći od 0.");
    }
    unos.maksimalno_mesta = b.maksimalno_mesta;
  }

  if (v.imaPolje(b, "termin")) {
    if (b.termin !== null && !v.jeNeprazanTekst(b.termin, 200)) {
      throw neispravno("Termin nije ispravan.");
    }
    if (b.termin !== null) unos.termin = b.termin.trim();
  }

  if (v.imaPolje(b, "prostorija")) {
    const prostorija = v.opcioniTekst(b.prostorija, 200);
    if (!prostorija.ok) throw neispravno("Prostorija nije ispravna.");
    unos.prostorija = prostorija.vrednost;
  }

  if (v.imaPolje(b, "kategorija_id")) {
    if (b.kategorija_id === null) {
      unos.kategorija_id = null;
    } else {
      const id = v.parsirajId(b.kategorija_id);
      if (!id) throw neispravno("ID kategorije nije ispravan.");
      unos.kategorija_id = id;
    }
  }

  if (v.imaPolje(b, "slika_url")) {
    const slika = v.opcioniTekst(b.slika_url, 2000);
    if (!slika.ok || (slika.vrednost && !/^https?:\/\//i.test(slika.vrednost))) {
      throw neispravno("URL slike mora počinjati sa http:// ili https://.");
    }
    unos.slika_url = slika.vrednost;
  }

  if (v.imaPolje(b, "termini_ids")) {
    veze.terminiIds = v.nizIdIliGreska(b.termini_ids, "termini_ids mora biti niz ID-jeva termina.");
  }

  if (v.imaPolje(b, "profesori_ids")) {
    if (!Array.isArray(b.profesori_ids) || !b.profesori_ids.every(v.jeUuid)) {
      throw neispravno("profesori_ids mora biti niz UUID vrednosti.");
    }
    veze.profesoriIds = [...new Set(b.profesori_ids)];
  }

  if (v.imaPolje(b, "interesovanja_ids")) {
    veze.interesovanjaIds = v.nizIdIliGreska(
      b.interesovanja_ids,
      "interesovanja_ids mora biti niz ID-jeva interesovanja."
    );
  }

  return { unos, veze };
}

// POST /api/aktivnosti
function kreiranje(req) {
  return teloAktivnosti(v.telo(req), false);
}

// PATCH /api/aktivnosti/:aktivnostId
function uredivanje(req) {
  const id = aktivnostId(req);
  const { unos, veze } = teloAktivnosti(v.telo(req), true);
  if (!Object.keys(unos).length && !Object.keys(veze).length) {
    throw v.greska(400, "Nema polja za ažuriranje.");
  }
  return { aktivnostId: id, unos, veze };
}

// Rute koje imaju samo :aktivnostId (detalji, brisanje, aktiviranje...)
function samoId(req) {
  return { aktivnostId: aktivnostId(req) };
}

// GET /api/aktivnosti/:aktivnostId/qr?datum=&trajanje_min=
function qrKod(req) {
  const datum = req.query.datum ?? danasnjiDatum();
  const trajanjeMin = req.query.trajanje_min === undefined
    ? 120
    : v.parsirajId(req.query.trajanje_min);

  if (!jeDatum(datum)) throw v.greska(400, "Datum mora biti u formatu YYYY-MM-DD.");
  if (!trajanjeMin || trajanjeMin > 1440) {
    throw v.greska(400, "trajanje_min mora biti između 1 i 1440 minuta.");
  }
  return { aktivnostId: aktivnostId(req), datum, trajanjeMin };
}

module.exports = {
  pregled,
  kreiranje,
  uredivanje,
  samoId,
  qrKod,
  aktivnostId
};
