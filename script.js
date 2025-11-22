const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const sleep = (t = 250) => new Promise(r => setTimeout(r, t));

// Cache melhorado
const cache = {
    // Retorna true (disponível), false (ocupado) ou null (não checado)
    get: nick => {
        const val = sessionStorage.getItem(`chk-${nick}`);
        return val === null ? null : (val === 'true');
    },
    set: (nick, free) => sessionStorage.setItem(`chk-${nick}`, free)
};

// --- APIS ---
// Nota: Algumas APIs podem falhar devido a CORS se não usar um proxy,
// mas Promise.any garante que se pelo menos uma funcionar, teremos o resultado.

async function ashcon(nick) {
    const url = `https://api.ashcon.app/mojang/v2/user/${nick}`;
    const res = await fetch(url);
    if (res.status === 404) return true; // Disponível
    if (res.status === 200) return false; // Ocupado
    throw new Error(`Ashcon status ${res.status}`);
}

async function mcapi(nick) {
    const url = `https://mcuser.net/api/server/user/${nick}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MCAPI status ${res.status}`);
    try {
        const json = await res.json();
        // A API retorna exists: false se o nick estiver livre
        if (json.exists === false) return true;
        if (json.exists === true) return false;
        throw new Error('MCAPI JSON inesperado');
    } catch (e) {
        throw new Error(`MCAPI parsing: ${e.message}`);
    }
}

async function mojang(nick) {
    // Mojang tem CORS restrito. Geralmente falha em browsers puros,
    // mas mantemos caso o usuário use um navegador sem segurança ou proxy.
    const url = `https://api.mojang.com/users/profiles/minecraft/${nick}`;
    const res = await fetch(url, { mode: 'cors' });
    if (res.status === 204 || res.status === 404) return true;
    if (res.status === 200) return false;
    throw new Error(`Mojang status ${res.status}`);
}

// NOVA API ADICIONADA
async function minetools(nick) {
    const url = `https://api.minetools.eu/uuid/${nick}`;
    const res = await fetch(url);
    // MineTools retorna 200 com JSON contendo ID se existe.
    // Retorna erro ou JSON específico se não existe.
    try {
        const json = await res.json();
        if (json.id === null && json.status === 'ERR') return true; // Disponível
        if (json.id) return false; // Ocupado
        // Se o status for OK mas id null, é provável que esteja livre
        return true;
    } catch {
        throw new Error('Minetools error');
    }
}

async function checkNickAvailability(nick) {
    // Verifica cache primeiro
    const cached = cache.get(nick);
    if (cached !== null) return cached;

    try {
        // Tenta todas as APIs simultaneamente, a primeira que responder (sucesso ou falha clara) vence
        const free = await Promise.any([
            ashcon(nick),
            mcapi(nick),
            minetools(nick),
            mojang(nick)
        ]);
        
        cache.set(nick, free);
        return free;
    } catch (error) {
        // Se TODAS as APIs falharem (erro de rede/cors), assumimos ocupado por segurança
        // para não dar falso positivo ao usuário.
        console.warn(`Falha ao verificar ${nick}:`, error);
        // Não salvamos no cache para tentar novamente depois
        return false;
    }
}

// --- Lógica de Geração ---

const genChars = {
    letters: 'abcdefghijklmnopqrstuvwxyz',
    letters_digits: 'abcdefghijklmnopqrstuvwxyz0123456789',
    full: 'abcdefghijklmnopqrstuvwxyz0123456789_',
    vowels: 'aeiou',
    consonants: 'bcdfghjklmnpqrstvwxyz'
};

function generateNick(len, first, type, allowUnderscore) {
    let nick = '';
    
    // Lógica Especial: Pronunciável (CVCV...)
    if (type === 'pronounceable') {
        let useVowel = Math.random() > 0.5; // Começa aleatório
        if (first) {
            nick = first.toLowerCase();
            // Se a primeira for vogal, a próxima deve ser consoante
            useVowel = !genChars.vowels.includes(nick); 
        }
        
        while (nick.length < len) {
            const pool = useVowel ? genChars.vowels : genChars.consonants;
            nick += pool[Math.floor(Math.random() * pool.length)];
            useVowel = !useVowel; // Alterna
        }
    } else {
        // Lógica Padrão
        const pool = genChars[type] || genChars.letters;
        if (first) nick += first.toLowerCase();
        
        for (let i = nick.length; i < len; i++) {
            nick += pool[Math.floor(Math.random() * pool.length)];
        }
    }

    // Inserção de Underscore (Preservada a lógica original)
    if (allowUnderscore && len > 2 && type !== 'full') {
        if (!nick.includes('_') && Math.random() > 0.3) {
            // Evita colocar underscore no início ou fim para estética
            let idx = 1 + Math.floor(Math.random() * (len - 2));
            nick = nick.slice(0, idx) + '_' + nick.slice(idx + 1);
        }
    }
    
    return nick.slice(0, 16); // Garante limite do MC
}

// --- Controle da Interface ---

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

// Utilitário de Cópia
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
    a.download = `nicks_${Date.now()}.txt`;
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
    
    // Auto-scroll para baixo
    ui.list.scrollTop = ui.list.scrollHeight;
    updateActionButtons();
}

// --- Core Loop Otimizado ---

async function startGeneration() {
    if (isRunning) return;
    isRunning = true; 
    abort = false;
    
    ui.start.disabled = true;
    ui.stop.disabled = false;
    ui.list.innerHTML = '';
    ui.stats.textContent = 'Inicializando motores...';

    const config = {
        len: +ui.length.value,
        target: +ui.amount.value,
        first: ui.first.value.trim(),
        charset: ui.charset.value,
        allowUnder: ui.underscore.checked,
        concurrency: ui.turbo.checked ? 5 : 1 // Turbo checa 5 ao mesmo tempo
    };

    const seen = new Set();
    let found = 0;
    let attempts = 0;

    // Loop Principal
    while (found < config.target && !abort) {
        const batch = [];
        
        // Prepara um lote de promessas
        while (batch.length < config.concurrency && !abort) {
            let nick = generateNick(config.len, config.first, config.charset, config.allowUnder);
            
            // Evita duplicatas locais e globais
            if (!seen.has(nick)) {
                seen.add(nick);
                batch.push(nick);
            }
            // Se o Set ficar muito grande, limpamos os antigos para não estourar memória
            if(seen.size > 5000) seen.clear();
        }

        if (batch.length === 0) break; // Segurança

        // Processa o lote
        const results = await Promise.all(batch.map(async (n) => {
            attempts++;
            const isFree = await checkNickAvailability(n);
            return { nick: n, free: isFree };
        }));

        // Atualiza UI e adiciona encontrados
        for (const res of results) {
            if (abort) break;
            if (res.free) {
                found++;
                addNick(res.nick);
                if (found >= config.target) break;
            }
        }

        ui.stats.textContent = `Verificados: ${attempts} | Encontrados: ${found}/${config.target} | Status: ${config.concurrency > 1 ? 'Turbo ⚡' : 'Normal'}`;
        
        // Pequena pausa para não travar o navegador totalmente
        await sleep(ui.turbo.checked ? 50 : 200);
    }

    stopGeneration(found >= config.target);
}

function stopGeneration(completed = false) {
    isRunning = false; 
    abort = true;
    ui.start.disabled = false;
    ui.stop.disabled = true;
    
    if (completed) {
        ui.stats.textContent = `Concluído! ${ui.list.children.length} nicks encontrados.`;
    } else {
        ui.stats.textContent += ' (Parado pelo usuário)';
    }
}

ui.start.addEventListener('click', startGeneration);
ui.stop.addEventListener('click', () => stopGeneration(false));
