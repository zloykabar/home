const express = require('express');
const cors = require('cors');
const dgram = require('dgram');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Раздаем статические файлы (сайт) прямо с этого же сервера
app.use(express.static(__dirname));

const WIZ_PORT = 38899;

// Отправка UDP команды на лампу
function sendWizUdp(ip, payload, callback) {
    const client = dgram.createSocket('udp4');
    const message = Buffer.from(JSON.stringify(payload));
    
    client.send(message, 0, message.length, WIZ_PORT, ip, (err) => {
        client.close();
        if (err) {
            console.error('UDP error:', err);
            callback(err);
        } else {
            callback(null, { ok: true });
        }
    });
}

// --- API ЭНДПОИНТЫ ---

app.get('/ping', (req, res) => {
    res.json({ status: 'ok', message: 'Мост WiZ работает' });
});

app.post('/setState', (req, res) => {
    const { ip, state } = req.body;
    const payload = { method: 'setPilot', params: { state: state === 1 } };
    sendWizUdp(ip, payload, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: true });
    });
});

app.post('/setBrightness', (req, res) => {
    const { ip, brightness } = req.body;
    const payload = { 
        method: 'setPilot', 
        params: { state: true, dimming: Math.max(1, Math.min(100, parseInt(brightness))) }
    };
    sendWizUdp(ip, payload, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: true });
    });
});

// Запуск сервера
const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен!`);
    console.log(`👉 Откройте на телефоне: http://192.168.68.60:${PORT}`);
    console.log(`   (Телефон должен быть в той же Wi-Fi сети)`);
});
