const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const sleep = (t = 250) => new Promise(r => setTimeout(r, t));

const cache = {
    get: nick => {
        const val = sessionStorage.getItem(`chk-${nick}`);
        return val === null ? null : (val === 'true');
    },
    set: (nick, free) => sessionStorage.setItem(`chk-${nick}`, free)
};

async function ashcon(nick) {
    const res = await fetch(`https://api.ashcon.app/mojang/v2/user/${nick}`);
    if (res.status === 404) return true; 
    if (res.status === 200) return false; 
    throw new Error(`Ashcon ${res.status}`);
}

async function labymod(nick) {
    const res = await fetch(`https://laby.net/api/v3/user/${nick}`);
    if (res.status === 404) return true; 
    if (res.status === 200) return false; 
    throw new Error('LabyMod Error');
}

async function checkNickAvailability(nick) {
    const cached = cache.get(nick);
    if (cached !== null) return cached;

    try {
        const step1 = await ashcon(nick).catch(() => null);
        
        if (step1 === false) {
            cache.set(nick, false);
            return false;
        }

        const step2 = await labymod(nick).catch(() => null);
        
        if (step2 === false) {
            cache.set(nick, false);
            return false;
        }

        if (step1 === true || step2 === true) {
            cache.set(nick, true);
            return true;
        }

        return false;

    } catch (e) {
        return false;
    }
}

const genChars = {
    letters: 'abcdefghijklmnopqrstuvwxyz',
    letters_digits: 'abcdefghijklmnopqrstuvwxyz0123456789',
    full: 'abcdefghijklmnopqrstuvwxyz0123456789_',
    vowels: 'aeiou',
    consonants: 'bcdfghjklmnpqrstvwxyz'
};

function generateNick(len, first, type, allowUnderscore) {
    let nick = '';
    
    if (type === 'pronounceable') {
        let useVowel = Math.random() > 0.5;
        if (first) {
            nick = first.toLowerCase();
            useVowel = !genChars.vowels.includes(nick); 
        }
        while (nick.length < len) {
            const pool = useVowel ? genChars.vowels : genChars.consonants;
            nick += pool[Math.floor(Math.random() * pool.length)];
            useVowel = !useVowel;
        }
    } else {
        const pool = genChars[type] || genChars.letters;
        if (first) nick += first.toLowerCase();
        for (let i = nick.length; i < len; i++) {
            nick += pool[Math.floor(Math.random() * pool.length)];
        }
    }

    if (allowUnderscore && len > 2 && type !== 'full') {
        if (!nick.includes('_') && Math.random() > 0.3) {
            let idx = 1 + Math.floor(Math.random() * (len - 2));
            nick = nick.slice(0, idx) + '_' + nick.slice(idx + 1);
        }
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
    navigator.clipboard.writeText(text).then(() => {
        const original = ui.copyAll.textContent;
        ui.copyAll.textContent = 'Copiado! ✓';
        setTimeout(() => ui.copyAll.textContent = original, 2000);
    });
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
    li.dataset.nick = nick;
    
    const span = document.createElement('span');
    span.textContent = nick;

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copiar';
    btn.onclick = () => {
        navigator.clipboard.writeText(nick);
        btn.textContent = 'OK';
        btn.style.color = 'var(--ok)';
        btn.style.borderColor = 'var(--ok)';
        setTimeout(() => {
            btn.textContent = 'Copiar';
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 1500);
    };

    li.append(span, btn);
    ui.list.appendChild(li);
    
    ui.list.scrollTop = ui.list.scrollHeight;
    updateActionButtons();
}

async function startGeneration() {
    if (isRunning) return;
    isRunning = true; abort = false;
    ui.start.disabled = true;
    ui.stop.disabled = false;
    ui.list.innerHTML = '';
    ui.stats.textContent = 'Iniciando alta velocidade...';

    const len = +ui.length.value;
    const target = +ui.amount.value;
    const first = ui.first.value.trim();
    const charset = ui.charset.value;
    const allowUnder = ui.underscore.checked;
    const isTurbo = ui.turbo.checked;
    
    const concurrency = isTurbo ? 25 : 2; 

    const seen = new Set();
    let found = 0;
    let attempts = 0;
    let speed = 0;
    let startTime = Date.now();

    const speedInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        speed = Math.round(attempts / elapsed);
        ui.stats.textContent = `Checados: ${attempts} | PPS: ${speed}/s | Encontrados: ${found}/${target}`;
    }, 1000);

    while (found < target && !abort) {
        const batch = [];
        
        while (batch.length < concurrency) {
            let nick = generateNick(len, first, charset, allowUnder);
            if (!seen.has(nick)) {
                seen.add(nick);
                batch.push(nick);
            }
            if(seen.size > 20000) seen.clear();
        }
        
        const promises = batch.map(async (n) => {
            if (abort) return null;
            const free = await checkNickAvailability(n);
            return { nick: n, free };
        });

        const results = await Promise.all(promises);
        attempts += batch.length;

        for (const res of results) {
            if (res && res.free && found < target) {
                found++;
                addNick(res.nick);
            }
        }
        
        if (!isTurbo) await sleep(150);
    }

    clearInterval(speedInterval);
    stopGeneration(found >= target);
}

function stopGeneration(completed = false) {
    isRunning = false; abort = true;
    ui.start.disabled = false;
    ui.stop.disabled = true;
    
    if (completed) {
        ui.stats.textContent = `Concluído! ${ui.list.children.length} nicks encontrados.`;
    } else {
        ui.stats.textContent += ' (Parado)';
    }
}

ui.start.addEventListener('click', startGeneration);
ui.stop.addEventListener('click', () => stopGeneration(false));
