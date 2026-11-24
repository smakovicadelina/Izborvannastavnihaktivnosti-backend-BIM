# Backend – Izbor vannastavnih aktivnosti

REST API za mobilnu aplikaciju (React Native) za izbor vannastavnih aktivnosti.

| | |
|---|---|
| Jezik / framework | Node.js + Express 5 |
| Baza podataka | Supabase (PostgreSQL) preko `@supabase/supabase-js` |
| Autentifikacija | Supabase Auth (JWT access + refresh token) |
| Dokumentacija API-ja | Swagger UI – `http://localhost:3000/api-docs` |
| Testiranje | Postman kolekcija (`postman/`) + automatski testovi (`npm test`) |

Detaljno objašnjenje arhitekture, toka zahteva i baze: **[docs/ODBRANA.md](docs/ODBRANA.md)**.

## Pokretanje

```bash
npm install
cp .env.example .env    # upisati SUPABASE_URL, SUPABASE_ANON_KEY i SUPABASE_SERVICE_ROLE_KEY
npm run dev             # razvoj (automatski restart); produkcija: npm start
npm test                # automatski testovi (ne zahtevaju bazu)
```

Provera: `GET http://localhost:3000/api/health` → `{ "status": "ok" }`.

> `.env` je u `.gitignore` i **nikada** se ne commit-uje. `SUPABASE_SERVICE_ROLE_KEY` zaobilazi
> Row Level Security i sme da postoji samo na serveru – nikada u mobilnoj aplikaciji.

## Struktura projekta

```
src/
├── server.js            # ulazna tačka: učitava .env i pokreće server (app.listen)
├── app.js               # konfiguracija Express aplikacije: middleware, rute, 404, greške
├── config/
│   ├── supabase.js      # Supabase klijenti (auth + baza) iz .env promenljivih
│   ├── cors.js          # dozvoljeni web domeni
│   └── swagger.js       # OpenAPI specifikacija
├── routes/              # URL + HTTP metoda → lanac middleware-a → kontroler
│   └── index.js         # povezuje sve grupe ruta pod /api
├── middleware/
│   ├── zahtevajPrijavu.js   # autentifikacija (provera Bearer tokena)
│   ├── zahtevajUlogu.js     # autorizacija (ucenik / profesor)
│   ├── validiraj.js         # validacija ulaza → req.podaci
│   ├── nepostojecaRuta.js   # 404
│   └── errorHandler.js      # centralna obrada grešaka → JSON
├── validators/          # pravila validacije po modulu (obavezna polja, tipovi, dozvoljene vrednosti)
├── controllers/         # prima zahtev, poziva servis, vraća status + JSON
├── services/            # poslovna logika + komunikacija sa Supabase bazom
├── utils/               # pomoćne funkcije (greške, upiti, vreme, tekst)
└── docs/                # Swagger (@openapi) opisi ruta
supabase/
├── schema.sql           # kompletna šema baze (svi entiteti, PK/FK, RPC funkcija)
├── migrations/          # inkrementalne migracije 001–004
└── operations/          # ručne SQL operacije (odobravanje zahteva za profesora)
postman/                 # Postman kolekcija + environment
test/                    # automatski testovi (node --test)
```

## Baza podataka

Pokrenuti u Supabase SQL Editoru: za novu bazu `supabase/schema.sql`, a zatim migracije
`001`–`004` (dodaju i ograničenja kao što je zabrana preklapanja termina).

Glavni entiteti: **korisnik** (učenik/profesor), **aktivnost**, **prijava**, **kategorija**,
**interesovanje**, **prostorija**, **termin**, **prisustvo**, **obaveštenje**, **AI preporuka**.
ER dijagram i objašnjenje relacija: [docs/ODBRANA.md](docs/ODBRANA.md#5-baza-podataka-entiteti-i-relacije).

## Testiranje u Postmanu

1. Postman → **Import** → oba fajla iz foldera `postman/`.
2. Izabrati environment **Lokalno (localhost:3000)** i upisati `profesorEmail`/`profesorLozinka`
   (nalog sa ulogom profesor) i `ucenikEmail`/`ucenikLozinka` (nalog sa ulogom učenik).
3. `npm run dev`, pa **Run collection**.

Kolekcija redom: prijava → CRUD nad svim entitetima → prijave → prisustvo → … → čišćenje.
Tokeni i ID-jevi se automatski čuvaju između zahteva, a svaki zahtev ima testove statusa.
Uključeni su i negativni slučajevi: 400 (validacija), 401 (bez tokena), 403 (pogrešna uloga),
404 i 409 (poslovna pravila).

## Uloge

- **ucenik** – pregled, pretraga i filtriranje aktivnosti, prijava/otkazivanje, raspored i istorija,
  obaveštenja, QR prisustvo, AI preporuke, profil i interesovanja. Vidi isključivo svoje podatke.
- **profesor** – pun CRUD nad aktivnostima, kategorijama, interesovanjima, prostorijama, terminima,
  prijavama, prisustvom i učenicima, plus statistika i odobravanje profesorskih naloga.

Novi nalog uvek dobija ulogu `ucenik`; profesorski nalog se dobija tek kada postojeći profesor
odobri zahtev (`PATCH /api/admin/zahtevi-za-profesora/:id`).

## Pregled ruta

| Oblast | Rute |
|---|---|
| Autentifikacija | `POST /api/auth/registracija`, `POST /api/auth/prijava`, `POST /api/auth/osvezi-token`, `POST /api/auth/odjava`, `GET /api/auth/me`, `GET/POST /api/auth/zahtev-za-profesora` |
| Aktivnosti | `GET /api/aktivnosti?q=&kategorija_id=&interesovanje_id=&moja_interesovanja=&dan=&samo_slobodna=`, `GET /api/aktivnosti/:id`, `POST`, `PATCH /:id`, `DELETE /:id`, `PATCH /:id/deaktiviraj`, `PATCH /:id/aktiviraj`, `GET /:id/qr` |
| Prijave | učenik: `POST/DELETE /api/aktivnosti/:id/prijava`; profesor: `GET/POST /api/aktivnosti/:id/prijave`, `PATCH/DELETE /api/aktivnosti/:id/prijave/:prijavaId` |
| Raspored i istorija | `GET /api/moje-prijave`, `GET /api/moje-prijave/raspored`, `GET /api/moje-prijave/istorija` |
| Šifarnici | `/api/kategorije`, `/api/interesovanja` (GET javno, POST/PATCH/DELETE profesor) |
| Prostorije i termini | `/api/prostorije` (+ `/:id/dostupnost`), `/api/termini` |
| Profil | `GET/PATCH /api/profil`, `GET/PUT /api/profil/interesovanja` |
| Obaveštenja | `GET /api/obavestenja`, `PATCH /api/obavestenja/:id/procitano`, `PATCH /api/obavestenja/procitaj-sve`, `DELETE /api/obavestenja/:id` |
| Prisustvo (QR) | učenik: `POST /api/prisustva/skeniraj`; profesor: `GET/POST /api/prisustva`, `PATCH/DELETE /api/prisustva/:id` |
| AI asistent | `POST/GET /api/ai/preporuke`, `GET/DELETE /api/ai/preporuke/:id` |
| Admin | `/api/admin/ucenici` (CRUD), `/api/admin/prijave`, `/api/admin/statistika`, `/api/admin/zahtevi-za-profesora` |

## Format odgovora i statusni kodovi

Svi odgovori su JSON. Greška uvek ima oblik `{ "greska": "opis greške" }`.

| Status | Značenje |
|---|---|
| 200 OK / 201 Created | uspešno čitanje/izmena / uspešno kreiranje |
| 400 Bad Request | neispravni podaci (validacija) ili neispravan JSON |
| 401 Unauthorized | nema tokena ili je token nevažeći/istekao |
| 403 Forbidden | korisnik nema potrebnu ulogu |
| 404 Not Found | zapis ili ruta ne postoji |
| 409 Conflict | krši poslovno pravilo (nema mesta, preklapanje termina, duplikat…) |
| 500 / 503 | greška na serveru / baza nije ažurirana (nedostaje migracija) |

## Pravila koja sistem automatski proverava

- prostorija ne može imati dva termina koja se preklapaju; aktivnost ne može dobiti termin koji već koristi druga aktivna aktivnost;
- broj mesta aktivnosti ne sme premašiti kapacitet prostorije, niti pasti ispod broja prijavljenih;
- učenik ne može da se prijavi ako nema slobodnih mesta, ako je već prijavljen ili ako se termin preklapa sa njegovim rasporedom;
- brisanje nije dozvoljeno kada bi narušilo integritet (aktivnost sa prijavama, termin vezan za aktivnost, prostorija sa terminima, kategorija/interesovanje u upotrebi, učenik sa aktivnim prijavama).

## AI asistent

Učenik šalje tekst (glasovni unos se pretvara u tekst na uređaju, `izvor: "glas"`). Preporuke se biraju
samo iz stvarnih aktivnih aktivnosti sa slobodnim mestima, uz obrazloženje, i čuvaju se u `ai_preporuke`.
Sa `ANTHROPIC_API_KEY` koristi se Claude (`claude-opus-5-5`), a bez njega ugrađeni lokalni algoritam.
