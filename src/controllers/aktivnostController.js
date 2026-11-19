
const aktivnosti = require("../services/aktivnostService");
const { dbSupabase } = require("../config/supabase");

function validirajId(id) {
  return /^\d+$/.test(String(id)) && Number(id) > 0;
}

function greska(res, error) {
  console.error("Aktivnosti:", error);

  const status = [400, 403, 404, 409].includes(error.status)
    ? error.status
    : error.code === "23505"
      ? 409
      : 500;

  return res.status(status).json({
    greska:
      status === 500
        ? "Greška prilikom rada sa bazom."
        : status === 409 && error.code === "23505"
          ? "Prijava već postoji."
          : error.message
  });
}

// PREGLED AKTIVNOSTI
async function pregled(req, res) {
  try {
    const data = await aktivnosti.pregledAktivnosti(dbSupabase);
    return res.json(data);
  } catch (error) {
    return greska(res, error);
  }
}

// PREGLED AKTIVNOSTI I SLOBODNIH MESTA
async function mesta(req, res) {
  try {
    const { aktivnostId } = req.params;

    if (!validirajId(aktivnostId)) {
      return res.status(400).json({
        greska: "Neispravan ID aktivnosti."
      });
    }

    const data = await aktivnosti.aktivnostPoId(
      dbSupabase,
      aktivnostId
    );

    if (!data) {
      return res.status(404).json({
        greska: "Aktivnost nije pronađena."
      });
    }

    return res.json({ aktivnost: data });
  } catch (error) {
    return greska(res, error);
  }
}

// PROFESOR KREIRA AKTIVNOST
async function kreiranje(req, res) {
  try {
    const {
      naziv,
      opis = null,
      maksimalno_mesta,
      termin,
      prostorija
    } = req.body || {};

    if (
      typeof naziv !== "string" ||
      !naziv.trim() ||
      !Number.isInteger(maksimalno_mesta) ||
      maksimalno_mesta < 1 ||
      typeof termin !== "string" ||
      !termin.trim() ||
      typeof prostorija !== "string" ||
      !prostorija.trim() ||
      (opis !== null && typeof opis !== "string")
    ) {
      return res.status(400).json({
        greska: "Podaci o aktivnosti nisu ispravni."
      });
    }

    const data = await aktivnosti.kreirajAktivnost(
      dbSupabase,
      req.korisnik.id,
      {
        naziv: naziv.trim(),
        opis,
        maksimalno_mesta,
        termin: termin.trim(),
        prostorija: prostorija.trim()
      }
    );

    return res.status(201).json(data);
  } catch (error) {
    return greska(res, error);
  }
}

// PROFESOR UREDJUJE AKTIVNOST
async function uredivanje(req, res) {
  try {
    const { aktivnostId } = req.params;

    if (!validirajId(aktivnostId)) {
      return res.status(400).json({ greska: "Neispravan ID aktivnosti." });
    }

    const dozvoljenaPolja = [
      "naziv",
      "opis",
      "maksimalno_mesta",
      "termin",
      "prostorija"
    ];
    const body = req.body || {};
    const unos = {};

    for (const polje of dozvoljenaPolja) {
      if (Object.prototype.hasOwnProperty.call(body, polje)) {
        unos[polje] = body[polje];
      }
    }

    if (Object.keys(unos).length === 0) {
      return res.status(400).json({ greska: "Nema polja za ažuriranje." });
    }

    if (
      (Object.prototype.hasOwnProperty.call(unos, "naziv") &&
        (typeof unos.naziv !== "string" || !unos.naziv.trim())) ||
      (Object.prototype.hasOwnProperty.call(unos, "opis") &&
        unos.opis !== null && typeof unos.opis !== "string") ||
      (Object.prototype.hasOwnProperty.call(unos, "maksimalno_mesta") &&
        (!Number.isInteger(unos.maksimalno_mesta) ||
          unos.maksimalno_mesta < 1)) ||
      (Object.prototype.hasOwnProperty.call(unos, "termin") &&
        (typeof unos.termin !== "string" || !unos.termin.trim())) ||
      (Object.prototype.hasOwnProperty.call(unos, "prostorija") &&
        (typeof unos.prostorija !== "string" || !unos.prostorija.trim()))
    ) {
      return res.status(400).json({ greska: "Podaci o aktivnosti nisu ispravni." });
    }

    if (typeof unos.naziv === "string") unos.naziv = unos.naziv.trim();
    if (typeof unos.termin === "string") unos.termin = unos.termin.trim();
    if (typeof unos.prostorija === "string") unos.prostorija = unos.prostorija.trim();

    const data = await aktivnosti.urediAktivnost(
      dbSupabase,
      req.korisnik.id,
      aktivnostId,
      unos
    );

    return res.json(data);
  } catch (error) {
    return greska(res, error);
  }
}

// PROFESOR DEAKTIVIRA AKTIVNOST
async function deaktiviranje(req, res) {
  try {
    const { aktivnostId } = req.params;

    if (!validirajId(aktivnostId)) {
      return res.status(400).json({ greska: "Neispravan ID aktivnosti." });
    }

    const data = await aktivnosti.deaktivirajAktivnost(
      dbSupabase,
      req.korisnik.id,
      aktivnostId
    );

    return res.json({ poruka: "Aktivnost je deaktivirana.", aktivnost: data });
  } catch (error) {
    return greska(res, error);
  }
}

// PROFESOR PREGLEDA PRIJAVE
async function prijaveAktivnosti(req, res) {
  try {
    const { aktivnostId } = req.params;

    if (!validirajId(aktivnostId)) {
      return res.status(400).json({ greska: "Neispravan ID aktivnosti." });
    }

    const data = await aktivnosti.prijaveAktivnosti(
      dbSupabase,
      req.korisnik.id,
      aktivnostId
    );

    return res.json(data);
  } catch (error) {
    return greska(res, error);
  }
}

// PROFESOR AZURIRA STATUS PRIJAVE
async function azurirajPrijavu(req, res) {
  try {
    const { aktivnostId, prijavaId } = req.params;
    const statusPrijave = req.body?.status_prijave;

    if (!validirajId(aktivnostId) || !validirajId(prijavaId)) {
      return res.status(400).json({ greska: "Neispravan ID aktivnosti ili prijave." });
    }

    if (!["prijavljen", "na_cekanju", "otkazano"].includes(statusPrijave)) {
      return res.status(400).json({
        greska: "Status prijave mora biti prijavljen, na_cekanju ili otkazano."
      });
    }

    const data = await aktivnosti.azurirajPrijavu(
      dbSupabase,
      req.korisnik.id,
      aktivnostId,
      prijavaId,
      statusPrijave
    );

    return res.json({
      poruka: "Status prijave je ažuriran.",
      prijava: data
    });
  } catch (error) {
    return greska(res, error);
  }
}

// UCENIK SE PRIJAVLJUJE NA AKTIVNOST
async function prijava(req, res) {
  try {
    const { aktivnostId } = req.params;

    if (!validirajId(aktivnostId)) {
      return res.status(400).json({
        greska: "Neispravan ID aktivnosti."
      });
    }

    const aktivnost = await aktivnosti.aktivnostPoId(
      dbSupabase,
      aktivnostId
    );

    if (!aktivnost || aktivnost.aktivna === false) {
      return res.status(404).json({
        greska: "Aktivnost nije dostupna."
      });
    }

    const prijava = await aktivnosti.prijaviUcenika(
      dbSupabase,
      req.korisnik.id,
      aktivnostId
    );

    return res.status(201).json({
      poruka: "Uspešno ste se prijavili.",
      prijava
    });
  } catch (error) {
    return greska(res, error);
  }
}

// UCENIK OTKAZUJE PRIJAVU
async function otkazivanje(req, res) {
  try {
    const { aktivnostId } = req.params;

    if (!validirajId(aktivnostId)) {
      return res.status(400).json({
        greska: "Neispravan ID aktivnosti."
      });
    }

    const data = await aktivnosti.otkaziPrijavu(
      dbSupabase,
      req.korisnik.id,
      aktivnostId
    );

    if (!data) {
      return res.status(404).json({
        greska: "Aktivna prijava nije pronađena."
      });
    }

    return res.json({
      poruka: "Prijava je uspešno otkazana."
    });
  } catch (error) {
    return greska(res, error);
  }
}

module.exports = {
  pregled,
  mesta,
  kreiranje,
  uredivanje,
  deaktiviranje,
  prijaveAktivnosti,
  azurirajPrijavu,
  prijava,
  otkazivanje
};
