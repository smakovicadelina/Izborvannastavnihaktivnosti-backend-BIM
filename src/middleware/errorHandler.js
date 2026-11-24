// CENTRALNA OBRADA GRESAKA.
//
// Express prepoznaje error-handling middleware po tome sto ima 4 parametra
// (err, req, res, next). Ovde stize svaka greska koja je:
//   - bacena u async kontroleru/servisu (Express 5 je automatski hvata), ili
//   - prosledjena sa next(greska) iz middleware-a.
// Rezultat je uvek JSON oblika { "greska": "poruka" } sa odgovarajucim HTTP statusom.

const { HttpGreska, tabelaNedostaje } = require("../utils/http");

// PostgreSQL / PostgREST kodovi gresaka -> HTTP status + poruka za klijenta.
const POSTGRES_GRESKE = {
  "22P02": [400, "Neispravan format podataka."],      // npr. tekst umesto broja
  "22003": [400, "Neispravan format podataka."],      // broj van opsega
  "22007": [400, "Neispravan format podataka."],      // neispravan datum/vreme
  "22008": [400, "Neispravan format podataka."],
  PGRST100: [400, "Neispravan format podataka."],
  "23505": [409, "Takav zapis već postoji."],         // UNIQUE ogranicenje
  "23503": [409, "Povezani podaci ne postoje ili se ne mogu ukloniti."], // FOREIGN KEY
  "23P01": [409, "Termin se preklapa sa postojećim terminom u istoj prostoriji."], // EXCLUDE
  "23514": [409, "Radnja nije dozvoljena zbog ograničenja sistema."],   // CHECK
  P0001: [409, "Radnja nije dozvoljena zbog ograničenja sistema."],     // RAISE EXCEPTION
  "42501": [403, "Nemate dozvolu za ovu radnju."]     // nedovoljna prava (RLS)
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // 1) Nase "ocekivane" greske: greska(404, "Aktivnost nije pronađena.")
  if (err instanceof HttpGreska) {
    return res.status(err.status).json({
      greska: err.message,
      ...(err.dodatno || {})
    });
  }

  // 2) Neispravan JSON u telu zahteva (baca ga express.json())
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ greska: "Telo zahteva nije ispravan JSON." });
  }

  // 3) Preveliko telo zahteva (limit u express.json())
  if (err.status === 413 || err.type === "entity.too.large") {
    return res.status(413).json({ greska: "Zahtev je prevelik." });
  }

  // 4) Zahtev sa domena koji nije dozvoljen CORS podesavanjima
  if (err.message === "CORS_ORIGIN_NOT_ALLOWED") {
    return res.status(403).json({ greska: "Pristup nije dozvoljen." });
  }

  // 5) Tabela ne postoji - nije pokrenuta SQL migracija
  if (tabelaNedostaje(err)) {
    console.error("Nedostaje tabela u bazi:", err.message);
    return res.status(503).json({
      greska: "Baza nije ažurirana. Pokrenite SQL migracije iz foldera supabase/migrations."
    });
  }

  // 6) Greske iz baze (Supabase/PostgreSQL)
  if (err.code && POSTGRES_GRESKE[err.code]) {
    const [status, poruka] = POSTGRES_GRESKE[err.code];
    return res.status(status).json({ greska: poruka });
  }

  // 7) Sve ostalo je neocekivana greska: detalje logujemo na serveru,
  //    a klijentu ne otkrivamo interne informacije.
  console.error("Greška na serveru:", err);
  return res.status(500).json({ greska: "Došlo je do greške na serveru." });
}

module.exports = errorHandler;
