const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const servidor = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(servidor);
const ARQ = path.join(__dirname, 'dados.json');
const CHAVES = ['cafezinho', 'palmaresQuest'];

let dados = {};
try { dados = JSON.parse(fs.readFileSync(ARQ, 'utf8')); } catch {}

let pendente = false;
function gravar() { // grava no máximo 1x por segundo
  if (pendente) return;
  pendente = true;
  setTimeout(() => {
    pendente = false;
    fs.writeFile(ARQ + '.tmp', JSON.stringify(dados), (e) => {
      if (!e) fs.rename(ARQ + '.tmp', ARQ, () => {});
    });
  }, 1000);
}
const limpa = (e) => String(e || '').trim().toLowerCase();
const valido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length < 120;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', (req, res) => {
  const email = limpa(req.body.email);
  if (!valido(email)) return res.status(400).json({ erro: 'E-mail inválido' });
  if (!dados[email]) { dados[email] = {}; gravar(); }
  res.json(dados[email]);
});

app.post('/api/save', (req, res) => {
  const email = limpa(req.body.email);
  const { chave, valor } = req.body;
  if (!valido(email) || !dados[email] || !CHAVES.includes(chave) || typeof valor !== 'string')
    return res.status(400).json({ erro: 'Pedido inválido' });
  dados[email][chave] = valor;
  gravar();
  res.json({ ok: true });
});

// ---- TEMPO REAL: quem está online ----
const online = {}; // id da conexão -> nome
function enviarLista() { io.emit('online', [...new Set(Object.values(online))]); }

io.on('connection', (socket) => {
  socket.on('entrar', (info) => {
    const email = limpa(info && info.email);
    if (!valido(email) || !dados[email]) return;
    online[socket.id] = email.split('@')[0]; // só mostra o começo do e-mail
    enviarLista();
  });
  socket.on('disconnect', () => { delete online[socket.id]; enviarLista(); });
});

servidor.listen(process.env.PORT || 3000, () => console.log('Rodando em http://localhost:3000'));
