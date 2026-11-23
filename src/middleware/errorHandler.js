const { HttpGreska, tabelaNedostaje } = require("../utils/http");

function errorHandler(err, req, res, next) {
  if (err instanceof HttpGreska) {
    return res.status(err.status).json({
      greska: err.message,
      ...(err.dodatno || {})
    });
  }

  if (tabelaNedostaje(err)) {
    console.error("Nedostaje tabela u bazi:", err.message);
    return res.status(503).json({
      greska: "Baza nije ažurirana. Pokrenite SQL migracije iz foldera supabase/migrations."
    });
  }

  if (["22P02", "22003", "22007", "22008", "PGRST100"].includes(err.code)) {
    return res.status(400).json({
      greska: "Neispravan format podataka."
    });
  }

  if (err.code === "23P01") {
    return res.status(409).json({
      greska: "Termin se preklapa sa postojećim terminom u istoj prostoriji."
    });
  }

  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    "body" in err
  ) {
    return res.status(400).json({
      greska: "Telo zahteva nije ispravan JSON."
    });
  }

  if (err.message === "CORS_ORIGIN_NOT_ALLOWED") {
    return res.status(403).json({
      greska: "Pristup nije dozvoljen."
    });
  }

  if (err.code === "42501") {
    return res.status(403).json({
      greska: "Nemate dozvolu za ovu radnju."
    });
  }

  if (err.code === "23503") {
    return res.status(409).json({
      greska: "Povezani podaci ne postoje ili se ne mogu ukloniti."
    });
  }

  if (err.code === "23505") {
    return res.status(409).json({
      greska: "Takav zapis već postoji."
    });
  }

  if (
    err.code === "23514" ||
    err.code === "P0001" ||
    err.code === "23P01"
  ) {
    return res.status(409).json({
      greska: "Radnja nije dozvoljena zbog ograničenja sistema."
    });
  }

  if (err.status === 413) {
    return res.status(413).json({
      greska: "Zahtev je prevelik."
    });
  }

  console.error("Greška na serveru:", err);

  return res.status(500).json({
    greska: "Došlo je do greške na serveru."
  });
}

module.exports = errorHandler;
