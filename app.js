// ============ КОНФИГУРАЦИЯ УСТРОЙСТВ ============
const DEVICES = [
    {
        id: '9aef59d4-516b-49c9-b3bc-9b256b1c8383:1450224512', // ID из вашего скриншота
        ip: '192.168.1.155', // ВАЖНО: Замените на реальный IP лампы из приложения WiZ!
        name: 'Гостиная group',
        icon: '💡'
    }
];

// ============ НАСТРОЙКИ МОСТА ============
let settings = {
    ip: localStorage.getItem('bridge_ip') || '192.168.1.50', // IP где запущен server.js
    port: localStorage.getItem('bridge_port') || '8080'
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

// ============ ЗАПРОСЫ К МОСТУ ============
function getBridgeUrl() {
    return `http://${settings.ip}:${settings.port}`;
}

async function apiRequest(path, method = 'GET', body = null) {
    const url = getBridgeUrl() + path;
    
    // Предупреждение о Mixed Content
    if (location.protocol === 'https:' && url.startsWith('http://')) {
        log('❌ GitHub Pages (HTTPS) не может обращаться к HTTP-мосту. Откройте сайт локально (сохраните файлы на телефон) или используйте HTTP.', 'err');
        return { ok: false, error: 'mixed-content' };
    }

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
        if (e.name === 'AbortError') reason = 'таймаут (мост не отвечает)';
        else if (e.message === 'Load failed' || e.message === 'Failed to fetch') reason = 'CORS или неверный IP моста';
        log(`${method} ${path} → ${reason}`, 'err');
        return { ok: false, error: reason };
    }
}

// ============ ПРОВЕРКА СВЯЗИ ============
async function checkConnection() {
    const st = document.getElementById('connectionStatus');
    const dot = st.querySelector('.dot');
    const txt = st.querySelector('span:last-child');
    dot.className = 'dot';
    txt.textContent = 'Проверка...';

    const res = await apiRequest('/ping');
    if (res.ok) {
        dot.className = 'dot online';
        txt.textContent = 'Мост онлайн';
    } else {
        dot.className = 'dot offline';
        txt.textContent = 'Мост офлайн';
    }
}

// ============ ДИАГНОСТИКА ============
async function runDiagnostics() {
    log('——— ДИАГНОСТИКА ———', 'ok');
    log(`Страница: ${location.protocol}//${location.host}`, '');
    log(`Мост: ${getBridgeUrl()}`, '');
    
    if (location.protocol === 'https:' && getBridgeUrl().startsWith('http://')) {
        log('❌ Mixed Content: HTTPS страница не может обращаться к HTTP мосту.', 'err');
        log('   Решение: откройте index.html локально (файл на телефоне) или запустите сайт через python -m http.server', '');
    }
    
    log('Проверка моста...', '');
    const res = await apiRequest('/ping');
    if (res.ok) log('✅ Мост доступен. Теперь проверьте IP лампы в app.js (DEVICES[0].ip)', 'ok');
    else log('❌ Мост недоступен. Проверьте: 1) Запущен ли server.js, 2) Верный ли IP в настройках, 3) Один ли Wi-Fi.', 'err');
    log('——— КОНЕЦ ———', 'ok');
}

// ============ УПРАВЛЕНИЕ ============
async function setDeviceState(deviceId, ip, state) {
    log(`Лампа ${ip} → ${state ? 'ON' : 'OFF'}`);
    // Передаем IP лампы и состояние на мост
    return await apiRequest('/setState', 'POST', { ip, state: state ? 1 : 0 });
}

async function setBrightness(deviceId, ip, value) {
    log(`Яркость ${ip} → ${value}%`);
    return await apiRequest('/setBrightness', 'POST', { ip, brightness: parseInt(value) });
}

// ============ РЕНДЕР ============
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

// ============ ОБРАБОТЧИКИ ============
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

// ============ СТАРТ ============
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    renderDevices();
    log('Приложение запущено', 'ok');
    checkConnection();
    setInterval(checkConnection, 30000);
});
