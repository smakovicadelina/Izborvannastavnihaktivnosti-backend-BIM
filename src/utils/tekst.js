// Normalizacija teksta za pretragu: mala slova, bez dijakritika (č -> c, đ -> dj).
function normalizuj(tekst) {
  return String(tekst || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "dj");
}

module.exports = { normalizuj };
