const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const sleep = (t = 250) => new Promise(r => setTimeout(r, t));

// Sistema de Cache para economizar requisições
const cache = {
    get: nick => {
        const val = sessionStorage.getItem(`chk-${nick}`);
        return val === null ? null : (val === 'true');
    },
    set: (nick, free) => sessionStorage.setItem(`chk-${nick}`, free)
};

// --- NOVA FUNÇÃO INTELIGENTE DE REQUISIÇÃO (O SEGREDO) ---
async function smartFetch(url) {
    let tentativas = 0;
    const maxTentativas = 4; // Tenta até 4 vezes se der erro

    while (tentativas < maxTentativas) {
        try {
            const res = await fetch(url);

            // Se for 429 (Rate Limit), o servidor pediu para esperar
            if (res.status === 429) {
                // Aumenta o tempo de espera a cada erro (Backoff Exponencial)
                const tempoEspera = 2000 + (tentativas * 1500);
                // Atualiza a interface discretamente se tiver UI
                console.warn(`⏳ Rate Limit detectado. Esperando ${tempoEspera}ms...`);
                await sleep(tempoEspera);
                tentativas++;
                continue;
            }

            // Se for erro de servidor (5xx), tenta de novo
            if (res.status >= 500) {
                await sleep(1000);
                tentativas++;
                continue;
            }

            return res; // Retorna a resposta se for 200 ou 404

        } catch (e) {
            // Erro de internet/rede
            await sleep(1000);
            tentativas++;
        }
    }
    return null; // Falhou todas as tentativas
}

// Verifica na API Ashcon (Mojang Wrapper)
async function ashcon(nick) {
    const res = await smartFetch(`https://api.ashcon.app/mojang/v2/user/${nick}`);
    if (!res) return false; // Se falhou a conexão, assume indisponível por segurança
    
    if (res.status === 404) return true;  // Disponível
    if (res.status === 200) return false; // Ocupado
    return false; // Outros erros
}

// Verifica na LabyMod (Backup)
async function labymod(nick) {
    const res = await smartFetch(`https://laby.net/api/v3/user/${nick}`);
    if (!res) return false;

    if (res.status === 404) return true;
    if (res.status === 200) return false;
    return false;
}

// Função Principal de Verificação
async function checkNickAvailability(nick) {
    // 1. Verifica cache primeiro
    const cached = cache.get(nick);
    if (cached !== null) return cached;

    try {
        // 2. Passo 1: Ashcon
        const step1 = await ashcon(nick);
        
        // Se Ashcon disse que tá ocupado, nem perde tempo com LabyMod
        if (step1 === false) {
            cache.set(nick, false);
            return false;
        }

        // 3. Passo 2: LabyMod (Confirmação Dupla para evitar falso positivo)
        // Só verifica no Laby se o Ashcon disse que estava livre
        const step2 = await labymod(nick);
        
        if (step2 === false) {
            cache.set(nick, false); // Era falso positivo do Ashcon
            return false;
        }

        // Se ambos disseram que é livre (ou true)
        if (step1 === true && step2 === true) {
            cache.set(nick, true);
            return true;
        }

        return false;

    } catch (e) {
        console.error(e);
        return false; // Na dúvida, diz que não tá disponível
    }
}

// --- GERADOR DE NICKS (MANTIDO E OTIMIZADO) ---
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

// --- CONTROLE DE INTERFACE (UI) ---
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
    
    // Animação de entrada
    li.style.animation = "fadeIn 0.5s";
    
    const span = document.createElement('span');
    span.textContent = nick;
    span.style.fontWeight = "bold";
    span.style.color = "#4ade80"; // Verde neon

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copiar';
    btn.onclick = () => {
        navigator.clipboard.writeText(nick);
        btn.textContent = 'Copiado!';
        btn.style.background = '#22c55e';
        setTimeout(() => {
            btn.textContent = 'Copiar';
            btn.style.background = '';
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
    ui.stats.textContent = '🚀 Iniciando motores...';

    const len = +ui.length.value;
    const target = +ui.amount.value;
    const first = ui.first.value.trim();
    const charset = ui.charset.value;
    const allowUnder = ui.underscore.checked;
    const isTurbo = ui.turbo.checked;
    
    // Ajuste de segurança para não travar o navegador
    const concurrency = isTurbo ? 15 : 3; 

    const seen = new Set();
    let found = 0;
    let attempts = 0;
    let speed = 0;
    let startTime = Date.now();

    const speedInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        speed = Math.round(attempts / elapsed);
        ui.stats.textContent = `⚡ Verificados: ${attempts} | Vel: ${speed}/s | ✅ Achados: ${found}/${target}`;
    }, 1000);

    while (found < target && !abort) {
        const batch = [];
        
        // Gera um lote de nicks
        while (batch.length < concurrency) {
            let nick = generateNick(len, first, charset, allowUnder);
            if (!seen.has(nick)) {
                seen.add(nick);
                batch.push(nick);
            }
            if(seen.size > 50000) seen.clear(); // Limpa memória
        }
        
        // Processa o lote em paralelo (Promise.all)
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
        
        // Pausa estratégica se não for Turbo (para evitar BAN de IP)
        if (!isTurbo) await sleep(200); 
        // Pausa mínima no Turbo para dar respiro à CPU
        else await sleep(50);
    }

    clearInterval(speedInterval);
    stopGeneration(found >= target);
}

function stopGeneration(completed = false) {
    isRunning = false; abort = true;
    ui.start.disabled = false;
    ui.stop.disabled = true;
    
    if (completed) {
        ui.stats.textContent = `🏆 Sucesso! ${ui.list.children.length} nicks encontrados.`;
    } else {
        ui.stats.textContent += ' (Parado pelo usuário)';
    }
}

ui.start.addEventListener('click', startGeneration);
ui.stop.addEventListener('click', () => stopGeneration(false));
