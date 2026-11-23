/**
 * @openapi
 * tags:
 *   - name: Opšte
 *   - name: Autentifikacija
 *   - name: Aktivnosti
 *   - name: Prijave
 *   - name: Prostorije
 *   - name: Termini
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Supabase access token dobijen prijavom ili registracijom.
 *   schemas:
 *     Greska:
 *       type: object
 *       properties:
 *         greska:
 *           type: string
 *           example: Neispravni podaci.
 *     Korisnik:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: 2f7b3b0a-9c2a-4a2d-bff2-6d3dce2c8921
 *         ime_i_prezime:
 *           type: string
 *           example: Ana Anić
 *         uloga:
 *           type: string
 *           enum: [ucenik, profesor]
 *           example: ucenik
 *         email:
 *           type: string
 *           format: email
 *           example: ana@example.com
 *         razred_odeljenje:
 *           type: string
 *           nullable: true
 *           example: 2-1
 *     ZahtevZaProfesora:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 17
 *         status:
 *           type: string
 *           enum: [na_cekanju, odobren, odbijen]
 *           example: na_cekanju
 *         kreiran_at:
 *           type: string
 *           format: date-time
 *         obradjen_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     Aktivnost:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 12
 *         naziv:
 *           type: string
 *           example: Školski hor
 *         opis:
 *           type: string
 *           nullable: true
 *           example: Probe jednom sedmično
 *         maksimalno_mesta:
 *           type: integer
 *           example: 20
 *         termin:
 *           type: string
 *           example: Srijeda 14:00
 *         prostorija:
 *           type: string
 *           example: Muzička učionica
 *         aktivna:
 *           type: boolean
 *           example: true
 *         kategorija:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: integer, example: 5 }
 *             naziv: { type: string, example: Muzika }
 *         termini:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: integer, example: 5 }
 *               dan_u_nedelji: { type: integer, example: 3 }
 *               dan: { type: string, example: Sreda }
 *               vreme_od: { type: string, example: "14:00:00" }
 *               vreme_do: { type: string, example: "15:30:00" }
 *               prostorija:
 *                 $ref: "#/components/schemas/Prostorija"
 *         profesori:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               ime_i_prezime: { type: string, example: Marko Marković }
 *         interesovanja:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: integer, example: 3 }
 *               naziv: { type: string, example: Muzika }
 *         moja_prijava:
 *           type: object
 *           nullable: true
 *           description: Samo uz token učenika.
 *           properties:
 *             id: { type: integer }
 *             status_prijave: { type: string, enum: [prijavljen, na_cekanju] }
 *         broj_prijavljenih:
 *           type: integer
 *           example: 8
 *         slobodna_mesta:
 *           type: integer
 *           example: 12
 *     Prostorija:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 3
 *         naziv:
 *           type: string
 *           example: Muzička učionica
 *         kapacitet:
 *           type: integer
 *           example: 24
 *         opis:
 *           type: string
 *           nullable: true
 *           example: Učionica na prvom spratu
 *     Termin:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 5
 *         dan_u_nedelji:
 *           type: integer
 *           minimum: 1
 *           maximum: 7
 *           description: Dan u sedmici (1–7).
 *           example: 3
 *         vreme_od:
 *           type: string
 *           example: 14:00
 *         vreme_do:
 *           type: string
 *           example: 15:30
 *         prostorija_id:
 *           type: integer
 *           example: 3
 *     Prijava:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 42
 *         aktivnost_id:
 *           type: integer
 *           example: 12
 *         ucenik_id:
 *           type: string
 *           format: uuid
 *           example: 2f7b3b0a-9c2a-4a2d-bff2-6d3dce2c8921
 *         status_prijave:
 *           type: string
 *           enum: [prijavljen, na_cekanju, otkazano]
 *           example: prijavljen
 *         prijavljen_at:
 *           type: string
 *           format: date-time
 *           example: "2026-09-10T12:00:00Z"
 *   parameters:
 *     AktivnostId:
 *       name: aktivnostId
 *       in: path
 *       required: true
 *       description: Pozitivan ID aktivnosti.
 *       schema:
 *         type: integer
 *         minimum: 1
 *       example: 12
 *     ProstorijaId:
 *       name: id
 *       in: path
 *       required: true
 *       description: Pozitivan ID prostorije.
 *       schema:
 *         type: integer
 *         minimum: 1
 *       example: 3
 *     TerminId:
 *       name: id
 *       in: path
 *       required: true
 *       description: Pozitivan ID termina.
 *       schema:
 *         type: integer
 *         minimum: 1
 *       example: 5
 *     PrijavaId:
 *       name: prijavaId
 *       in: path
 *       required: true
 *       description: Pozitivan ID prijave.
 *       schema:
 *         type: integer
 *         minimum: 1
 *       example: 42
 * paths:
 *   /:
 *     get:
 *       tags: [Opšte]
 *       summary: Provjera da li je API pokrenut
 *       responses:
 *         "200":
 *           description: API je dostupan.
 *           content:
 *             application/json:
 *               example:
 *                 poruka: API za vannastavne aktivnosti je pokrenut.
 *                 verzija: 1.2.0
 *   /api/health:
 *     get:
 *       tags: [Opšte]
 *       summary: Health check
 *       responses:
 *         "200":
 *           description: Server radi.
 *           content:
 *             application/json:
 *               example:
 *                 status: ok
 *                 poruka: Backend server radi!
 *   /api/test-verzija:
 *     get:
 *       tags: [Opšte]
 *       summary: Provjera aktivne verzije backend-a
 *       responses:
 *         "200":
 *           description: Identifikator verzije servera.
 *           content:
 *             application/json:
 *               example:
 *                 verzija: NOVA_VERZIJA_37
 *   /api-docs.json:
 *     get:
 *       tags: [Opšte]
 *       summary: OpenAPI specifikacija
 *       responses:
 *         "200":
 *           description: OpenAPI dokument za ovaj API.
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *   /api/auth/registracija:
 *     post:
 *       tags: [Autentifikacija]
 *       summary: Registracija učenika ili zahtjev za profesorski nalog
 *       description: |
 *         Uloga profesora se ne dodjeljuje registracijom. Izbor profesora pravi zahtjev
 *         na čekanju, dok profil ostaje uloga ucenik do ručnog odobrenja administratora.
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [ime_i_prezime, email, lozinka]
 *               properties:
 *                 ime_i_prezime:
 *                   type: string
 *                   minLength: 2
 *                   example: Ana Anić
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: ana@example.com
 *                 lozinka:
 *                   type: string
 *                   format: password
 *                   minLength: 8
 *                   example: "SigurnaLozinka123"
 *                 uloga:
 *                   type: string
 *                   enum: [ucenik, profesor]
 *                   default: ucenik
 *                   description: |
 *                     Za profesor kreira samo zahtjev; stvarna uloga se uvijek postavlja
 *                     na ucenik do odobrenja vlasnika projekta.
 *                   example: profesor
 *             example:
 *               ime_i_prezime: Ana Anić
 *               email: ana@example.com
 *               lozinka: "SigurnaLozinka123"
 *               uloga: profesor
 *       responses:
 *         "201":
 *           description: Nalog je kreiran.
 *           content:
 *             application/json:
 *               example:
 *                 poruka: Registracija je uspešna.
 *                 korisnik:
 *                   id: 2f7b3b0a-9c2a-4a2d-bff2-6d3dce2c8921
 *                   ime_i_prezime: Ana Anić
 *                   uloga: ucenik
 *                   email: ana@example.com
 *                 zahtev_za_profesora:
 *                   id: 17
 *                   status: na_cekanju
 *                   kreiran_at: "2026-11-20T12:00:00Z"
 *                   obradjen_at: null
 *                 token: eyJ...access-token
 *                 refresh_token: eyJ...refresh-token
 *                 potvrdaEmailaPotrebna: false
 *         "400":
 *           description: Neispravni podaci ili nepoznata uloga.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Uloga mora biti ucenik ili profesor.
 *         "409":
 *           description: Nalog već postoji ili registracija nije moguća.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Registracija nije moguća ili nalog već postoji.
 *         "503":
 *           description: Supabase Auth nije dostupan ili SQL za zahtjeve profesora nije primijenjen.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Supabase Auth trenutno nije dostupan.
 *         "500":
 *           description: Greška pri registraciji ili kreiranju profila.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Greška prilikom registracije.
 *   /api/auth/prijava:
 *     post:
 *       tags: [Autentifikacija]
 *       summary: Prijava korisnika
 *       description: Prijavljuje korisnika preko postojećeg Supabase Auth servisa.
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [email, lozinka]
 *               properties:
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: ana@example.com
 *                 lozinka:
 *                   type: string
 *                   format: password
 *                   example: "SigurnaLozinka123"
 *             example:
 *               email: ana@example.com
 *               lozinka: "SigurnaLozinka123"
 *       responses:
 *         "200":
 *           description: Prijava je uspješna.
 *           content:
 *             application/json:
 *               example:
 *                 poruka: Uspešno ste prijavljeni.
 *                 token: eyJ...access-token
 *                 refresh_token: eyJ...refresh-token
 *                 expires_at: 1790000000
 *                 korisnik:
 *                   id: 2f7b3b0a-9c2a-4a2d-bff2-6d3dce2c8921
 *                   ime_i_prezime: Ana Anić
 *                   uloga: ucenik
 *                   razred_odeljenje: 2-1
 *                   email: ana@example.com
 *         "400":
 *           description: Email ili lozinka nisu ispravni.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Unesite ispravan email i lozinku.
 *         "401":
 *           description: Pogrešni podaci ili nalog nije potvrđen.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Pogrešni podaci ili nalog nije potvrđen.
 *         "403":
 *           description: Korisnički profil nije pronađen.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Korisnički profil nije pronađen.
 *         "500":
 *           description: Greška pri prijavljivanju.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Greška prilikom prijavljivanja.
 *   /api/auth/me:
 *     get:
 *       tags: [Autentifikacija]
 *       summary: Podaci o trenutno prijavljenom korisniku
 *       security:
 *         - bearerAuth: []
 *       responses:
 *         "200":
 *           description: Profil autentifikovanog korisnika.
 *           content:
 *             application/json:
 *               example:
 *                 korisnik:
 *                   id: 2f7b3b0a-9c2a-4a2d-bff2-6d3dce2c8921
 *                   ime_i_prezime: Ana Anić
 *                   uloga: ucenik
 *                   email: ana@example.com
 *         "401":
 *           description: Nedostaje ili je nevažeći Bearer token.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Korisnički profil ne postoji.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Korisnički profil ne postoji.
 *   /api/auth/zahtev-za-profesora:
 *     get:
 *       tags: [Autentifikacija]
 *       summary: Status zahtjeva za profesorski nalog
 *       security:
 *         - bearerAuth: []
 *       responses:
 *         "200":
 *           description: Zahtjev korisnika ili null ako nije podnesen.
 *           content:
 *             application/json:
 *               example:
 *                 zahtev_za_profesora:
 *                   id: 17
 *                   status: na_cekanju
 *                   kreiran_at: "2026-11-20T12:00:00Z"
 *                   obradjen_at: null
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "503":
 *           description: SQL migracija za zahtjeve još nije primijenjena.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Tabela zahtjeva nije spremna.
 *     post:
 *       tags: [Autentifikacija]
 *       summary: Podnošenje ili oporavak zahtjeva za profesora
 *       description: |
 *         Koristi ID iz potvrđenog tokena; tijelo zahtjeva se ignoriše.
 *         Profil ostaje uloga ucenik dok vlasnik projekta ne odobri zahtjev u SQL Editoru.
 *       security:
 *         - bearerAuth: []
 *       responses:
 *         "200":
 *           description: Zahtjev postoji i čeka odobrenje.
 *           content:
 *             application/json:
 *               example:
 *                 poruka: Zahtjev za profesorski nalog je na čekanju.
 *                 zahtev_za_profesora:
 *                   id: 17
 *                   status: na_cekanju
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "409":
 *           description: Profil nije učenik ili je zahtjev već obrađen.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Zahtjev je već obrađen.
 *         "503":
 *           description: SQL migracija za zahtjeve još nije primijenjena.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Tabela zahtjeva nije spremna.
 *   /api/auth/osvezi-token:
 *     post:
 *       tags: [Autentifikacija]
 *       summary: Osvježavanje sesije
 *       description: Koristi Supabase refresh token za izdavanje novog access tokena.
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [refresh_token]
 *               properties:
 *                 refresh_token:
 *                   type: string
 *                   example: eyJ...refresh-token
 *             example:
 *               refresh_token: eyJ...refresh-token
 *       responses:
 *         "200":
 *           description: Sesija je osvježena.
 *           content:
 *             application/json:
 *               example:
 *                 token: eyJ...new-access-token
 *                 refresh_token: eyJ...new-refresh-token
 *                 expires_at: 1790000000
 *         "400":
 *           description: Refresh token nije dostavljen.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Refresh token je obavezan.
 *         "401":
 *           description: Sesija je istekla ili token nije važeći.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Sesija je istekla. Prijavite se ponovo.
 *         "500":
 *           description: Greška pri osvježavanju sesije.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Greška pri osvežavanju sesije.
 *   /api/auth/odjava:
 *     post:
 *       tags: [Autentifikacija]
 *       summary: Odjava trenutne sesije
 *       description: Opoziva Supabase sesiju povezanu sa Bearer access tokenom.
 *       security:
 *         - bearerAuth: []
 *       responses:
 *         "200":
 *           description: Korisnik je odjavljen.
 *           content:
 *             application/json:
 *               example:
 *                 poruka: Uspešno ste odjavljeni.
 *         "401":
 *           description: Potreban je važeći token.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *   /api/aktivnosti:
 *     get:
 *       tags: [Aktivnosti]
 *       summary: Pregled, pretraga i filtriranje aktivnosti
 *       description: |
 *         Javna ruta (token je opcion). Učenik i anonimni korisnik vide samo aktivne aktivnosti.
 *         Uz token učenika svaka aktivnost sadrži i `moja_prijava`.
 *       security:
 *         - {}
 *         - bearerAuth: []
 *       parameters:
 *         - name: q
 *           in: query
 *           description: Pretraga po nazivu, opisu, kategoriji, interesovanjima i profesorima.
 *           schema: { type: string }
 *         - name: kategorija_id
 *           in: query
 *           schema: { type: integer }
 *         - name: interesovanje_id
 *           in: query
 *           description: Jedan ili više ID-jeva odvojenih zarezom.
 *           schema: { type: string, example: "1,2" }
 *         - name: moja_interesovanja
 *           in: query
 *           description: Filtrira po interesovanjima iz profila prijavljenog korisnika.
 *           schema: { type: boolean }
 *         - name: dan
 *           in: query
 *           description: Dan u nedelji (1 = ponedeljak ... 7 = nedelja).
 *           schema: { type: integer, minimum: 1, maximum: 7 }
 *         - name: samo_slobodna
 *           in: query
 *           schema: { type: boolean }
 *         - name: ukljuci_neaktivne
 *           in: query
 *           description: Samo za profesora.
 *           schema: { type: boolean }
 *       responses:
 *         "200":
 *           description: Lista aktivnosti.
 *           content:
 *             application/json:
 *               schema:
 *                 type: array
 *                 items:
 *                   $ref: "#/components/schemas/Aktivnost"
 *               example:
 *                 - id: 12
 *                   naziv: Školski hor
 *                   opis: Probe jednom sedmično
 *                   maksimalno_mesta: 20
 *                   termin: Srijeda 14:00
 *                   prostorija: Muzička učionica
 *                   aktivna: true
 *                   broj_prijavljenih: 8
 *                   slobodna_mesta: 12
 *     post:
 *       tags: [Aktivnosti]
 *       summary: Kreiranje aktivnosti
 *       description: |
 *         Dostupno profesoru. Termin se zadaje ili kao tekst (`termin`, `prostorija`) ili kao
 *         lista postojećih termina (`termini_ids`). Sistem proverava da je prostorija u tim
 *         terminima slobodna i da broj mesta ne premašuje kapacitet prostorije.
 *       security:
 *         - bearerAuth: []
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [naziv, maksimalno_mesta]
 *               properties:
 *                 kategorija_id:
 *                   type: integer
 *                   nullable: true
 *                   example: 5
 *                 slika_url:
 *                   type: string
 *                   nullable: true
 *                 termini_ids:
 *                   type: array
 *                   items: { type: integer }
 *                   example: [5]
 *                 profesori_ids:
 *                   type: array
 *                   items: { type: string, format: uuid }
 *                 interesovanja_ids:
 *                   type: array
 *                   description: Zahteva SQL migraciju 004.
 *                   items: { type: integer }
 *                   example: [3]
 *                 naziv:
 *                   type: string
 *                   example: Školski hor
 *                 opis:
 *                   type: string
 *                   nullable: true
 *                   example: Probe jednom sedmično
 *                 maksimalno_mesta:
 *                   type: integer
 *                   minimum: 1
 *                   example: 20
 *                 termin:
 *                   type: string
 *                   example: Srijeda 14:00
 *                 prostorija:
 *                   type: string
 *                   example: Muzička učionica
 *             example:
 *               naziv: Školski hor
 *               opis: Probe jednom sedmično
 *               maksimalno_mesta: 20
 *               termin: Srijeda 14:00
 *               prostorija: Muzička učionica
 *       responses:
 *         "201":
 *           description: Aktivnost je kreirana.
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: "#/components/schemas/Aktivnost"
 *               example:
 *                 id: 12
 *                 naziv: Školski hor
 *                 maksimalno_mesta: 20
 *                 aktivna: true
 *         "400":
 *           description: Podaci o aktivnosti nisu ispravni.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Podaci o aktivnosti nisu ispravni.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Potrebna je uloga profesora.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu za ovu radnju.
 *         "409":
 *           description: Prostorija je zauzeta ili je kapacitet prostorije premali.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Broj mesta (30) premašuje kapacitet prostorije Učionica 4 (24).
 *         "500":
 *           description: Greška pri radu sa bazom.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Došlo je do greške na serveru.
 *   /api/aktivnosti/{aktivnostId}/mesta:
 *     get:
 *       tags: [Aktivnosti]
 *       summary: Pregled aktivnosti i slobodnih mjesta
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - $ref: "#/components/parameters/AktivnostId"
 *       responses:
 *         "200":
 *           description: Aktivnost i broj slobodnih mjesta.
 *           content:
 *             application/json:
 *               example:
 *                 aktivnost:
 *                   id: 12
 *                   naziv: Školski hor
 *                   maksimalno_mesta: 20
 *                   broj_prijavljenih: 8
 *                   slobodna_mesta: 12
 *         "400":
 *           description: ID aktivnosti nije ispravan.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Neispravan ID aktivnosti.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "404":
 *           description: Aktivnost nije pronađena.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Aktivnost nije pronađena.
 *   /api/aktivnosti/{aktivnostId}:
 *     patch:
 *       tags: [Aktivnosti]
 *       summary: Izmjena aktivnosti
 *       description: Dostupno profesoru (administratoru).
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - $ref: "#/components/parameters/AktivnostId"
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               minProperties: 1
 *               properties:
 *                 naziv:
 *                   type: string
 *                   example: Hor škole
 *                 opis:
 *                   type: string
 *                   nullable: true
 *                   example: Nova proba
 *                 maksimalno_mesta:
 *                   type: integer
 *                   minimum: 1
 *                   example: 24
 *                 termin:
 *                   type: string
 *                   example: Četvrtak 14:00
 *                 prostorija:
 *                   type: string
 *                   example: Učionica 4
 *             example:
 *               maksimalno_mesta: 24
 *               opis: Nova proba
 *       responses:
 *         "200":
 *           description: Aktivnost je izmijenjena.
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: "#/components/schemas/Aktivnost"
 *               example:
 *                 id: 12
 *                 naziv: Školski hor
 *                 maksimalno_mesta: 24
 *         "400":
 *           description: ID ili podaci nisu ispravni.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Podaci o aktivnosti nisu ispravni.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Korisnik nema pravo na izmjenu.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu za ovu radnju.
 *         "404":
 *           description: Aktivnost nije pronađena ili korisnik nema dozvolu.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Aktivnost nije pronađena ili nemate dozvolu.
 *         "409":
 *           description: Ograničenje broja prijavljenih korisnika.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Broj mesta ne može biti manji od broja prijavljenih.
 *   /api/aktivnosti/{aktivnostId}/deaktiviraj:
 *     patch:
 *       tags: [Aktivnosti]
 *       summary: Deaktivacija aktivnosti
 *       description: Dostupno profesoru (administratoru).
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - $ref: "#/components/parameters/AktivnostId"
 *       responses:
 *         "200":
 *           description: Aktivnost je deaktivirana.
 *           content:
 *             application/json:
 *               example:
 *                 poruka: Aktivnost je deaktivirana.
 *                 aktivnost:
 *                   id: 12
 *                   aktivna: false
 *         "400":
 *           description: ID aktivnosti nije ispravan.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Neispravan ID aktivnosti.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Potrebna je uloga profesora.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu za ovu radnju.
 *         "404":
 *           description: Aktivnost nije pronađena ili korisnik nema dozvolu.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Aktivnost nije pronađena ili nemate dozvolu.
 *   /api/aktivnosti/{aktivnostId}/prijave:
 *     get:
 *       tags: [Prijave]
 *       summary: Pregled prijava za aktivnost
 *       description: Dostupno profesoru (administratoru).
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - $ref: "#/components/parameters/AktivnostId"
 *       responses:
 *         "200":
 *           description: Prijave za aktivnost.
 *           content:
 *             application/json:
 *               example:
 *                 - id: 42
 *                   ucenik_id: 2f7b3b0a-9c2a-4a2d-bff2-6d3dce2c8921
 *                   status_prijave: prijavljen
 *                   prijavljen_at: "2026-09-10T12:00:00Z"
 *         "400":
 *           description: ID aktivnosti nije ispravan.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Neispravan ID aktivnosti.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Korisnik nema pravo pregleda prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu za pregled prijava.
 *         "404":
 *           description: Aktivnost nije pronađena.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Aktivnost nije pronađena.
 *   /api/aktivnosti/{aktivnostId}/prijave/{prijavaId}:
 *     patch:
 *       tags: [Prijave]
 *       summary: Promjena statusa prijave
 *       description: Dostupno profesoru (administratoru).
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - $ref: "#/components/parameters/AktivnostId"
 *         - $ref: "#/components/parameters/PrijavaId"
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [status_prijave]
 *               properties:
 *                 status_prijave:
 *                   type: string
 *                   enum: [prijavljen, na_cekanju, otkazano]
 *                   example: prijavljen
 *             example:
 *               status_prijave: prijavljen
 *       responses:
 *         "200":
 *           description: Status prijave je ažuriran.
 *           content:
 *             application/json:
 *               example:
 *                 poruka: Status prijave je ažuriran.
 *                 prijava:
 *                   id: 42
 *                   ucenik_id: 2f7b3b0a-9c2a-4a2d-bff2-6d3dce2c8921
 *                   status_prijave: prijavljen
 *         "400":
 *           description: ID ili status prijave nisu ispravni.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Status prijave mora biti prijavljen, na_cekanju ili otkazano.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Korisnik nema pravo upravljanja prijavom.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu da upravljate prijavama.
 *         "404":
 *           description: Aktivnost ili prijava nije pronađena.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Prijava nije pronađena.
 *         "409":
 *           description: Nema slobodnih mjesta.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nema slobodnih mesta za ovu prijavu.
 *   /api/aktivnosti/{aktivnostId}/prijava:
 *     post:
 *       tags: [Prijave]
 *       summary: Prijava učenika na aktivnost
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - $ref: "#/components/parameters/AktivnostId"
 *       responses:
 *         "201":
 *           description: Učenik je prijavljen.
 *           content:
 *             application/json:
 *               example:
 *                 poruka: Uspešno ste se prijavili.
 *                 prijava:
 *                   id: 42
 *                   aktivnost_id: 12
 *                   status_prijave: prijavljen
 *         "400":
 *           description: ID aktivnosti nije ispravan.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Neispravan ID aktivnosti.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Dostupno samo učenicima.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu za ovu radnju.
 *         "404":
 *           description: Aktivnost nije dostupna.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Aktivnost nije dostupna.
 *         "409":
 *           description: Nema slobodnih mjesta ili prijava već postoji.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nema slobodnih mesta.
 *     delete:
 *       tags: [Prijave]
 *       summary: Otkazivanje prijave na aktivnost
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - $ref: "#/components/parameters/AktivnostId"
 *       responses:
 *         "200":
 *           description: Prijava je otkazana.
 *           content:
 *             application/json:
 *               example:
 *                 poruka: Prijava je uspešno otkazana.
 *         "400":
 *           description: ID aktivnosti nije ispravan.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Neispravan ID aktivnosti.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Dostupno samo učenicima.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu za ovu radnju.
 *         "404":
 *           description: Aktivna prijava nije pronađena.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Aktivna prijava nije pronađena.
 *   /api/moje-prijave:
 *     get:
 *       tags: [Prijave]
 *       summary: Pregled prijava trenutno prijavljenog učenika
 *       security:
 *         - bearerAuth: []
 *       responses:
 *         "200":
 *           description: Lista prijava učenika.
 *           content:
 *             application/json:
 *               example:
 *                 prijave:
 *                   - id: 42
 *                     aktivnost_id: 12
 *                     status_prijave: prijavljen
 *                     prijavljen_at: "2026-09-10T12:00:00Z"
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Dostupno samo učenicima.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu za ovu radnju.
 *         "500":
 *           description: Greška pri učitavanju prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Greška pri učitavanju prijava.
 *   /api/prostorije:
 *     get:
 *       tags: [Prostorije]
 *       summary: Pregled prostorija
 *       security:
 *         - bearerAuth: []
 *       responses:
 *         "200":
 *           description: Lista prostorija.
 *           content:
 *             application/json:
 *               example:
 *                 prostorije:
 *                   - id: 3
 *                     naziv: Muzička učionica
 *                     kapacitet: 24
 *                     opis: Učionica na prvom spratu
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "500":
 *           description: Greška pri učitavanju prostorija.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Greška pri učitavanju prostorija.
 *     post:
 *       tags: [Prostorije]
 *       summary: Kreiranje prostorije
 *       description: Dostupno profesoru.
 *       security:
 *         - bearerAuth: []
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [naziv, kapacitet]
 *               properties:
 *                 naziv:
 *                   type: string
 *                   example: Muzička učionica
 *                 kapacitet:
 *                   type: integer
 *                   minimum: 1
 *                   example: 24
 *                 opis:
 *                   type: string
 *                   nullable: true
 *                   example: Učionica na prvom spratu
 *             example:
 *               naziv: Muzička učionica
 *               kapacitet: 24
 *               opis: Učionica na prvom spratu
 *       responses:
 *         "201":
 *           description: Prostorija je kreirana.
 *           content:
 *             application/json:
 *               example:
 *                 prostorija:
 *                   id: 3
 *                   naziv: Muzička učionica
 *                   kapacitet: 24
 *                   opis: Učionica na prvom spratu
 *         "400":
 *           description: Podaci o prostoriji nisu ispravni.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Neispravni podaci o prostoriji.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Potrebna je uloga profesora.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu za ovu radnju.
 *         "409":
 *           description: Prostorija već postoji.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Prostorija već postoji.
 *         "500":
 *           description: Greška pri kreiranju prostorije.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Greška pri kreiranju prostorije.
 *   /api/prostorije/{id}:
 *     patch:
 *       tags: [Prostorije]
 *       summary: Izmjena prostorije
 *       description: Dostupno profesoru.
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - $ref: "#/components/parameters/ProstorijaId"
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               minProperties: 1
 *               properties:
 *                 naziv:
 *                   type: string
 *                   example: Nova učionica
 *                 kapacitet:
 *                   type: integer
 *                   minimum: 1
 *                   example: 30
 *                 opis:
 *                   type: string
 *                   nullable: true
 *                   example: Opis prostorije
 *             example:
 *               kapacitet: 30
 *       responses:
 *         "200":
 *           description: Prostorija je izmijenjena.
 *           content:
 *             application/json:
 *               example:
 *                 prostorija:
 *                   id: 3
 *                   naziv: Muzička učionica
 *                   kapacitet: 30
 *         "400":
 *           description: ID ili podaci nisu ispravni.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Neispravan ID prostorije.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Potrebna je uloga profesora.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu za ovu radnju.
 *         "404":
 *           description: Prostorija nije pronađena.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Prostorija nije pronađena.
 *         "409":
 *           description: Izmjena krši jedinstveno ime ili ograničenje kapaciteta.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Kapacitet prostorije nije dozvoljen.
 *         "500":
 *           description: Greška pri izmjeni prostorije.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Greška pri izmeni prostorije.
 *   /api/termini:
 *     get:
 *       tags: [Termini]
 *       summary: Pregled termina
 *       security:
 *         - bearerAuth: []
 *       responses:
 *         "200":
 *           description: Lista termina.
 *           content:
 *             application/json:
 *               example:
 *                 termini:
 *                   - id: 5
 *                     dan_u_nedelji: 3
 *                     vreme_od: "14:00:00"
 *                     vreme_do: "15:30:00"
 *                     prostorija_id: 3
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "500":
 *           description: Greška pri učitavanju termina.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Došlo je do greške na serveru.
 *     post:
 *       tags: [Termini]
 *       summary: Kreiranje termina
 *       description: Dostupno profesoru.
 *       security:
 *         - bearerAuth: []
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [dan_u_nedelji, vreme_od, vreme_do, prostorija_id]
 *               properties:
 *                 dan_u_nedelji:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 7
 *                   example: 3
 *                 vreme_od:
 *                   type: string
 *                   pattern: "^([01]\\\\d|2[0-3]):[0-5]\\\\d(:[0-5]\\\\d)?$"
 *                   example: "14:00"
 *                 vreme_do:
 *                   type: string
 *                   pattern: "^([01]\\\\d|2[0-3]):[0-5]\\\\d(:[0-5]\\\\d)?$"
 *                   example: "15:30"
 *                 prostorija_id:
 *                   type: integer
 *                   minimum: 1
 *                   example: 3
 *             example:
 *               dan_u_nedelji: 3
 *               vreme_od: "14:00"
 *               vreme_do: "15:30"
 *               prostorija_id: 3
 *       responses:
 *         "201":
 *           description: Termin je kreiran.
 *           content:
 *             application/json:
 *               example:
 *                 poruka: Termin je uspešno kreiran.
 *                 termin:
 *                   id: 5
 *                   dan_u_nedelji: 3
 *                   vreme_od: "14:00:00"
 *                   vreme_do: "15:30:00"
 *                   prostorija_id: 3
 *         "400":
 *           description: Podaci o terminu nisu ispravni.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Neispravni podaci o terminu.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Potrebna je uloga profesora.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu za ovu radnju.
 *         "409":
 *           description: Termin je u sukobu sa postojećim podacima.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Termin nije moguće kreirati zbog ograničenja.
 *         "500":
 *           description: Greška pri kreiranju termina.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Došlo je do greške na serveru.
 *   /api/termini/{id}:
 *     patch:
 *       tags: [Termini]
 *       summary: Izmjena termina
 *       description: Dostupno profesoru.
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - $ref: "#/components/parameters/TerminId"
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               minProperties: 1
 *               properties:
 *                 dan_u_nedelji:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 7
 *                   example: 4
 *                 vreme_od:
 *                   type: string
 *                   example: "15:00"
 *                 vreme_do:
 *                   type: string
 *                   example: "16:00"
 *                 prostorija_id:
 *                   type: integer
 *                   minimum: 1
 *                   example: 3
 *             example:
 *               vreme_od: "15:00"
 *               vreme_do: "16:00"
 *       responses:
 *         "200":
 *           description: Termin je izmijenjen.
 *           content:
 *             application/json:
 *               example:
 *                 poruka: Termin je izmenjen.
 *                 termin:
 *                   id: 5
 *                   dan_u_nedelji: 3
 *                   vreme_od: "15:00:00"
 *                   vreme_do: "16:00:00"
 *                   prostorija_id: 3
 *         "400":
 *           description: ID ili podaci nisu ispravni.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Neispravni podaci za izmenu.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Potrebna je uloga profesora.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu za ovu radnju.
 *         "404":
 *           description: Termin nije pronađen.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Termin nije pronađen.
 *         "409":
 *           description: Izmjena nije dozvoljena zbog ograničenja baze.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Radnja nije dozvoljena zbog ograničenja sistema.
 *         "500":
 *           description: Greška pri izmjeni termina.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Došlo je do greške na serveru.
 *     delete:
 *       tags: [Termini]
 *       summary: Brisanje termina
 *       description: Dostupno profesoru. Termin povezan sa aktivnošću ne može se obrisati.
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - $ref: "#/components/parameters/TerminId"
 *       responses:
 *         "200":
 *           description: Termin je obrisan.
 *           content:
 *             application/json:
 *               example:
 *                 poruka: Termin je obrisan.
 *         "400":
 *           description: ID termina nije ispravan.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Neispravan ID termina.
 *         "401":
 *           description: Potrebna je prijava.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Morate biti prijavljeni.
 *         "403":
 *           description: Potrebna je uloga profesora.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Nemate dozvolu za ovu radnju.
 *         "404":
 *           description: Termin nije pronađen.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Termin nije pronađen.
 *         "409":
 *           description: Termin je povezan sa aktivnošću.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Termin je povezan sa aktivnošću "Školski hor".
 *         "500":
 *           description: Greška pri brisanju termina.
 *           content:
 *             application/json:
 *               example:
 *                 greska: Došlo je do greške na serveru.
 */
