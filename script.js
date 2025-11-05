const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const sleep = (t = 250) => new Promise(r => setTimeout(r, t));

const cache = {
    hit: nick => sessionStorage.getItem(`chk-${nick}`),
    set: (nick, free) => sessionStorage.setItem(`chk-${nick}`, free)
};

async function ashcon(nick) {
    const url = `https://api.ashcon.app/mojang/v2/user/${nick}`;
    const res = await fetch(url);
    return res.status === 404;
}

async function mcapi(nick) {
    const url = `https://mcuser.net/api/server/user/${nick}`;
    const res = await fetch(url);
    try { const json = await res.json(); return json.exists === false; }
    catch { return false; }
}

async function mojang(nick) {
    const url = `https://api.mojang.com/users/profiles/minecraft/${nick}`;
    const res = await fetch(url, { mode: 'cors' });
    return res.status === 204 || !res.ok;
}

async function checkNickAvailability(nick) {
    if (cache.hit(nick)) return cache.get(nick) === 'true';
    try {
        const free = await Promise.any([
            ashcon(nick),
            mcapi(nick),
            mojang(nick)
        ]);
        cache.set(nick, free);
        return free;
    } catch {
        cache.set(nick, false);
        return false;
    }
}

const genChars = {
    letters: 'abcdefghijklmnopqrstuvwxyz',
    letters_digits: 'abcdefghijklmnopqrstuvwxyz0123456789',
    full: 'abcdefghijklmnopqrstuvwxyz0123456789_'
};

function generateNick(len, first, type, allowUnderscore) {
    const pool = genChars[type] || genChars.letters;
    let nick = '';
    if (first) nick += first.toLowerCase();
    for (let i = nick.length; i < len; i++) {
        nick += pool[Math.floor(Math.random() * pool.length)];
    }
    if (allowUnderscore && len > 1 && type !== 'full') {
        let idx = 1 + Math.floor(Math.random() * (len - 1));
        nick = nick.slice(0, idx) + '_' + nick.slice(idx + 1);
    }
    return nick;
}

let isRunning = false;
let abort = false;

const ui = {
    length: $('#length'),
    amount: $('#amount'),
    first: $('#firstLetter'),
    charset: $('#charset'),
    underscore: $('#useUnderscore'),
    turbo: $('#turbo'),
    start: $('#startButton'),
    stop: $('#stopButton'),
    list: $('#resultsList'),
    stats: $('#stats'),
    copyAll: $('#copyAllBtn'),
    download: $('#downloadBtn')
};

function updateActionButtons() {
    const has = ui.list.children.length > 0;
    ui.copyAll.disabled = !has;
    ui.download.disabled = !has;
}

ui.copyAll.addEventListener('click', () => {
    const text = [...ui.list.children].map(li => li.dataset.nick).join('\n');
    navigator.clipboard.writeText(text).then(() => alert('Copiado!'));
});

ui.download.addEventListener('click', () => {
    const text = [...ui.list.children].map(li => li.dataset.nick).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nicks.txt';
    a.click();
    URL.revokeObjectURL(url);
});

function addNick(nick) {
    const li = document.createElement('li');
    li.textContent = nick;
    li.dataset.nick = nick;

    const cpy = document.createElement('button');
    cpy.textContent = '📋';
    cpy.style.fontSize = '0.7em';
    cpy.style.background = 'transparent';
    cpy.style.border = 'none';
    cpy.style.color = '#4CAF50';
    cpy.onclick = () => navigator.clipboard.writeText(nick);
    li.append(' ', cpy);

    ui.list.appendChild(li);
    updateActionButtons();
}

async function startGeneration() {
    if (isRunning) return;
    isRunning = true; abort = false;
    ui.start.disabled = true;
    ui.stop.disabled = false;
    ui.list.innerHTML = '';

    const len = +ui.length.value;
    const target = +ui.amount.value;
    const first = ui.first.value.trim();
    const charset = ui.charset.value;
    const allowUnder = ui.underscore.checked;
    const turbo = ui.turbo.checked;
    const interval = turbo ? 50 : 300;

    const seen = new Set();
    let found = 0;
    let attempts = 0;

    const timer = setInterval(() => {
        ui.stats.textContent = `Tentativas: ${attempts} | Encontrados: ${found}/${target}`;
    }, 200);

    while (found < target && !abort) {
        attempts++;
        let nick = generateNick(len, first, charset, allowUnder);
        if (seen.has(nick)) continue;
        seen.add(nick);

        if (await checkNickAvailability(nick)) {
            found++;
            addNick(nick);
        }
        await sleep(interval);
    }

    clearInterval(timer);
    ui.stats.textContent = `Finalizado: ${found}/${target} após ${attempts} tentativas.`;
    stopGeneration();
}

function stopGeneration() {
    isRunning = false; abort = true;
    ui.start.disabled = false;
    ui.stop.disabled = true;
}

ui.start.addEventListener('click', startGeneration);
ui.stop.addEventListener('click', stopGeneration);
