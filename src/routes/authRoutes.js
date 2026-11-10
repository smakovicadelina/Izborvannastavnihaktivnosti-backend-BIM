const express = require('express');
const { authSupabase, dbSupabase } = require('../config/supabase');
const zahtevajPrijavu = require('../middleware/zahtevajPrijavu');

const router = express.Router();

router.get('/me', zahtevajPrijavu, (req, res) => {
  return res.json({
    korisnik: {
      id: req.korisnik.id,
      email: req.korisnik.email,
      metadata: req.korisnik.user_metadata
    }
  });
});

router.post('/registracija', async (req, res) => {
  const body = req.body || {};
  const ime = typeof body.ime === 'string' ? body.ime.trim() : '';
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const lozinka = body.lozinka;

  if (!ime || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ greska: 'Unesite ime i ispravnu email adresu.' });
  }
  if (typeof lozinka !== 'string' || lozinka.length < 8) {
    return res.status(400).json({ greska: 'Lozinka mora imati najmanje 8 znakova.' });
  }

  const { data, error } = await authSupabase.auth.signUp({
    email,
    password: lozinka,
    options: { data: { ime } }
  });

  if (error) {
    return res.status(400).json({ greska: error.message });
  }
  if (!data.user || data.user.identities?.length === 0) {
    return res.status(409).json({ greska: 'Korisnik sa ovom email adresom već postoji.' });
  }

  const { error: profilGreska } = await dbSupabase
    .from('korisnici')
    .insert({ id: data.user.id, ime, email });

  if (profilGreska) {
    const { error: brisanjeGreska } = await dbSupabase.auth.admin.deleteUser(data.user.id);
    if (brisanjeGreska) console.error('Greška pri poništavanju registracije:', brisanjeGreska);
    console.error('Greška pri upisu korisnika:', profilGreska);
    return res.status(500).json({ greska: 'Registracija nije uspela.' });
  }

  return res.status(201).json({
    poruka: 'Registracija je uspešna.',
    korisnik: { id: data.user.id, ime, email },
    token: data.session?.access_token ?? null,
    potvrdaEmailaPotrebna: !data.session
  });
});

router.post('/prijava', async (req, res) => {
  const body = req.body || {};
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const lozinka = body.lozinka;

  if (!email || typeof lozinka !== 'string' || !lozinka) {
    return res.status(400).json({ greska: 'Email i lozinka su obavezni.' });
  }

  const { data, error } = await authSupabase.auth.signInWithPassword({
    email,
    password: lozinka
  });

  if (error || !data.user || !data.session) {