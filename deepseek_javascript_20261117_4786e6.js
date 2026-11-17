// ============ КОНФИГУРАЦИЯ ============
const DEVICES = [
    {
        id: '9aef59d4-516b-49c9-b3bc-9b256b1c8383:1450224512',
        name: 'Лампа 1',
        type: 'light',
        icon: '💡'
    },
    // Добавляйте другие устройства здесь:
    // { id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:xxxxxxxxxx', name: 'Лампа 2', type: 'light', icon: '💡' }
];

// ============ НАСТРОЙКИ ============
let settings = {
    ip: localStorage.getItem('sh_ip') || '192.168.1.100',
    port: localStorage.getItem('sh_port') || '80',
    token: localStorage.getItem('sh_token') || ''
};

// ============ ЖУРНАЛ ============
function log(msg, type = '') {
    const box = document.getElementById('logBox');
    const t = new Date().toLocaleTimeString('ru-RU');
    const div = document.createElement('div');
    div.className = 'log-line ' + type;
    div.textContent = `[${t}] ${msg}`;
    box.prepend(div);
    while (box.children.length > 50) box.lastChild.remove();
}

// ============ НАСТРОЙКИ ============
function loadSettings() {
    document.getElementById('deviceIp').value = settings.ip;
    document.getElementById('devicePort').value = settings.port;
    document.getElementById('apiToken').value = settings.token;
}

function saveSettings() {
    settings.ip = document.getElementById('deviceIp').value.trim();
    settings.port = document.getElementById('devicePort').value.trim();
    settings.token = document.getElementById('apiToken').value.trim();
    localStorage.setItem('sh_ip', settings.ip);
    localStorage.setItem('sh_port', settings.port);
    localStorage.setItem('sh_token', settings.token);
    log('Настройки сохранены', 'ok');
    checkConnection();
}

// ============ HTTP ЗАПРОСЫ ============
function getBaseUrl() {
    return `http://${settings.ip}:${settings.port}`;
}

async function apiRequest(path, method = 'GET', body = null) {
    const url = getBaseUrl() + path;
    const headers = { 'Content-Type': 'application/json' };
    if (settings.token) headers['Authorization'] = `Bearer ${settings.token}`;

    try {
        const res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null,
            mode: 'cors',
            signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        log(`${method} ${path} → OK`, 'ok');
        return { ok: true, data };
    } catch (e) {
        log(`${method} ${path} → ${e.message}`, 'err');
        return { ok: false, error: e.message };
    }
}

// ============ ПРОВЕРКА СОЕДИНЕНИЯ ============
async function checkConnection() {
    const st = document.getElementById('connectionStatus');
    const dot = st.querySelector('.dot');
    const txt = st.querySelector('span:last-child');

    dot.className = 'dot';
    txt.textContent = 'Проверка...';

    // Пробуем пинг устройства
    const res = await fetch(`${getBaseUrl()}/`, {
        method: 'GET',
        mode: 'no-cors',
        signal: AbortSignal.timeout(3000)
    }).then(() => ({ ok: true })).catch(e => ({ ok: false, error: e.message }));

    if (res.ok) {
        dot.className = 'dot online';
        txt.textContent = 'Онлайн';
    } else {
        dot.className = 'dot offline';
        txt.textContent = 'Офлайн';
    }
}

// ============ УПРАВЛЕНИЕ УСТРОЙСТВАМИ ============
async function setDeviceState(deviceId, state) {
    log(`Команда: ${deviceId.substring(0, 12)}... → ${state ? 'ON' : 'OFF'}`);
    return await apiRequest(`/api/device/${encodeURIComponent(deviceId)}/state`, 'POST', { state: state ? 1 : 0 });
}

async function setBrightness(deviceId, value) {
    log(`Яркость: ${deviceId.substring(0, 12)}... → ${value}%`);
    return await apiRequest(`/api/device/${encodeURIComponent(deviceId)}/brightness`, 'POST', { brightness: value });
}

// ============ РЕНДЕР УСТРОЙСТВ ============
function renderDevices() {
    const list = document.getElementById('deviceList');
    list.innerHTML = '';

    DEVICES.forEach(dev => {
        const card = document.createElement('div');
        card.className = 'device-card';
        card.innerHTML = `
            <div class="device-header">
                <div class="device-name">${dev.icon} ${dev.name}</div>
                <div class="device-state off" id="state-${dev.id}">OFF</div>
            </div>
            <div class="device-id">${dev.id}</div>
            <div class="controls">
                <button class="btn on-btn" onclick="onDeviceOn('${dev.id}')">Вкл</button>
                <button class="btn off-btn" onclick="onDeviceOff('${dev.id}')">Выкл</button>
                <div class="brightness">
                    <label>Яркость</label>
                    <input type="range" min="1" max="100" value="100"
                           id="bright-${dev.id}"
                           oninput="document.getElementById('brightval-${dev.id}').textContent = this.value + '%'"
                           onchange="onBrightness('${dev.id}', this.value)">
                    <div class="brightness-value" id="brightval-${dev.id}">100%</div>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

// ============ ОБРАБОТЧИКИ ============
async function onDeviceOn(id) {
    const res = await setDeviceState(id, true);
    if (res.ok) updateStateUI(id, true);
}

async function onDeviceOff(id) {
    const res = await setDeviceState(id, false);
    if (res.ok) updateStateUI(id, false);
}

async function onBrightness(id, value) {
    await setBrightness(id, parseInt(value));
}

function updateStateUI(id, on) {
    const el = document.getElementById('state-' + id);
    if (el) {
        el.textContent = on ? 'ON' : 'OFF';
        el.className = 'device-state ' + (on ? 'on' : 'off');
    }
}

// ============ ИНИЦИАЛИЗАЦИЯ ============
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    renderDevices();
    log('Приложение запущено', 'ok');
    checkConnection();
    // Автопроверка каждые 30 сек
    setInterval(checkConnection, 30000);
});