-- Replace 123 with the request ID shown by the pending-requests query.
BEGIN;

DO $$
DECLARE
    request_id BIGINT := 123;
    user_id UUID;
BEGIN
    SELECT korisnik_id
      INTO user_id
      FROM public.zahtevi_za_profesora
     WHERE id = request_id
       AND status = 'na_cekanju'
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Zahtjev ne postoji ili vise nije na cekanju.';
    END IF;

    UPDATE public.korisnici
       SET uloga = 'profesor'::public.uloga_korisnika
     WHERE id = user_id
       AND uloga = 'ucenik'::public.uloga_korisnika;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Profil ne postoji ili vise nema ulogu ucenik.';
    END IF;

    UPDATE public.zahtevi_za_profesora
       SET status = 'odobren',
           obradjen_at = NOW()
     WHERE id = request_id
       AND status = 'na_cekanju';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Zahtjev je promijenjen tokom odobravanja.';
    END IF;
END;
$$;

COMMIT;
