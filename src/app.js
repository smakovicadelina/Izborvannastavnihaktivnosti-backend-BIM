// KONFIGURACIJA EXPRESS APLIKACIJE.
//
// Redosled je bitan - svaki zahtev prolazi kroz middleware-e redom kojim su
// registrovani:
//   1. cors            - dozvoljeni web domeni
//   2. express.json    - parsira JSON telo zahteva u req.body
//   3. rute (/api/...) - ruta -> [auth] -> [uloga] -> [validacija] -> kontroler -> servis -> Supabase
//   4. nepostojecaRuta - 404 ako nijedna ruta nije odgovorila
//   5. errorHandler    - svaka greska zavrsava ovde kao JSON odgovor
//
// Aplikacija se ovde samo konfigurise; server se pokrece u server.js.
// Tako testovi mogu da koriste "app" bez otvaranja porta.

const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

const corsOpcije = require("./config/cors");
const swaggerSpec = require("./config/swagger");
const apiRute = require("./routes");
const nepostojecaRuta = require("./middleware/nepostojecaRuta");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.disable("x-powered-by"); // ne otkrivamo da server koristi Express

// --- Globalni middleware ----------------------------------------------------
app.use(cors(corsOpcije));
app.use(express.json({ limit: "1mb" }));

// --- Opste rute -------------------------------------------------------------
app.get("/", (req, res) => {
  return res.status(200).json({
    poruka: "API za vannastavne aktivnosti je pokrenut.",
    verzija: swaggerSpec.info.version,
    dokumentacija: "/api-docs"
  });
});

app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: { persistAuthorization: false }
  })
);

// --- API rute ---------------------------------------------------------------
app.use("/api", apiRute);

// --- 404 i obrada gresaka (UVEK na kraju) -----------------------------------
app.use(nepostojecaRuta);
app.use(errorHandler);

module.exports = app;
