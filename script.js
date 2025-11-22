const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const sleep = (t = 1) => new Promise(r => setTimeout(r, t));

const cache = {
    get: nick => {
        const val = sessionStorage.getItem(`chk-${nick}`);
        return val === null ? null : (val === 'true');
    },
    set: (nick, free) => sessionStorage.setItem(`chk-${nick}`, free)
};

async function quickFetch(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // Reduced timeout for faster fails

    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return res;
    } catch (error) {
        clearTimeout(timeoutId);
        return null;
    }
}

const apis = [
    { url: 'https://api.ashcon.app/mojang/v2/user/', name: 'ashcon', availableStatus: 404, takenStatus: 200 },
    { url: 'https://mush.com.br/api/player/', name: 'mush', availableStatus: 404, takenStatus: 200 },
    { url: 'https://api.mojang.com/users/profiles/minecraft/', name: 'mojang', availableStatus: 204, takenStatus: 200 }, // Added official Mojang API for better accuracy
    { url: 'https://api.mcsrvstat.us/2/', name: 'mcsrvstat', availableStatus: 200, takenStatus: 200 } // Added another API; note: this is for servers, but can check player UUID indirectly - adjusted logic below
];

async function checkNickAvailability(nick) {
    const cached = cache.get(nick);
    if (cached !== null) return cached;

    // Shuffle APIs for load balancing
    const shuffledApis = [...apis].sort(() => Math.random() - 0.5);

    let votes = { available: 0, taken: 0 };
    let successfulChecks = 0;

    for (const api of shuffledApis) {
        let res = await quickFetch(api.url + nick);

        if (res) {
            if (res.status === api.availableStatus || 
                (api.name === 'mcsrvstat' && res.status === 200 && (await res.json()).then(data => !data.players || !data.players.uuid))) { // Special handling for mcsrvstat if needed
                votes.available++;
            } else if (res.status === api.takenStatus) {
                votes.taken++;
            }
            successfulChecks++;
        }

        // If we have enough votes for 99% confidence (at least 2 agreements)
        if (votes.available >= 2 || votes.taken >= 2) break;
    }

    // Majority vote for accuracy
    const isAvailable = votes.available > votes.taken && successfulChecks >= 2;

    cache.set(nick, isAvailable);
    return isAvailable;
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
    a.download = 'nicks_disponiveis.txt';
    a.click();
    URL.revokeObjectURL(url);
});

function addNick(nick) {
    const li = document.createElement('li');
    li.dataset.nick = nick;
    li.style.animation = "fadeIn 0.2s";
    
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
    ui.stats.textContent = '🚀 VELOCIDADE MÁXIMA...';

    const len = +ui.length.value;
    const target = +ui.amount.value;
    const first = ui.first.value.trim();
    const charset = ui.charset.value;
    const allowUnder = ui.underscore.checked;
    const isTurbo = ui.turbo.checked;
    
    const concurrency = isTurbo ? 300 : 50; // Increased for more speed, but browser-dependent

    const seen = new Set();
    let found = 0;
    let attempts = 0;
    let startTime = Date.now();

    const speedInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000 || 1; // Avoid divide by zero
        const speed = Math.round(attempts / elapsed);
        ui.stats.textContent = `Checados: ${attempts} | PPS: ${speed}/s | Encontrados: ${found}/${target}`;
    }, 300); // More frequent updates for better "communication"

    while (found < target && !abort) {
        const batch = [];
        
        while (batch.length < concurrency && !abort) {
            let nick;
            do {
                nick = generateNick(len, first, charset, allowUnder);
            } while (seen.has(nick) && seen.size < 1000000); // Generate until unique, higher limit before clear
            seen.add(nick);
            batch.push(nick);
            if (seen.size > 500000) seen.clear(); // Increased limit for fewer clears
        }
        
        if (abort) break;

        const results = await Promise.allSettled(batch.map(async (n) => {
            if (abort) throw new Error('Aborted');
            const free = await checkNickAvailability(n);
            return { nick: n, free };
        }));

        attempts += batch.length;

        for (const res of results) {
            if (res.status === 'fulfilled' && res.value.free === true && found < target) {
                found++;
                addNick(res.value.nick);
            }
        }
        
        await sleep(0); // Yield to event loop
    }

    clearInterval(speedInterval);
    stopGeneration(found >= target);
}

function stopGeneration(completed = false) {
    isRunning = false; abort = true;
    ui.start.disabled = false;
    ui.stop.disabled = true;
    
    if (completed) {
        ui.stats.textContent = `Concluído!`;
    } else {
        ui.stats.textContent += ' (Parado)';
    }
}

ui.start.addEventListener('click', startGeneration);
ui.stop.addEventListener('click', () => stopGeneration(false));
