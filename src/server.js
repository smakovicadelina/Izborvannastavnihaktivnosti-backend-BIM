require('dotenv').config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const aktivnostRoutes = require('./routes/aktivnostRoutes');

const app = express();

const dozvoljeniOrigin =
  process.env.CORS_ORIGIN
    ?.split(',')
    .map(origin => origin.trim())
    .filter(Boolean) || null;

app.use(cors({
  origin: dozvoljeniOrigin ? (origin, callback) => {
    if (!origin || dozvoljeniOrigin.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  } : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    poruka: "Backend server radi!"
  });
});

app.get('/', (req, res) => res.json({ poruka: 'API je pokrenut.' }));
app.use('/api/auth', authRoutes);
app.use('/api/aktivnosti', aktivnostRoutes);

app.use((req, res) => {
  return res.status(404).json({ greska: 'Ruta nije pronađena.' });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ greska: 'Telo zahteva nije ispravan JSON.' });
  }
  console.error('Neočekivana greška:', err);

  if (err.code === '42501') {
    return res.status(403).json({ greska: 'Nemate dozvolu za ovu radnju.' });
  }
  if (err.code === '23505' || err.code === 'P0001' || err.code === '23514') {
    return res.status(409).json({
      greska: 'Radnja nije moguća zbog duplikata ili ograničenja kapaciteta.'
    });
  }

  return res.status(500).json({ greska: 'Došlo je do greške na serveru.' });
});

const port = Number(process.env.PORT) || 3000;
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server je pokrenut: http://localhost:${port}`);
  });
}

module.exports = app;
