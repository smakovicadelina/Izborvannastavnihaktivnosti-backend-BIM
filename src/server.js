
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const aktivnostRoutes = require("./routes/aktivnostRoutes");
const mojePrijaveRoutes = require("./routes/mojePrijaveRoutes");
const prostorijaRoutes = require("./routes/prostorijaRoutes");

const app = express();

app.disable("x-powered-by");

const dozvoljeniOrigin = (
  process.env.CORS_ORIGIN ||
  process.env.FRONTEND_ORIGIN ||
  "http://localhost:5173"
)
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || dozvoljeniOrigin.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS_ORIGIN_NOT_ALLOWED"));
    },
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    poruka: "Backend server radi!"
  });
});

app.get("/", (req, res) => {
  return res.status(200).json({
    poruka: "API za vannastavne aktivnosti je pokrenut.",
    verzija: "1.2.0"
  });
});

// API RUTE
app.use("/api/auth", authRoutes);
app.use("/api/aktivnosti", aktivnostRoutes);
app.use("/api/moje-prijave", mojePrijaveRoutes);
app.use("/api/prostorije", prostorijaRoutes);

app.use((req, res) => {
  return res.status(404).json({
    greska: "Ruta nije pronađena."
  });
});

app.use((err, req, res, next) => {
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
    err.code === "P0001"
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
});

const port = Number(process.env.PORT) || 3000;

if (require.main === module) {
  app.listen(port, () => {
    console.log("----------------------------------");
    console.log("Backend je uspešno pokrenut.");
    console.log(`Adresa: http://localhost:${port}`);
    console.log(`Health: http://localhost:${port}/api/health`);
    console.log("----------------------------------");
  });
}

module.exports = app;
