
const aktivnosti = require("../services/aktivnostService");
const obavestenja = require("../services/obavestenjaService").api;
const { napraviQrKod } = require("../services/qrService");
const {
  greska,
  zahtevajId,
  parsirajId,
  jeUuid,
  jeDatum,
  danasnjiDatum,
  nizId
} = require("../utils/http");

const STATUSI_PRIJAVE = ["prijavljen", "na_cekanju", "otkazano"];

const jeProfesor = req => req.profil?.uloga === "profesor";
const jeUcenik = req => req.profil?.uloga === "ucenik";
const daLi = vrednost => ["true", "1", "da"].includes(String(vrednost).toLowerCase());

function idAktivnosti(req) {
  return zahtevajId(req.params.aktivnostId, "Neispravan ID aktivnosti.");
}

// PREGLED, PRETRAGA I FILTRIRANJE AKTIVNOSTI
async function pregled(req, res) {
  const { q, kategorija_id, interesovanje_id, dan } = req.query;
  const filteri = {
    ukljuciNeaktivne: jeProfesor(req) && daLi(req.query.ukljuci_neaktivne),
    samoSlobodna: daLi(req.query.samo_slobodna),
    ucenikId: jeUcenik(req) ? req.korisnik.id : null
  };

  if (q !== undefined) {
    if (typeof q !== "string" || q.length > 100) {
      throw greska(400, "Pojam za pretragu nije ispravan.");
    }
    filteri.q = q.trim();
  }

  if (kategorija_id !== undefined) {
    filteri.kategorijaId = zahtevajId(kategorija_id, "Neispravan ID kategorije.");
  }

  if (dan !== undefined) {
    const d = parsirajId(dan);
    if (!d || d > 7) throw greska(400, "Dan mora biti broj od 1 do 7.");
    filteri.dan = d;
  }

  if (interesovanje_id !== undefined) {
    const ids = nizId(String(interesovanje_id).split(","));
    if (!ids || !ids.length) throw greska(400, "Neispravan ID interesovanja.");
    filteri.interesovanjaIds = ids;
  }

  if (daLi(req.query.moja_interesovanja)) {
    if (!req.korisnik) {
      throw greska(401, "Za filtriranje po vašim interesovanjima morate biti prijavljeni.");
    }
    const idsInteresovanja = await aktivnosti.api.interesovanjaIdsKorisnika(req.korisnik.id);
    filteri.interesovanjaIds = [
      ...new Set([
        ...(filteri.interesovanjaIds || []),
        ...idsInteresovanja
      ])
    ];
    if (!filteri.interesovanjaIds.length) return res.json([]);
  }

  if (filteri.interesovanjaIds?.length) {
    filteri.interesovanjaNazivi = await aktivnosti.api.naziviInteresovanja(
      filteri.interesovanjaIds
    );
  }

  const data = await aktivnosti.api.pregledAktivnosti(filteri);
  return res.json(data);
}

// DETALJI AKTIVNOSTI (profesori, termini, prostorije, kapacitet, slobodna mesta)
async function detalji(req, res) {
  const aktivnostId = idAktivnosti(req);
  const data = await aktivnosti.api.aktivnostPoId(aktivnostId, {
    ucenikId: jeUcenik(req) ? req.korisnik.id : null
  });

  if (!data || (data.aktivna === false && !jeProfesor(req))) {
    throw greska(404, "Aktivnost nije pronađena.");
  }

  return res.json({ aktivnost: data });
}

// PROFESOR KREIRA AKTIVNOST
async function kreiranje(req, res) {
  const data = await aktivnosti.api.kreirajAktivnost(
    req.korisnik.id,
    req.body
  );
  return res.status(201).json(data);
}

// PROFESOR UREDJUJE AKTIVNOST
async function uredivanje(req, res) {
  const aktivnostId = idAktivnosti(req);
  const { aktivnost, promenjenRaspored } = await aktivnosti.api.urediAktivnost(
    aktivnostId,
    req.body
  );

  if (promenjenRaspored) {
    await obavestenja.obavestiUcenikeAktivnosti(aktivnostId, {
      tip: "promena_termina",
      naslov: "Promena termina",
      poruka: `Aktivnost "${aktivnost.naziv}" ima novi termin: ${aktivnost.termin}${aktivnost.prostorija ? `, prostorija: ${aktivnost.prostorija}` : ""}.`
    });
  }

  const detaljno = await aktivnosti.api.aktivnostPoId(aktivnostId);
  return res.json(detaljno);
}

// PROFESOR DEAKTIVIRA AKTIVNOST
async function deaktiviranje(req, res) {
  const aktivnostId = idAktivnosti(req);
  const data = await aktivnosti.api.postaviAktivnost(aktivnostId, false);

  await obavestenja.obavestiUcenikeAktivnosti(aktivnostId, {
    tip: "aktivnost_deaktivirana",
    naslov: "Aktivnost je obustavljena",
    poruka: `Aktivnost "${data.naziv}" je trenutno obustavljena.`
  });

  return res.json({ poruka: "Aktivnost je deaktivirana.", aktivnost: data });
}

// PROFESOR PONOVO AKTIVIRA AKTIVNOST
async function aktiviranje(req, res) {
  const aktivnostId = idAktivnosti(req);
  const data = await aktivnosti.api.postaviAktivnost(aktivnostId, true);

  await obavestenja.obavestiUcenikeAktivnosti(aktivnostId, {
    tip: "aktivnost_aktivirana",
    naslov: "Aktivnost je ponovo aktivna",
    poruka: `Aktivnost "${data.naziv}" je ponovo aktivna.`
  });

  return res.json({ poruka: "Aktivnost je aktivirana.", aktivnost: data });
}

// PROFESOR BRISE AKTIVNOST (samo ako nema prijava)
async function brisanje(req, res) {
  const aktivnostId = idAktivnosti(req);
  await aktivnosti.api.obrisiAktivnost(aktivnostId);
  return res.json({ poruka: "Aktivnost je obrisana." });
}

// PROFESOR PREGLEDA PRIJAVE
async function prijaveAktivnosti(req, res) {
  const aktivnostId = idAktivnosti(req);
  const { status } = req.query;

  if (status !== undefined && !STATUSI_PRIJAVE.includes(status)) {
    throw greska(400, "Status prijave mora biti prijavljen, na_cekanju ili otkazano.");
  }

  const data = await aktivnosti.api.prijaveAktivnosti(aktivnostId, { status });
  return res.json(data);
}

// PROFESOR UPISUJE UCENIKA NA AKTIVNOST
async function upisUcenika(req, res) {
  const aktivnostId = idAktivnosti(req);
  const ucenikId = req.body?.ucenik_id;

  if (!jeUuid(ucenikId)) {
    throw greska(400, "ucenik_id mora biti UUID učenika.");
  }

  const aktivnost = await aktivnosti.api.aktivnostPoId(aktivnostId);
  if (!aktivnost || !aktivnost.aktivna) {
    throw greska(404, "Aktivnost nije dostupna.");
  }

  const ucenik = await aktivnosti.api.ucenikPoId(ucenikId);
  if (!ucenik || ucenik.uloga !== "ucenik") {
    throw greska(404, "Učenik nije pronađen.");
  }

  await aktivnosti.api.proveriPreklapanjeZaUcenika(ucenikId, aktivnost);
  const prijava = await aktivnosti.api.prijaviUcenika(ucenikId, aktivnostId);

  await obavestenja.obavesti([ucenikId], {
    tip: "prijava",
    naslov: "Upisani ste na aktivnost",
    poruka: `Profesor vas je upisao na aktivnost "${aktivnost.naziv}".`,
    aktivnost_id: aktivnostId
  });

  return res.status(201).json({ poruka: "Učenik je upisan.", prijava });
}

// PROFESOR AZURIRA STATUS PRIJAVE
async function azurirajPrijavu(req, res) {
  const aktivnostId = idAktivnosti(req);
  const prijavaId = zahtevajId(req.params.prijavaId, "Neispravan ID prijave.");
  const statusPrijave = req.body?.status_prijave;

  if (!STATUSI_PRIJAVE.includes(statusPrijave)) {
    throw greska(400, "Status prijave mora biti prijavljen, na_cekanju ili otkazano.");
  }

  const { prijava, prethodniStatus, aktivnost } = await aktivnosti.api.azurirajPrijavu(
    aktivnostId,
    prijavaId,
    statusPrijave
  );

  if (prethodniStatus !== statusPrijave) {
    const opisi = {
      prijavljen: "potvrđena",
      na_cekanju: "stavljena na čekanje",
      otkazano: "otkazana"
    };
    await obavestenja.obavesti([prijava.ucenik_id], {
      tip: "status_prijave",
      naslov: "Promena statusa prijave",
      poruka: `Vaša prijava na aktivnost "${aktivnost.naziv}" je ${opisi[statusPrijave]}.`,
      aktivnost_id: aktivnostId
    });
  }

  return res.json({
    poruka: "Status prijave je ažuriran.",
    prijava
  });
}

// PROFESOR BRISE PRIJAVU
async function brisanjePrijave(req, res) {
  const aktivnostId = idAktivnosti(req);
  const prijavaId = zahtevajId(req.params.prijavaId, "Neispravan ID prijave.");
  await aktivnosti.api.obrisiPrijavu(aktivnostId, prijavaId);
  return res.json({ poruka: "Prijava je obrisana." });
}

// UCENIK SE PRIJAVLJUJE NA AKTIVNOST
async function prijava(req, res) {
  const aktivnostId = idAktivnosti(req);

  const aktivnost = await aktivnosti.api.aktivnostPoId(aktivnostId);

  if (!aktivnost || aktivnost.aktivna === false) {
    throw greska(404, "Aktivnost nije dostupna.");
  }

  await aktivnosti.api.proveriPreklapanjeZaUcenika(
    req.korisnik.id,
    aktivnost
  );

  const prijava = await aktivnosti.api.prijaviUcenika(
    req.korisnik.id,
    aktivnostId
  );

  await obavestenja.obavesti([req.korisnik.id], {
    tip: "prijava",
    naslov: "Prijava je uspešna",
    poruka: `Prijavili ste se na aktivnost "${aktivnost.naziv}".`,
    aktivnost_id: aktivnostId
  });

  return res.status(201).json({
    poruka: "Uspešno ste se prijavili.",
    prijava
  });
}

// UCENIK OTKAZUJE PRIJAVU
async function otkazivanje(req, res) {
  const aktivnostId = idAktivnosti(req);

  const data = await aktivnosti.api.otkaziPrijavu(
    req.korisnik.id,
    aktivnostId
  );

  if (!data) {
    throw greska(404, "Aktivna prijava nije pronađena.");
  }

  const { data: aktivnost } = await aktivnosti.api.nazivAktivnosti(aktivnostId);

  await obavestenja.obavesti([req.korisnik.id], {
    tip: "otkazivanje",
    naslov: "Prijava je otkazana",
    poruka: `Otkazali ste prijavu na aktivnost "${aktivnost?.naziv || aktivnostId}".`,
    aktivnost_id: aktivnostId
  });

  return res.json({
    poruka: "Prijava je uspešno otkazana."
  });
}

// PROFESOR GENERISE QR KOD ZA EVIDENCIJU PRISUSTVA
async function qrKod(req, res) {
  const aktivnostId = idAktivnosti(req);
  const datum = req.query.datum ?? danasnjiDatum();
  const trajanje = req.query.trajanje_min === undefined
    ? 120
    : parsirajId(req.query.trajanje_min);

  if (!jeDatum(datum)) {
    throw greska(400, "Datum mora biti u formatu YYYY-MM-DD.");
  }

  if (!trajanje || trajanje > 1440) {
    throw greska(400, "trajanje_min mora biti između 1 i 1440 minuta.");
  }

  const aktivnost = await aktivnosti.api.zahtevajAktivnost(aktivnostId);
  if (!aktivnost.aktivna) {
    throw greska(409, "Aktivnost nije aktivna.");
  }

  const { kod, vazi_do } = napraviQrKod({
    aktivnostId,
    datum,
    trajanjeMinuta: trajanje
  });

  return res.json({
    aktivnost_id: aktivnostId,
    naziv: aktivnost.naziv,
    datum,
    vazi_do,
    kod
  });
}

module.exports = {
  pregled,
  detalji,
  mesta: detalji,
  kreiranje,
  uredivanje,
  deaktiviranje,
  aktiviranje,
  brisanje,
  prijaveAktivnosti,
  upisUcenika,
  azurirajPrijavu,
  brisanjePrijave,
  prijava,
  otkazivanje,
  qrKod
};
