// ============ КОНФИГУРАЦИЯ УСТРОЙСТВ ============
const DEVICES = [
    {
        id: '9aef59d4-516b-49c9-b3bc-9b256b1c8383:1450224512',
        ip: '192.168.68.55', // ВАШ IP ЛАМПЫ
        name: 'Гостиная (WiZ)',
        icon: '💡'
    }
];

// Настройки (по умолчанию ваш ПК)
let settings = {
    ip: localStorage.getItem('bridge_ip') || '192.168.68.60',
    port: localStorage.getItem('bridge_port') || '8080'
};

function log(msg, type = '') {
    const box = document.getElementById('logBox');
    if(!box) return;
    const t = new Date().toLocaleTimeString('ru-RU');
    const div = document.createElement('div');
    div.className = 'log-line ' + type;
    div.textContent = `[${t}] ${msg}`;
    box.prepend(div);
    while (box.children.length > 50) box.lastChild.remove();
}

function loadSettings() {
    document.getElementById('bridgeIp').value = settings.ip;
    document.getElementById('bridgePort').value = settings.port;
}

function saveSettings() {
    settings.ip = document.getElementById('bridgeIp').value.trim();
    settings.port = document.getElementById('bridgePort').value.trim();
    localStorage.setItem('bridge_ip', settings.ip);
    localStorage.setItem('bridge_port', settings.port);
    log('Настройки моста сохранены', 'ok');
    checkConnection();
}

function getBridgeUrl() {
    return `http://${settings.ip}:${settings.port}`;
}

async function apiRequest(path, method = 'GET', body = null) {
    const url = getBridgeUrl() + path;
    
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : null,
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        log(`${method} ${path} → OK`, 'ok');
        return { ok: true, data };
    } catch (e) {
        let reason = e.message;
        if (e.name === 'AbortError') reason = 'таймаут (ПК не отвечает)';
        else if (e.message === 'Load failed' || e.message === 'Failed to fetch') reason = 'CORS / неверный IP / ПК выключен';
        log(`${method} ${path} → ${reason}`, 'err');
        return { ok: false, error: reason };
    }
}

async function checkConnection() {
    const st = document.getElementById('connectionStatus');
    if (!st) return;
    const dot = st.querySelector('.dot');
    const txt = st.querySelector('span:last-child');
    
    dot.className = 'dot';
    txt.textContent = 'Проверка...';

    const res = await apiRequest('/ping');
    if (res.ok) {
        dot.className = 'dot online';
        txt.textContent = 'Онлайн';
    } else {
        dot.className = 'dot offline';
        txt.textContent = 'Офлайн';
    }
}

async function setDeviceState(deviceId, ip, state) {
    log(`Лампа ${ip} → ${state ? 'ON' : 'OFF'}`);
    return await apiRequest('/setState', 'POST', { ip, state: state ? 1 : 0 });
}

async function setBrightness(deviceId, ip, value) {
    log(`Яркость ${ip} → ${value}%`);
    return await apiRequest('/setBrightness', 'POST', { ip, brightness: parseInt(value) });
}

function renderDevices() {
    const list = document.getElementById('deviceList');
    if(!list) return;
    list.innerHTML = '';
    DEVICES.forEach(dev => {
        const card = document.createElement('div');
        card.className = 'device-card';
        card.innerHTML = `
            <div class="device-header">
                <div class="device-name">${dev.icon} ${dev.name}</div>
                <div class="device-state off" id="state-${dev.id}">OFF</div>
            </div>
            <div class="device-id">IP: ${dev.ip}</div>
            <div class="controls">
                <button class="btn on-btn" onclick="onDeviceOn('${dev.id}', '${dev.ip}')">Вкл</button>
                <button class="btn off-btn" onclick="onDeviceOff('${dev.id}', '${dev.ip}')">Выкл</button>
                <div class="brightness">
                    <label>Яркость</label>
                    <input type="range" min="1" max="100" value="100"
                           oninput="document.getElementById('brightval-${dev.id}').textContent = this.value + '%'"
                           onchange="onBrightness('${dev.id}', '${dev.ip}', this.value)">
                    <div class="brightness-value" id="brightval-${dev.id}">100%</div>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

async function onDeviceOn(id, ip) {
    const res = await setDeviceState(id, ip, true);
    if (res.ok) updateStateUI(id, true);
}
async function onDeviceOff(id, ip) {
    const res = await setDeviceState(id, ip, false);
    if (res.ok) updateStateUI(id, false);
}
async function onBrightness(id, ip, value) {
    await setBrightness(id, ip, value);
}
function updateStateUI(id, on) {
    const el = document.getElementById('state-' + id);
    if (el) {
        el.textContent = on ? 'ON' : 'OFF';
        el.className = 'device-state ' + (on ? 'on' : 'off');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    renderDevices();
    log('Приложение запущено', 'ok');
    checkConnection();
    setInterval(checkConnection, 30000);
});
