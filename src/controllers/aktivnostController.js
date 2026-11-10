const aktivnosti = require('../services/aktivnostService');
const { authSupabase } = require('../config/supabase');

function validirajId(id) {
  return typeof id === 'string' && id.trim().length > 0;
}

async function pregled(req, res) {
  const data = await aktivnosti.pregledAktivnosti(req.supabase || authSupabase);
  return res.json(data);
}

async function mesta(req, res) {
  if (!validirajId(req.params.aktivnostId)) {
    return res.status(400).json({ greska: 'Neispravan ID aktivnosti.' });
  }

  const data = await aktivnosti.aktivnostPoId(req.supabase, req.params.aktivnostId);
  if (!data) return res.status(404).json({ greska: 'Aktivnost nije pronađena.' });

  return res.json({ aktivnost: data });
}

async function kreiranje(req, res) {
  const { naziv, opis = null, maksimalno_mesta, termin, prostorija } = req.body || {};
  if (
    typeof naziv !== 'string' ||
    !naziv.trim() ||
    !Number.isInteger(maksimalno_mesta) ||
    maksimalno_mesta < 1 ||
    typeof termin !== 'string' ||
    Number.isNaN(Date.parse(termin)) ||
    typeof prostorija !== 'string' ||
    !prostorija.trim() ||
    (opis !== null && typeof opis !== 'string')
  ) {
    return res.status(400).json({ greska: 'Podaci o aktivnosti nisu ispravni.' });
  }

  const data = await aktivnosti.kreirajAktivnost(
    req.supabase,
    req.korisnik.id,
    { naziv, opis, maksimalno_mesta, termin, prostorija }
  );
  return res.status(201).json(data);
}

async function prijava(req, res) {
  const { aktivnostId } = req.params;
  if (!validirajId(aktivnostId)) {
    return res.status(400).json({ greska: 'Neispravan ID aktivnosti.' });
  }

  const aktivnost = await aktivnosti.aktivnostPoId(req.supabase, aktivnostId);
  if (!aktivnost || aktivnost.aktivna === false) {
    return res.status(404).json({ greska: 'Aktivnost nije pronađena ili nije aktivna.' });
  }

  const prijava = await aktivnosti.prijaviUcenika(
    req.supabase,
    req.korisnik.id,
    aktivnostId
  );
  return res.status(201).json({ poruka: 'Uspešno ste se prijavili.', prijava });
}

async function otkazivanje(req, res) {
  const { aktivnostId } = req.params;
  if (!validirajId(aktivnostId)) {
    return res.status(400).json({ greska: 'Neispravan ID aktivnosti.' });
  }

  const data = await aktivnosti.otkaziPrijavu(
    req.supabase,
    req.korisnik.id,
    aktivnostId
  );
  if (!data) return res.status(404).json({ greska: 'Aktivna prijava nije pronađena.' });

  return res.json({ poruka: 'Prijava je otkazana.' });
}

module.exports = { pregled, mesta, kreiranje, prijava, otkazivanje };
