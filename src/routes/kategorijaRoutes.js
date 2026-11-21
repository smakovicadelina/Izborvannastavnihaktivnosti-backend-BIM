
const napraviSifarnikRouter = require("./sifarnikRouter");

module.exports = napraviSifarnikRouter({
  tabela: "kategorije",
  kljucListe: "kategorije",
  kljucJednog: "kategorija",
  naziv: "Kategorija",
  koriscenje: [
    {
      tabela: "aktivnosti",
      kolona: "kategorija_id",
      poruka: "Kategorija je dodeljena aktivnostima i ne može se obrisati."
    }
  ]
});
