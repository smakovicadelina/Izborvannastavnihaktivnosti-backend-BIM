
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const authRoutes = require("./routes/authRoutes");
const aktivnostRoutes = require("./routes/aktivnostRoutes");
const mojePrijaveRoutes = require("./routes/mojePrijaveRoutes");
const prostorijaRoutes = require("./routes/prostorijaRoutes");
const terminRoutes = require("./routes/terminRoutes");
const kategorijaRoutes = require("./routes/kategorijaRoutes");
const interesovanjeRoutes = require("./routes/interesovanjeRoutes");
const profilRoutes = require("./routes/profilRoutes");
const obavestenjaRoutes = require("./routes/obavestenjaRoutes");
const prisustvoRoutes = require("./routes/prisustvoRoutes");
const aiRoutes = require("./routes/aiRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { HttpGreska, tabelaNedostaje } = require("./utils/http");
const app = express();
const port = Number(process.env.PORT) || 3000;

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "API za vannastavne aktivnosti",
      version: "1.2.0",
      description:
        "REST API za vannastavne aktivnosti: aktivnosti, kategorije, interesovanja, prijave, raspored, obaveštenja, QR prisustvo, AI preporuke i administratorski panel. Za zaštićene rute unesite Supabase access token kroz dugme Authorize."
    },
    servers: [
      {
        url: "/",
        description: "Trenutni server"
      }
    ]
  },
  apis: [
    path.join(__dirname, "openapi.js"),
    path.join(__dirname, "openapi-prosirenje.js")
  ],
});

app.disable("x-powered-by");

function normalizujOrigin(origin) {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

const konfigurisaniOrigini = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_ORIGIN
]
  .filter(Boolean)
  .flatMap(value => value.split(","));

const dozvoljeniOrigin = new Set([
  ...konfigurisaniOrigini,
  "http://localhost:5173",
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`
]
  .map(origin => normalizujOrigin(origin.trim()))
  .filter(Boolean));

const sviOrigini = konfigurisaniOrigini.some(o => o.trim() === "*");
const produkcija = process.env.NODE_ENV === "production";

// U razvoju dozvoljavamo localhost i lokalnu mrezu na bilo kom portu
// (Vite, Expo web, emulator, telefon u istoj mrezi...).
function lokalniOrigin(origin) {
  try {
    const { hostname, protocol } = new URL(origin);
    if (!["http:", "https:"].includes(protocol)) return false;
    return (
      hostname === "localhost" ||
      hostname === "[::1]" ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        sviOrigini ||
        dozvoljeniOrigin.has(normalizujOrigin(origin)) ||
        (!produkcija && lokalniOrigin(origin))
      ) {
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
app.get("/api/test-verzija", (req, res) => {
  res.json({ verzija: "NOVA_VERZIJA_37" });
});
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

app.get("/api-docs.json", (req, res) => {
  res.json(swaggerSpec);
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: false
    }
  })
);

// API RUTE
app.use("/api/auth", authRoutes);
app.use("/api/aktivnosti", aktivnostRoutes);
app.use("/api/moje-prijave", mojePrijaveRoutes);
app.use("/api/prostorije", prostorijaRoutes);
app.use("/api/termini", terminRoutes);
app.use("/api/kategorije", kategorijaRoutes);
app.use("/api/interesovanja", interesovanjeRoutes);
app.use("/api/profil", profilRoutes);
app.use("/api/obavestenja", obavestenjaRoutes);
app.use("/api/prisustva", prisustvoRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  return res.status(404).json({
    greska: "Ruta nije pronađena.",
    metoda: req.method,
    putanja: req.path
  });
});

app.use((err, req, res, next) => {
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
});

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
