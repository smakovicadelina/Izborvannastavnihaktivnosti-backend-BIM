// ULAZNA TACKA BACKENDA: `npm start` / `npm run dev` pokrece ovaj fajl.
//
// 1. dotenv ucitava promenljive iz .env u process.env (PORT, Supabase kljucevi...)
//    - mora biti PRE require("./app"), jer config/supabase.js cita process.env.
// 2. app.listen otvara HTTP server na zadatom portu.

require("dotenv").config();

const app = require("./app");

const port = Number(process.env.PORT) || 3000;

// Bez navedenog hosta server slusa na svim mreznim interfejsima, pa je dostupan
// i sa drugih uredjaja u mrezi (npr. telefon sa Expo Go: http://<IP-racunara>:3000/api).
app.listen(port, () => {
  console.log("----------------------------------");
  console.log("Backend je uspešno pokrenut.");
  console.log(`Adresa:       http://localhost:${port}`);
  console.log(`Health:       http://localhost:${port}/api/health`);
  console.log(`Dokumentacija: http://localhost:${port}/api-docs`);
  console.log("----------------------------------");
});
