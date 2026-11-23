# Backend – Izbor vannastavnih aktivnosti

REST API (Node.js + Express 5 + Supabase) za aplikaciju za izbor vannastavnih aktivnosti.
Kompletna interaktivna dokumentacija svih ruta: **`http://localhost:3000/api-docs`**.

## Pokretanje

```bash
npm install
cp .env.example .env   # popuniti Supabase ključeve
npm run dev            # ili: npm start
npm test
```

> Ako `http://127.0.0.1:3000` vraća `{"error":"Nepoznata ruta."}`, na istom portu radi neka
> druga aplikacija. Ugasite je ili promenite `PORT` u `.env`.

## SQL migracije (Supabase → SQL Editor, redom)

| Fajl | Šta dodaje | Bez nje |
|---|---|---|
| `001_prostorije.sql`, `002_termini.sql` | prostorije, termini, zabrana preklapanja | – (već primenjeno) |
| `003_professor_account_requests.sql` | zahtevi za profesorski nalog | registracija sa `uloga: "profesor"` i `/api/admin/zahtevi-za-profesora` vraćaju 503 |
| `004_obavestenja_interesovanja_prisustvo.sql` | obaveštenja, veza aktivnost–interesovanje, jedinstveno prisustvo po danu | `/api/obavestenja` vraća 503, obaveštenja se ne šalju, `interesovanja_ids` na aktivnosti vraća 503 |

## Uloge

- **ucenik** – pregled, pretraga i filtriranje aktivnosti, prijava/otkazivanje, raspored i istorija,
  obaveštenja, QR prisustvo, AI preporuke, uređivanje profila i interesovanja. Vidi isključivo svoje podatke.
- **profesor** – ima administratorska ovlašćenja: pun CRUD nad aktivnostima, kategorijama,
  interesovanjima, prostorijama, terminima, prijavama, prisustvom i učenicima, plus statistika.

## Pregled ruta

| Oblast | Rute |
|---|---|
| Autentifikacija | `POST /api/auth/registracija`, `POST /api/auth/prijava`, `POST /api/auth/osvezi-token`, `POST /api/auth/odjava`, `GET /api/auth/me`, `GET/POST /api/auth/zahtev-za-profesora` |
| Aktivnosti | `GET /api/aktivnosti?q=&kategorija_id=&interesovanje_id=&moja_interesovanja=&dan=&samo_slobodna=`, `GET /api/aktivnosti/:id`, `POST`, `PATCH /:id`, `DELETE /:id`, `PATCH /:id/deaktiviraj`, `PATCH /:id/aktiviraj` |
| Prijave | učenik: `POST/DELETE /api/aktivnosti/:id/prijava`; profesor: `GET/POST /api/aktivnosti/:id/prijave`, `PATCH/DELETE /api/aktivnosti/:id/prijave/:prijavaId` |
| Raspored i istorija | `GET /api/moje-prijave`, `GET /api/moje-prijave/raspored`, `GET /api/moje-prijave/istorija` |
| Šifarnici | `/api/kategorije`, `/api/interesovanja` (GET javno, POST/PATCH/DELETE profesor) |
| Prostorije i termini | `/api/prostorije` (+ `/:id/dostupnost`), `/api/termini` |
| Profil | `GET/PATCH /api/profil`, `GET/PUT /api/profil/interesovanja` |
| Obaveštenja | `GET /api/obavestenja`, `PATCH /api/obavestenja/:id/procitano`, `PATCH /api/obavestenja/procitaj-sve`, `DELETE /api/obavestenja/:id` |
| Prisustvo (QR) | profesor: `GET /api/aktivnosti/:id/qr`; učenik: `POST /api/prisustva/skeniraj`; profesor: `GET/POST /api/prisustva`, `PATCH/DELETE /api/prisustva/:id` |
| AI asistent | `POST/GET /api/ai/preporuke`, `GET/DELETE /api/ai/preporuke/:id` |
| Admin | `/api/admin/ucenici` (CRUD), `/api/admin/prijave`, `/api/admin/statistika`, `/api/admin/zahtevi-za-profesora` |

## Pravila koja sistem automatski proverava

- prostorija ne može imati dva termina koja se preklapaju; aktivnost ne može dobiti termin koji već koristi druga aktivna aktivnost;
- broj mesta aktivnosti ne sme premašiti kapacitet prostorije, niti pasti ispod broja prijavljenih;
- učenik ne može da se prijavi ako nema slobodnih mesta, ako je već prijavljen ili ako se termin preklapa sa njegovim rasporedom;
- brisanje nije dozvoljeno kada bi narušilo integritet (aktivnost sa prijavama, termin vezan za aktivnost, prostorija sa terminima, kategorija/interesovanje u upotrebi, učenik sa aktivnim prijavama).

## AI asistent

Učenik šalje tekst (glasovni unos se pretvara u tekst na uređaju, `izvor: "glas"`). Preporuke se biraju
samo iz stvarnih aktivnih aktivnosti sa slobodnim mestima, uz obrazloženje, i čuvaju se u `ai_preporuke`.
Sa `ANTHROPIC_API_KEY` koristi se Claude (`claude-opus-5-5`), a bez njega ugrađeni lokalni algoritam.

## Kamera / mikrofon / galerija

Dozvole i uvodni ekrani su odgovornost mobilnog frontenda. Backend za kameru obezbeđuje QR kod
(`GET /api/aktivnosti/:id/qr` → frontend ga prikazuje kao QR sliku), za galeriju polja `avatar_url` i
`slika_url`, a za mikrofon prihvata prepoznat tekst u AI asistentu.
