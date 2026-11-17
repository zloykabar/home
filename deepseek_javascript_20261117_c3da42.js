const express = require('express');
const cors = require('cors');
const { WizLight } = require('wiz-light-core');

const app = express();
app.use(cors()); // Разрешаем запросы с GitHub Pages
app.use(express.json());

// Укажите IP вашей лампы (из шага 1)
const BULB_IP = '192.168.1.155'; 
const light = new WizLight(BULB_IP);

// Включение/выключение
app.post('/api/state', async (req, res) => {
    try {
        const { state } = req.body; // true или false
        await light.apply({ on: state });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Яркость (0-100)
app.post('/api/brightness', async (req, res) => {
    try {
        const { brightness } = req.body;
        await light.apply({ brightness: parseInt(brightness) });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Запуск на порту 8080
app.listen(8080, () => console.log('Мост запущен: http://<IP-вашего-ПК>:8080'));