const adminService = require("../services/adminService");
const {
  greska,
  imaPolje,
  jeUuid,
  jeNeprazanTekst,
  opcioniTekst,
  nizId,
  zahtevajId
} = require("../utils/http");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function zahtevajUcenika(req) {
  const id = req.params.id;
  if (!jeUuid(id)) throw greska(400, "Neispravan ID učenika.");
  const ucenik = await adminService.zahtevajUcenika(id);
  if (!ucenik || ucenik.uloga !== "ucenik") throw greska(404, "Učenik nije pronađen.");
  return ucenik;
}

async function pregledUcenika(req, res) {
  const ucenici = await adminService.listaUcenika(req.query);
  return res.json({ ucenici });
}

async function detaljiUcenika(req, res) {
  const ucenik = await zahtevajUcenika(req);
  const detalji = await adminService.detaljiUcenika(ucenik.id);
  return res.json({
    ucenik: {
      ...ucenik,
      email: detalji.auth?.user?.email || null,
      interesovanja: detalji.interesovanja,
      prijave: detalji.prijave.map(p => {
        const moja = detalji.prisustva.filter(x => x.prijava_id === p.id);
        return {
          ...p,
          aktivnost: detalji.naziviPoId.get(p.aktivnost_id) || null,
          broj_prisustva: moja.filter(x => x.prisutan).length,
          broj_odsustva: moja.filter(x => !x.prisutan).length
        };
      })
    }
  });
}

async function kreiranjeUcenika(req, res) {
  const b = req.body || {};
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!jeNeprazanTekst(b.ime_i_prezime, 120) || b.ime_i_prezime.trim().length < 2) {
    throw greska(400, "Unesite ime i prezime.");
  }
  if (!EMAIL_REGEX.test(email)) throw greska(400, "Unesite ispravnu email adresu.");
  if (typeof b.lozinka !== "string" || b.lozinka.length < 8) {
    throw greska(400, "Lozinka mora imati najmanje 8 znakova.");
  }
  const razred = opcioniTekst(b.razred_odeljenje, 20);
  if (!razred.ok) throw greska(400, "Razred/odeljenje nije ispravno.");
  const interesovanjaIds = imaPolje(b, "interesovanja_ids") ? nizId(b.interesovanja_ids) : [];
  if (!interesovanjaIds) throw greska(400, "interesovanja_ids mora biti niz ID-jeva.");

  try {
    const rezultat = await adminService.kreirajUcenika({
      email,
      lozinka: b.lozinka,
      imeIPrezime: b.ime_i_prezime.trim(),
      razred: razred.vrednost,
      interesovanjaIds
    });
    return res.status(201).json({
      poruka: "Učenik je kreiran.",
      ucenik: { ...rezultat.profil, email: rezultat.email }
    });
  } catch (e) {
    if (e.authError) {
      const error = e.authError;
      if (error.code === "email_exists" || /already/i.test(error.message || "")) {
        throw greska(409, "Nalog sa ovom email adresom već postoji.");
      }
      throw error;
    }
    throw e;
  }
}

async function azuriranjeUcenika(req, res) {
  const ucenik = await zahtevajUcenika(req);
  const b = req.body || {};
  const unos = {};
  if (imaPolje(b, "ime_i_prezime")) {
    if (!jeNeprazanTekst(b.ime_i_prezime, 120) || b.ime_i_prezime.trim().length < 2) {
      throw greska(400, "Ime i prezime mora imati od 2 do 120 znakova.");
    }
    unos.ime_i_prezime = b.ime_i_prezime.trim();
  }
  for (const [polje, maks] of [
    ["razred_odeljenje", 20],
    ["korisnicko_ime", 50],
    ["biografija", 2000]
  ]) {
    if (imaPolje(b, polje)) {
      const v = opcioniTekst(b[polje], maks);
      if (!v.ok) throw greska(400, `Polje ${polje} nije ispravno.`);
      unos[polje] = v.vrednost;
    }
  }
  const interesovanjaIds = imaPolje(b, "interesovanja_ids") ? nizId(b.interesovanja_ids) : undefined;
  if (interesovanjaIds === null) throw greska(400, "interesovanja_ids mora biti niz ID-jeva.");
  if (!Object.keys(unos).length && interesovanjaIds === undefined) {
    throw greska(400, "Nema podataka za izmenu.");
  }
  const rezultat = await adminService.izmeniUcenika(ucenik.id, unos, interesovanjaIds);
  return res.json({
    poruka: "Podaci učenika su ažurirani.",
    ucenik: { ...rezultat.ucenik, interesovanja: rezultat.interesovanja }
  });
}

async function brisanjeUcenika(req, res) {
  const ucenik = await zahtevajUcenika(req);
  const rezultat = await adminService.obrisiUcenika(ucenik.id);
  if (rezultat.imaAktivnePrijave) {
    throw greska(
      409,
      "Učenik ima aktivne prijave. Najpre otkažite prijave, pa zatim obrišite nalog."
    );
  }
  return res.json({ poruka: "Učenik je obrisan." });
}

async function pregledZahteva(req, res) {
  const { status } = req.query;
  if (status !== undefined && !["na_cekanju", "odobren", "odbijen"].includes(status)) {
    throw greska(400, "Status mora biti na_cekanju, odobren ili odbijen.");
  }
  const zahtevi = await adminService.listaZahteva(status);
  return res.json({ zahtevi });
}

async function obradaZahteva(req, res) {
  const id = zahtevajId(req.params.id, "Neispravan ID zahteva.");
  const status = req.body?.status;
  if (!["odobren", "odbijen"].includes(status)) {
    throw greska(400, "Status mora biti odobren ili odbijen.");
  }
  const rezultat = await adminService.obradiZahtev(id, status);
  if (rezultat.notFound) throw greska(404, "Zahtev nije pronađen.");
  if (rezultat.alreadyProcessed) throw greska(409, "Zahtev je već obrađen.");
  if (rezultat.invalidProfile) throw greska(409, "Profil ne postoji ili više nema ulogu ucenik.");
  return res.json({ zahtev: rezultat.zahtev });
}

async function pregledPrijava(req, res) {
  const { status, aktivnost_id } = req.query;
  if (status !== undefined && !["prijavljen", "na_cekanju", "otkazano"].includes(status)) {
    throw greska(400, "Status mora biti prijavljen, na_cekanju ili otkazano.");
  }
  let validanAktivnostId;
  if (aktivnost_id !== undefined) {
    validanAktivnostId = zahtevajId(aktivnost_id, "Neispravan ID aktivnosti.");
  }
  const prijave = await adminService.listaPrijava({
    status,
    aktivnost_id: validanAktivnostId
  });
  return res.json({ prijave });
}

async function statistika(req, res) {
  const data = await adminService.statistika();
  return res.json(data);
}

module.exports = {
  pregledUcenika,
  detaljiUcenika,
  kreiranjeUcenika,
  azuriranjeUcenika,
  brisanjeUcenika,
  pregledZahteva,
  obradaZahteva,
  pregledPrijava,
  statistika
};
