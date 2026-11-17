// ============ HTTP ЗАПРОСЫ (улучшенная диагностика) ============
function getBaseUrl() {
    return `http://${settings.ip}:${settings.port}`;
}

async function apiRequest(path, method = 'GET', body = null) {
    const url = getBaseUrl() + path;

    // Проверка mixed content
    if (location.protocol === 'https:' && url.startsWith('http://')) {
        log('❌ HTTPS-страница не может обращаться к HTTP-устройству (mixed content). Откройте сайт локально или настройте HTTPS на устройстве.', 'err');
        return { ok: false, error: 'mixed-content' };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (settings.token) headers['Authorization'] = `Bearer ${settings.token}`;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null,
            signal: controller.signal
        });
        clearTimeout(timer);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        log(`${method} ${path} → OK`, 'ok');
        return { ok: true, data };

    } catch (e) {
        // Разбираем причину
        let reason = e.message;
        if (e.name === 'AbortError') reason = 'timeout (устройство не отвечает)';
        else if (e.message === 'Load failed' || e.message === 'Failed to fetch')
            reason = 'CORS / смешанный контент / неверный IP';
        log(`${method} ${path} → ${reason}`, 'err');
        return { ok: false, error: reason };
    }
}

// ============ КНОПКА ДИАГНОСТИКИ ============
async function runDiagnostics() {
    log('——— ДИАГНОСТИКА ———', 'ok');

    // 1. Протокол страницы
    log(`Страница: ${location.protocol}//${location.host}`, '');
    log(`Устройство: ${getBaseUrl()}`, '');

    // 2. Mixed content
    if (location.protocol === 'https:' && getBaseUrl().startsWith('http://')) {
        log('❌ Mixed content: HTTPS → HTTP заблокирован браузером', 'err');
    } else {
        log('✅ Mixed content: OK', 'ok');
    }

    // 3. Ping устройства (no-cors — не покажет статус, но покажет "доступен/нет")
    log('Проверка доступности устройства...', '');
    try {
        const t0 = performance.now();
        await fetch(getBaseUrl() + '/', { mode: 'no-cors', cache: 'no-store' });
        const dt = Math.round(performance.now() - t0);
        log(`✅ Устройство отвечает (${dt} мс)`, 'ok');
    } catch (e) {
        log(`❌ Устройство недоступно: ${e.message}`, 'err');
        log('   Проверьте: 1) тот же Wi-Fi, 2) верный IP, 3) устройство включено', '');
    }

    // 4. CORS-проверка реального API
    log('Проверка CORS на API...', '');
    try {
        const res = await fetch(getBaseUrl() + '/', { method: 'GET' });
        log(`✅ CORS разрешён, HTTP ${res.status}`, 'ok');
    } catch (e) {
        log(`❌ CORS заблокирован или путь неверен: ${e.message}`, 'err');
    }

    log('——— КОНЕЦ ———', 'ok');
}
