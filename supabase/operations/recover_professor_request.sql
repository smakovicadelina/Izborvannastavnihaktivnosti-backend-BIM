-- Replace the email below with the email of the already-created student account.
-- This only creates the pending request; it does not change the user's role.
INSERT INTO public.zahtevi_za_profesora (korisnik_id)
SELECT profile.id
FROM auth.users AS auth_user
JOIN public.korisnici AS profile
  ON profile.id = auth_user.id
WHERE LOWER(auth_user.email) = LOWER('replace-with-user-email@example.com')
  AND profile.uloga = 'ucenik'::public.uloga_korisnika
ON CONFLICT (korisnik_id) DO NOTHING
RETURNING id, korisnik_id, status, kreiran_at;
