// OpenAPI (Swagger) specifikacija, generisana iz @openapi komentara u src/docs/.
// Interaktivna dokumentacija: http://localhost:3000/api-docs

const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "API za vannastavne aktivnosti",
      version: "1.3.0",
      description:
        "REST API za vannastavne aktivnosti: aktivnosti, kategorije, interesovanja, prijave, raspored, obaveštenja, QR prisustvo, AI preporuke i administratorski panel. Za zaštićene rute unesite Supabase access token kroz dugme Authorize."
    },
    servers: [{ url: "/", description: "Trenutni server" }]
  },
  apis: [
    path.join(__dirname, "..", "docs", "openapi.js"),
    path.join(__dirname, "..", "docs", "openapi-prosirenje.js")
  ]
});

module.exports = swaggerSpec;
