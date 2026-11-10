const { authSupabase, createUserSupabase } = require('../config/supabase');

async function zahtevajPrijavu(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return res.status(401).json({ greska: 'Potrebna je prijava.' });
  }

  const { data, error } = await authSupabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ greska: 'Sesija nije važeća.' });
  }

  req.korisnik = data.user;
  req.supabase = createUserSupabase(token);
  return next();
}

module.exports = zahtevajPrijavu;
