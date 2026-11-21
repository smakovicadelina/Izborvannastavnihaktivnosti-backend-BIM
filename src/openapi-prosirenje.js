/**
 * @openapi
 * tags:
 *   - name: Kategorije
 *   - name: Interesovanja
 *   - name: Profil
 *   - name: Raspored i istorija
 *   - name: Obaveštenja
 *   - name: Prisustvo
 *   - name: AI asistent
 *   - name: Admin
 * components:
 *   responses:
 *     NeispravanZahtev:
 *       description: Neispravni podaci.
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/Greska" }
 *     Neprijavljen:
 *       description: Potrebna je prijava.
 *       content:
 *         application/json:
 *           example: { greska: Morate biti prijavljeni. }
 *     Zabranjeno:
 *       description: Uloga nema pristup.
 *       content:
 *         application/json:
 *           example: { greska: Nemate dozvolu za ovu radnju. }
 *     NijePronadjeno:
 *       description: Zapis nije pronađen.
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/Greska" }
 *     Konflikt:
 *       description: Radnja krši pravila sistema (kapacitet, preklapanje, povezani podaci).
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/Greska" }
 *     MigracijaPotrebna:
 *       description: SQL migracija nije primenjena.
 *       content:
 *         application/json:
 *           example: { greska: Baza nije ažurirana. Pokrenite SQL migracije iz foldera supabase/migrations. }
 *   schemas:
 *     Sifarnik:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         naziv: { type: string, example: Sport }
 *         opis: { type: string, nullable: true }
 *     SifarnikUnos:
 *       type: object
 *       required: [naziv]
 *       properties:
 *         naziv: { type: string, example: Robotika }
 *         opis: { type: string, nullable: true }
 *     Profil:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         ime_i_prezime: { type: string, example: Ana Anić }
 *         uloga: { type: string, enum: [ucenik, profesor] }
 *         razred_odeljenje: { type: string, nullable: true, example: 2-1 }
 *         korisnicko_ime: { type: string, nullable: true, example: ana.anic }
 *         biografija: { type: string, nullable: true }
 *         avatar_url: { type: string, nullable: true }
 *         email: { type: string, format: email }
 *         interesovanja:
 *           type: array
 *           items: { $ref: "#/components/schemas/Sifarnik" }
 *     Obavestenje:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         tip: { type: string, example: promena_termina }
 *         naslov: { type: string, example: Promena termina }
 *         poruka: { type: string }
 *         aktivnost_id: { type: integer, nullable: true }
 *         procitano: { type: boolean }
 *         kreirano_at: { type: string, format: date-time }
 *     Prisustvo:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         prijava_id: { type: integer }
 *         datum: { type: string, format: date }
 *         prisutan: { type: boolean }
 *         evidentirano_at: { type: string, format: date-time }
 *     AiPreporuka:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         pitanje: { type: string }
 *         izvor: { type: string, enum: [tekst, glas] }
 *         model: { type: string, example: claude-opus-5-5, description: "Model koji je dao preporuke ili 'lokalni'." }
 *         uvod: { type: string }
 *         kreirano_at: { type: string, format: date-time }
 *         preporuke:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               aktivnost_id: { type: integer }
 *               podudarnost: { type: integer, example: 87 }
 *               obrazlozenje: { type: string }
 *               aktivnost: { $ref: "#/components/schemas/Aktivnost" }
 *   parameters:
 *     SifarnikId:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: integer, minimum: 1 }
 *     UcenikId:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *
 * paths:
 *   /api/aktivnosti/{aktivnostId}:
 *     get:
 *       tags: [Aktivnosti]
 *       summary: Detalji aktivnosti (profesori, termini, prostorije, kapacitet, slobodna mesta)
 *       description: Token je opcion. Neaktivnu aktivnost vidi samo profesor.
 *       security: [{}, { bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/AktivnostId" }]
 *       responses:
 *         "200":
 *           description: Aktivnost.
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   aktivnost: { $ref: "#/components/schemas/Aktivnost" }
 *         "400": { $ref: "#/components/responses/NeispravanZahtev" }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *     delete:
 *       tags: [Aktivnosti]
 *       summary: Brisanje aktivnosti
 *       description: Dozvoljeno samo za aktivnost bez ijedne prijave; u suprotnom je treba deaktivirati.
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/AktivnostId" }]
 *       responses:
 *         "200": { description: Aktivnost je obrisana. }
 *         "401": { $ref: "#/components/responses/Neprijavljen" }
 *         "403": { $ref: "#/components/responses/Zabranjeno" }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *   /api/aktivnosti/{aktivnostId}/aktiviraj:
 *     patch:
 *       tags: [Aktivnosti]
 *       summary: Ponovno aktiviranje aktivnosti
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/AktivnostId" }]
 *       responses:
 *         "200": { description: Aktivnost je aktivirana. }
 *         "403": { $ref: "#/components/responses/Zabranjeno" }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *   /api/aktivnosti/{aktivnostId}/qr:
 *     get:
 *       tags: [Prisustvo]
 *       summary: Profesor generiše QR kod za evidenciju prisustva
 *       description: |
 *         Vraća potpisani kod koji frontend prikazuje kao QR sliku. Učenik ga skenira kamerom
 *         i šalje na `POST /api/prisustva/skeniraj`.
 *       security: [{ bearerAuth: [] }]
 *       parameters:
 *         - $ref: "#/components/parameters/AktivnostId"
 *         - name: datum
 *           in: query
 *           description: Datum časa (podrazumevano danas).
 *           schema: { type: string, format: date }
 *         - name: trajanje_min
 *           in: query
 *           description: Koliko minuta kod važi (1–1440, podrazumevano 120).
 *           schema: { type: integer }
 *       responses:
 *         "200":
 *           description: QR kod.
 *           content:
 *             application/json:
 *               example:
 *                 aktivnost_id: 12
 *                 naziv: Školski hor
 *                 datum: "2026-11-21"
 *                 vazi_do: "2026-11-21T16:00:00.000Z"
 *                 kod: VA1.eyJh...potpis
 *         "403": { $ref: "#/components/responses/Zabranjeno" }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *   /api/aktivnosti/{aktivnostId}/prijave:
 *     post:
 *       tags: [Prijave]
 *       summary: Profesor upisuje učenika na aktivnost
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/AktivnostId" }]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [ucenik_id]
 *               properties:
 *                 ucenik_id: { type: string, format: uuid }
 *       responses:
 *         "201": { description: Učenik je upisan. }
 *         "403": { $ref: "#/components/responses/Zabranjeno" }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *   /api/aktivnosti/{aktivnostId}/prijave/{prijavaId}:
 *     delete:
 *       tags: [Prijave]
 *       summary: Brisanje prijave (samo ako nema evidentiranog prisustva)
 *       security: [{ bearerAuth: [] }]
 *       parameters:
 *         - $ref: "#/components/parameters/AktivnostId"
 *         - $ref: "#/components/parameters/PrijavaId"
 *       responses:
 *         "200": { description: Prijava je obrisana. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *
 *   /api/kategorije:
 *     get:
 *       tags: [Kategorije]
 *       summary: Lista kategorija (javno)
 *       responses:
 *         "200":
 *           description: Kategorije.
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   kategorije: { type: array, items: { $ref: "#/components/schemas/Sifarnik" } }
 *     post:
 *       tags: [Kategorije]
 *       summary: Kreiranje kategorije (profesor)
 *       security: [{ bearerAuth: [] }]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SifarnikUnos" }
 *       responses:
 *         "201": { description: Kategorija je kreirana. }
 *         "400": { $ref: "#/components/responses/NeispravanZahtev" }
 *         "403": { $ref: "#/components/responses/Zabranjeno" }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *   /api/kategorije/{id}:
 *     get:
 *       tags: [Kategorije]
 *       summary: Jedna kategorija
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       responses:
 *         "200": { description: Kategorija. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *     patch:
 *       tags: [Kategorije]
 *       summary: Izmena kategorije (profesor)
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       requestBody:
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SifarnikUnos" }
 *       responses:
 *         "200": { description: Kategorija je izmenjena. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *     delete:
 *       tags: [Kategorije]
 *       summary: Brisanje kategorije (nije dozvoljeno ako je dodeljena aktivnostima)
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       responses:
 *         "200": { description: Kategorija je obrisana. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *
 *   /api/interesovanja:
 *     get:
 *       tags: [Interesovanja]
 *       summary: Lista interesovanja (javno)
 *       responses:
 *         "200":
 *           description: Interesovanja.
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   interesovanja: { type: array, items: { $ref: "#/components/schemas/Sifarnik" } }
 *     post:
 *       tags: [Interesovanja]
 *       summary: Kreiranje interesovanja (profesor)
 *       security: [{ bearerAuth: [] }]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SifarnikUnos" }
 *       responses:
 *         "201": { description: Interesovanje je kreirano. }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *   /api/interesovanja/{id}:
 *     get:
 *       tags: [Interesovanja]
 *       summary: Jedno interesovanje
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       responses:
 *         "200": { description: Interesovanje. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *     patch:
 *       tags: [Interesovanja]
 *       summary: Izmena interesovanja (profesor)
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       requestBody:
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SifarnikUnos" }
 *       responses:
 *         "200": { description: Interesovanje je izmenjeno. }
 *     delete:
 *       tags: [Interesovanja]
 *       summary: Brisanje interesovanja (nije dozvoljeno ako je u upotrebi)
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       responses:
 *         "200": { description: Interesovanje je obrisano. }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *
 *   /api/profil:
 *     get:
 *       tags: [Profil]
 *       summary: Moj profil sa interesovanjima
 *       security: [{ bearerAuth: [] }]
 *       responses:
 *         "200":
 *           description: Profil.
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   profil: { $ref: "#/components/schemas/Profil" }
 *         "401": { $ref: "#/components/responses/Neprijavljen" }
 *     patch:
 *       tags: [Profil]
 *       summary: Izmena sopstvenog profila (uloga se ne može menjati)
 *       security: [{ bearerAuth: [] }]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ime_i_prezime: { type: string }
 *                 razred_odeljenje: { type: string, nullable: true }
 *                 korisnicko_ime: { type: string, nullable: true }
 *                 biografija: { type: string, nullable: true }
 *                 avatar_url: { type: string, nullable: true }
 *                 interesovanja_ids: { type: array, items: { type: integer } }
 *             example:
 *               razred_odeljenje: 2-1
 *               interesovanja_ids: [1, 2]
 *       responses:
 *         "200": { description: Profil je ažuriran. }
 *         "400": { $ref: "#/components/responses/NeispravanZahtev" }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *   /api/profil/interesovanja:
 *     get:
 *       tags: [Profil]
 *       summary: Moja interesovanja
 *       security: [{ bearerAuth: [] }]
 *       responses:
 *         "200": { description: Lista interesovanja. }
 *     put:
 *       tags: [Profil]
 *       summary: Postavljanje mojih interesovanja (zamenjuje postojeća)
 *       security: [{ bearerAuth: [] }]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [interesovanja_ids]
 *               properties:
 *                 interesovanja_ids: { type: array, items: { type: integer }, example: [1, 2] }
 *       responses:
 *         "200": { description: Interesovanja su sačuvana. }
 *         "400": { $ref: "#/components/responses/NeispravanZahtev" }
 *
 *   /api/moje-prijave/raspored:
 *     get:
 *       tags: [Raspored i istorija]
 *       summary: Moj nedeljni raspored (potvrđene prijave)
 *       security: [{ bearerAuth: [] }]
 *       responses:
 *         "200":
 *           description: Stavke rasporeda sortirane po danu i vremenu.
 *           content:
 *             application/json:
 *               example:
 *                 raspored:
 *                   - dan_u_nedelji: 3
 *                     dan: Sreda
 *                     vreme_od: "14:00:00"
 *                     vreme_do: "15:30:00"
 *                     prostorija: { id: 3, naziv: Muzička učionica, kapacitet: 24 }
 *                     aktivnost_id: 12
 *                     naziv: Školski hor
 *                 bez_strukturisanog_termina: []
 *         "403": { $ref: "#/components/responses/Zabranjeno" }
 *   /api/moje-prijave/istorija:
 *     get:
 *       tags: [Raspored i istorija]
 *       summary: Istorija aktivnosti (sve prijave, uključujući otkazane) sa prisustvom
 *       security: [{ bearerAuth: [] }]
 *       responses:
 *         "200": { description: Istorija. }
 *         "403": { $ref: "#/components/responses/Zabranjeno" }
 *
 *   /api/obavestenja:
 *     get:
 *       tags: [Obaveštenja]
 *       summary: Moja obaveštenja (promene termina, prijave, otkazivanja)
 *       description: Zahteva SQL migraciju 004.
 *       security: [{ bearerAuth: [] }]
 *       parameters:
 *         - name: neprocitana
 *           in: query
 *           schema: { type: boolean }
 *         - name: limit
 *           in: query
 *           schema: { type: integer, maximum: 200 }
 *       responses:
 *         "200":
 *           description: Obaveštenja.
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   obavestenja: { type: array, items: { $ref: "#/components/schemas/Obavestenje" } }
 *                   broj_neprocitanih: { type: integer }
 *         "503": { $ref: "#/components/responses/MigracijaPotrebna" }
 *   /api/obavestenja/procitaj-sve:
 *     patch:
 *       tags: [Obaveštenja]
 *       summary: Označi sva obaveštenja kao pročitana
 *       security: [{ bearerAuth: [] }]
 *       responses:
 *         "200": { description: Označeno. }
 *   /api/obavestenja/{id}/procitano:
 *     patch:
 *       tags: [Obaveštenja]
 *       summary: Označi obaveštenje kao pročitano
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       responses:
 *         "200": { description: Označeno. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *   /api/obavestenja/{id}:
 *     delete:
 *       tags: [Obaveštenja]
 *       summary: Brisanje obaveštenja
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       responses:
 *         "200": { description: Obrisano. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *
 *   /api/prisustva/skeniraj:
 *     post:
 *       tags: [Prisustvo]
 *       summary: Učenik potvrđuje prisustvo skeniranjem QR koda
 *       security: [{ bearerAuth: [] }]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [kod]
 *               properties:
 *                 kod: { type: string, example: VA1.eyJh...potpis }
 *       responses:
 *         "201":
 *           description: Prisustvo je evidentirano (200 ako je već bilo evidentirano).
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   poruka: { type: string }
 *                   prisustvo: { $ref: "#/components/schemas/Prisustvo" }
 *         "400": { description: QR kod nije ispravan ili je istekao. }
 *         "403": { description: Učenik nije prijavljen na aktivnost. }
 *   /api/prisustva:
 *     get:
 *       tags: [Prisustvo]
 *       summary: Evidencija prisustva za aktivnost (profesor)
 *       security: [{ bearerAuth: [] }]
 *       parameters:
 *         - name: aktivnost_id
 *           in: query
 *           required: true
 *           schema: { type: integer }
 *         - name: datum
 *           in: query
 *           schema: { type: string, format: date }
 *       responses:
 *         "200": { description: Lista prisustva sa učenicima. }
 *         "403": { $ref: "#/components/responses/Zabranjeno" }
 *     post:
 *       tags: [Prisustvo]
 *       summary: Ručna evidencija prisustva (profesor)
 *       security: [{ bearerAuth: [] }]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [prijava_id]
 *               properties:
 *                 prijava_id: { type: integer }
 *                 datum: { type: string, format: date }
 *                 prisutan: { type: boolean, default: true }
 *       responses:
 *         "201": { description: Evidentirano. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *   /api/prisustva/{id}:
 *     patch:
 *       tags: [Prisustvo]
 *       summary: Izmena evidencije prisustva (profesor)
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       requestBody:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 prisutan: { type: boolean }
 *                 datum: { type: string, format: date }
 *       responses:
 *         "200": { description: Izmenjeno. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *     delete:
 *       tags: [Prisustvo]
 *       summary: Brisanje evidencije prisustva (profesor)
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       responses:
 *         "200": { description: Obrisano. }
 *
 *   /api/ai/preporuke:
 *     post:
 *       tags: [AI asistent]
 *       summary: AI preporuka aktivnosti na osnovu opisa učenika
 *       description: |
 *         Učenik tekstualno ili glasovno (govor pretvoren u tekst na uređaju) opisuje sposobnosti,
 *         interesovanja i ciljeve. Preporuke se biraju isključivo iz stvarnih aktivnosti u bazi
 *         (aktivne, sa slobodnim mestima, na koje učenik još nije prijavljen), uz obrazloženje.
 *         Ako je podešen `ANTHROPIC_API_KEY`, koristi se Claude; u suprotnom lokalni algoritam.
 *         Preporuke su dostupne isključivo učeniku kome pripadaju.
 *       security: [{ bearerAuth: [] }]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [tekst]
 *               properties:
 *                 tekst: { type: string, minLength: 3, maxLength: 2000 }
 *                 izvor: { type: string, enum: [tekst, glas], default: tekst }
 *             example:
 *               tekst: Volim programiranje i robote, a želeo bih i da se bavim sportom.
 *               izvor: glas
 *       responses:
 *         "201":
 *           description: Preporuka.
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   preporuka: { $ref: "#/components/schemas/AiPreporuka" }
 *         "400": { $ref: "#/components/responses/NeispravanZahtev" }
 *         "403": { $ref: "#/components/responses/Zabranjeno" }
 *     get:
 *       tags: [AI asistent]
 *       summary: Istorija mojih AI preporuka
 *       security: [{ bearerAuth: [] }]
 *       responses:
 *         "200": { description: Lista preporuka. }
 *   /api/ai/preporuke/{id}:
 *     get:
 *       tags: [AI asistent]
 *       summary: Jedna moja preporuka
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       responses:
 *         "200": { description: Preporuka. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *     delete:
 *       tags: [AI asistent]
 *       summary: Brisanje moje preporuke
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       responses:
 *         "200": { description: Obrisano. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *
 *   /api/admin/ucenici:
 *     get:
 *       tags: [Admin]
 *       summary: Lista učenika
 *       security: [{ bearerAuth: [] }]
 *       parameters:
 *         - name: q
 *           in: query
 *           schema: { type: string }
 *         - name: razred
 *           in: query
 *           schema: { type: string }
 *       responses:
 *         "200": { description: Učenici sa brojem aktivnih prijava. }
 *         "403": { $ref: "#/components/responses/Zabranjeno" }
 *     post:
 *       tags: [Admin]
 *       summary: Kreiranje naloga učenika
 *       security: [{ bearerAuth: [] }]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [ime_i_prezime, email, lozinka]
 *               properties:
 *                 ime_i_prezime: { type: string }
 *                 email: { type: string, format: email }
 *                 lozinka: { type: string, minLength: 8 }
 *                 razred_odeljenje: { type: string }
 *                 interesovanja_ids: { type: array, items: { type: integer } }
 *       responses:
 *         "201": { description: Učenik je kreiran. }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *   /api/admin/ucenici/{id}:
 *     get:
 *       tags: [Admin]
 *       summary: Detalji učenika (profil, interesovanja, prijave, prisustvo)
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/UcenikId" }]
 *       responses:
 *         "200": { description: Učenik. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *     patch:
 *       tags: [Admin]
 *       summary: Izmena podataka učenika
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/UcenikId" }]
 *       requestBody:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ime_i_prezime: { type: string }
 *                 razred_odeljenje: { type: string, nullable: true }
 *                 korisnicko_ime: { type: string, nullable: true }
 *                 biografija: { type: string, nullable: true }
 *                 interesovanja_ids: { type: array, items: { type: integer } }
 *       responses:
 *         "200": { description: Ažurirano. }
 *     delete:
 *       tags: [Admin]
 *       summary: Brisanje učenika (nije dozvoljeno dok ima aktivne prijave)
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/UcenikId" }]
 *       responses:
 *         "200": { description: Obrisano. }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *   /api/admin/prijave:
 *     get:
 *       tags: [Admin]
 *       summary: Sve prijave (filter po statusu i aktivnosti)
 *       security: [{ bearerAuth: [] }]
 *       parameters:
 *         - name: status
 *           in: query
 *           schema: { type: string, enum: [prijavljen, na_cekanju, otkazano] }
 *         - name: aktivnost_id
 *           in: query
 *           schema: { type: integer }
 *       responses:
 *         "200": { description: Prijave sa učenicima i aktivnostima. }
 *   /api/admin/statistika:
 *     get:
 *       tags: [Admin]
 *       summary: Statistički izveštaji
 *       description: Broj prijavljenih učenika, popularnost aktivnosti, iskorišćenost kapaciteta i redovnost prisustva.
 *       security: [{ bearerAuth: [] }]
 *       responses:
 *         "200":
 *           description: Statistika.
 *           content:
 *             application/json:
 *               example:
 *                 ukupno:
 *                   broj_ucenika: 120
 *                   broj_aktivnih_aktivnosti: 14
 *                   prijavljenih: 96
 *                   iskoriscenost_kapaciteta: 68.6
 *                   redovnost_prisustva: 91.2
 *                 najpopularnije_aktivnosti: []
 *                 po_aktivnostima: []
 *                 po_kategorijama: []
 *   /api/admin/zahtevi-za-profesora:
 *     get:
 *       tags: [Admin]
 *       summary: Zahtevi za profesorski nalog
 *       description: Zahteva SQL migraciju 003.
 *       security: [{ bearerAuth: [] }]
 *       parameters:
 *         - name: status
 *           in: query
 *           schema: { type: string, enum: [na_cekanju, odobren, odbijen] }
 *       responses:
 *         "200": { description: Zahtevi. }
 *         "503": { $ref: "#/components/responses/MigracijaPotrebna" }
 *   /api/admin/zahtevi-za-profesora/{id}:
 *     patch:
 *       tags: [Admin]
 *       summary: Odobravanje ili odbijanje zahteva za profesorski nalog
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/SifarnikId" }]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [status]
 *               properties:
 *                 status: { type: string, enum: [odobren, odbijen] }
 *       responses:
 *         "200": { description: Zahtev je obrađen. }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *
 *   /api/prostorije/{id}:
 *     get:
 *       tags: [Prostorije]
 *       summary: Prostorija sa terminima
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/ProstorijaId" }]
 *       responses:
 *         "200": { description: Prostorija. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 *     delete:
 *       tags: [Prostorije]
 *       summary: Brisanje prostorije (nije dozvoljeno ako ima termine)
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/ProstorijaId" }]
 *       responses:
 *         "200": { description: Obrisano. }
 *         "409": { $ref: "#/components/responses/Konflikt" }
 *   /api/prostorije/{id}/dostupnost:
 *     get:
 *       tags: [Prostorije]
 *       summary: Provera dostupnosti prostorije u zadatom terminu
 *       security: [{ bearerAuth: [] }]
 *       parameters:
 *         - $ref: "#/components/parameters/ProstorijaId"
 *         - { name: dan, in: query, required: true, schema: { type: integer, minimum: 1, maximum: 7 } }
 *         - { name: vreme_od, in: query, required: true, schema: { type: string, example: "14:00" } }
 *         - { name: vreme_do, in: query, required: true, schema: { type: string, example: "15:30" } }
 *       responses:
 *         "200":
 *           description: Rezultat provere.
 *           content:
 *             application/json:
 *               example: { dostupna: false, preklapanja: [{ id: 5, dan_u_nedelji: 3, vreme_od: "14:00:00", vreme_do: "15:30:00", prostorija_id: 3 }] }
 *   /api/termini/{id}:
 *     get:
 *       tags: [Termini]
 *       summary: Termin sa aktivnostima koje ga koriste
 *       security: [{ bearerAuth: [] }]
 *       parameters: [{ $ref: "#/components/parameters/TerminId" }]
 *       responses:
 *         "200": { description: Termin. }
 *         "404": { $ref: "#/components/responses/NijePronadjeno" }
 */
