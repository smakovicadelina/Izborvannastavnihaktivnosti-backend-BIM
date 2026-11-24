// Poslednji "obican" middleware: izvrsava se samo ako nijedna ruta
// nije odgovorila na zahtev, pa vraca 404 u JSON formatu.
function nepostojecaRuta(req, res) {
  return res.status(404).json({
    greska: "Ruta nije pronađena.",
    metoda: req.method,
    putanja: req.path
  });
}

module.exports = nepostojecaRuta;
