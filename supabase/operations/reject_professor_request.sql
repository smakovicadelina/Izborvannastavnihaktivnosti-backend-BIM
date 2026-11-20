-- Replace 123 with the request ID shown by the pending-requests query.
UPDATE public.zahtevi_za_profesora
   SET status = 'odbijen',
       obradjen_at = NOW()
 WHERE id = 123
   AND status = 'na_cekanju'
RETURNING id, korisnik_id, status, obradjen_at;
