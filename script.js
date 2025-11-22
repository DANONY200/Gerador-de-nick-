const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
// Tempo de espera mínimo para não travar a CPU
const sleep = (t = 50) => new Promise(r => setTimeout(r, t));

const cache = {
    get: nick => {
        const val = sessionStorage.getItem(`chk-${nick}`);
        return val === null ? null : (val === 'true');
    },
    set: (nick, free) => sessionStorage.setItem(`chk-${nick}`, free)
};

// --- REQUISIÇÃO RIGOROSA ---
async function strictFetch(url) {
    const controller = new AbortController();
    // Timeout curto (2.5s). Se demorar, descarta.
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return res;
    } catch (error) {
        // Se der qualquer erro de rede ou timeout, retorna null
        clearTimeout(timeoutId);
        return null;
    }
}

// Verifica na API Ashcon
async function ashcon(nick) {
    const res = await strictFetch(`https://api.ashcon.app/mojang/v2/user/${nick}`);
    
    // REGRA DE OURO: Se deu erro de rede, timeout, ou rate limit -> DESCARTA (null)
    if (!res) return null; 
    
    // Só retorna TRUE se for explicitamente 404 (Não Encontrado)
    if (res.status === 404) return true;
    
    // Qualquer outra coisa (200, 429, 500) conta como Ocupado/Erro
    return false;
}

// Verifica na LabyMod (Backup)
async function labymod(nick) {
    const res = await strictFetch(`https://laby.net/api/v3/user/${nick}`);
    if (!res) return null;

    if (res.status === 404) return true;
    return false;
}

async function checkNickAvailability(nick) {
    // 1. Cache
    const cached = cache.get(nick);
    if (cached !== null) return cached;

    // 2. Tenta Ashcon
    let result = await ashcon(nick);

    // 3. Se Ashcon deu erro/ocupado/timeout, tenta a LabyMod como última chance?
    // VOCÊ PEDIU: "Se der erro, descarta".
    // Então, se o Ashcon falhar (retornar null ou false), a gente assume que já era.
    // MAS, para garantir que não estamos perdendo nicks bons por falha momentânea da Ashcon,
    // vamos testar no LabyMod APENAS se o Ashcon der "Erro de Rede" (null).
    
    if (result === null) {
        result = await labymod(nick);
    }

    // Se depois disso o resultado não for EXPLICITAMENTE true (Disponível), descarta.
    if (result !== true) {
        result = false;
    }

    cache.set(nick, result);
    return result;
}

// --- GERADOR DE NICKS (MANTIDO IGUAL) ---
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

// --- INTERFACE (UI) ---
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
    a.download = 'nicks_disponiveis.txt';
    a.click();
    URL.revokeObjectURL(url);
});

function addNick(nick) {
    const li = document.createElement('li');
    li.dataset.nick = nick;
    li.style.animation = "fadeIn 0.3s";
    
    const span = document.createElement('span');
    span.textContent = nick;
    span.style.color = "#4ade80";

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copiar';
    btn.onclick = () => {
        navigator.clipboard.writeText(nick);
        btn.textContent = 'OK';
        setTimeout(() => btn.textContent = 'Copiar', 1000);
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
    ui.stats.textContent = '🕵️ MODO RIGOROSO ATIVADO...';

    const len = +ui.length.value;
    const target = +ui.amount.value;
    const first = ui.first.value.trim();
    const charset = ui.charset.value;
    const allowUnder = ui.underscore.checked;
    const isTurbo = ui.turbo.checked;
    
    // Mantivemos a velocidade alta, pois agora o descarte é rápido
    const concurrency = isTurbo ? 60 : 5; 

    const seen = new Set();
    let found = 0;
    let attempts = 0;
    let startTime = Date.now();

    const speedInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = Math.round(attempts / elapsed);
        ui.stats.textContent = `⚡ Verificados: ${attempts} | PPS: ${speed}/s | ✅ Válidos: ${found}/${target}`;
    }, 500);

    while (found < target && !abort) {
        const batch = [];
        
        while (batch.length < concurrency) {
            let nick = generateNick(len, first, charset, allowUnder);
            if (!seen.has(nick)) {
                seen.add(nick);
                batch.push(nick);
            }
            if(seen.size > 100000) seen.clear();
        }
        
        const results = await Promise.all(batch.map(async (n) => {
            if (abort) return null;
            const free = await checkNickAvailability(n);
            return { nick: n, free };
        }));

        attempts += batch.length;

        for (const res of results) {
            // Só adiciona se for EXATAMENTE true (sem incertezas)
            if (res && res.free === true && found < target) {
                found++;
                addNick(res.nick);
            }
        }
        
        await sleep(isTurbo ? 5 : 100);
    }

    clearInterval(speedInterval);
    stopGeneration(found >= target);
}

function stopGeneration(completed = false) {
    isRunning = false; abort = true;
    ui.start.disabled = false;
    ui.stop.disabled = true;
    
    if (completed) {
        ui.stats.textContent = `✅ Finalizado! Lista gerada com rigor.`;
    } else {
        ui.stats.textContent += ' (Parado)';
    }
}

ui.start.addEventListener('click', startGeneration);
ui.stop.addEventListener('click', () => stopGeneration(false));
