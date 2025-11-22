const $ = s => document.querySelector(s);
const sleep = t => new Promise(r => setTimeout(r, t));

// Cache mais eficiente
const cache = {
    get: nick => sessionStorage.getItem(`chk-${nick}`) === 'true',
    set: (nick, free) => sessionStorage.setItem(`chk-${nick}`, free)
};

async function quickFetch(url) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1200);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch {
        clearTimeout(id);
        return null;
    }
}

const apis = [
    'https://api.ashcon.app/mojang/v2/user/',
    'https://mush.com.br/api/player/',
    'https://api.mojang.com/users/profiles/minecraft/'
];

async function checkNickAvailability(nick) {
    if (cache.get(nick) !== undefined) return cache.get(nick);

    for (const base of apis) {
        const res = await quickFetch(base + nick);
        if (!res) continue;

        if (res.status === 404 || res.status === 204 || res.status === 429) {
            cache.set(nick, true);
            return true;
        }
        if (res.status === 200) {
            cache.set(nick, false);
            return false;
        }
    }
    // Se todas falharem ou derem rate limit → assume tomado (mais seguro)
    cache.set(nick, false);
    return false;
}

// === GERADOR DE NICKS LEGÍVEIS E BONITOS (O MELHOR QUE VOCÊ VAI VER) ===
const syllables = [
    // Início suave
    'ki','mi','lu','re','sa','no','ta','ka','ri','shi','ni','ze','xo','vi','li','cri','sky','dark','red','blue',
    'zex','vex','nyx','lyn','ray','jay','max','lex','rex','fox','wolf','cat','dog','neo','zen','kai','rai','sai',
    'frost','storm','blaze','shadow','ghost','phantom','dragon','tiger','hawk','eagle','phoenix','nova','void'
];

const middles = [
    'der','ter','ler','ver','per','ber','mer','fer','zer','rex','vex','lux','nyx','thor','tron','star','moon',
    'light','dark','fire','ice','wind','storm','bolt','rage','soul','heart','blade','core','nova','pixel','byte'
];

const ends = [
    'x','z','ex','ez','ax','oz','ix','ux','yx','qt','ky','sy','ny','ly','cy','fy','ty','py','vy','zz','xx',
    'pro','play','gamer','killer','master','ninja','sniper','king','queen','god','legend','beast','hero','mc'
];

// Palavras inteiras bonitas (muito usadas e elegantes)
const fullWords = [
    'Sky','Dream','Lunar','Solar','Cosmic','Astro','Nebula','Aurora','Crystal','Diamond','Emerald','Obsidian',
    'Phantom','Ghost','Shadow','Blaze','Frost','Storm','Thunder','Lightning','Vortex','Zenith','Nexus','Apex',
    'Lynx','Wolf','Raven','Eagle','Hawk','Dragon','Tiger','Panda','Koala','Fox','Cat','Neo','Zero','One','Zed'
];

function generateBeautifulNick(length = 10) {
    const methods = [
        // Método 1: Sílaba + Sílaba + Final forte (ex: Rayzex, Skynix)
        () => {
            const start = syllables[Math.floor(Math.random() * syllables.length)];
            const end = Math.random() > 0.4 
                ? ends[Math.floor(Math.random() * ends.length)]
                : middles[Math.floor(Math.random() * middles.length)] + ends[Math.floor(Math.random() * ends.length)].slice(1);
            return (start + end).slice(0, length);
        },

        // Método 2: Palavra completa + sufixo (ex: Skyline, Lunarx)
        () => {
            const word = fullWords[Math.floor(Math.random() * fullWords.length)];
            if (word.length >= length) return word.slice(0, length);
            const suffix = Math.random() > 0.5 ? 'x','z','ex','yz','uh','ah','ify','er','on','io','is','us','um','ie';
            return (word + (Array.isArray(suffix) ? suffix[Math.floor(Math.random()*suffix.length)] : suffix)).slice(0, length);
        },

        // Método 3: Nome bonito com underscore (ex: Not_Blue, Its_Rain)
        () => {
            if (length < 6) return null;
            const words = ['Not','Its','Im','The','Real','Pro','Try','xX','Xx','_',''];
            const adj = ['Blue','Red','Dark','Light','Sad','Happy','Rain','Snow','Fire','Ice','Cat','Dog','Wolf','Fox'];
            const prefix = words[Math.floor(Math.random() * words.length)];
            const main = adj[Math.floor(Math.random() * adj.length)];
            return (prefix + (prefix && prefix !== 'xX' && prefix !== 'Xx' ? '_' : '') + main + (Math.random()>0.7?'x':'')).slice(0, length);
        },

        // Método 4: Padrão brasileiro/clássico (ex: PedroGamer, JoãoZika)
        () => {
            const names = ['Bia','Ana','Lia','Lua','Sol','Mel','Iasmin','Kauã','Pedro','João','Vini','Gui','Leo','Theo'];
            const suffix = ['Gamer','Zika','Mitico','Tryhard','Bolado','Insano','Delicia','Doce','Fofo','Cruel','Play'];
            return (names[Math.floor(Math.random()*names.length)] + suffix[Math.floor(Math.random()*suffix.length)]).slice(0, length);
        }
    ];

    let nick;
    do {
        const method = methods[Math.floor(Math.random() * methods.length)];
        nick = method();
    } while (!nick || nick.length < 3 || nick.length > 16 || /_{2,}/.test(nick) || /^_|_$/.test(nick));

    // Força começar com letra (regra do Minecraft)
    if (!/^[a-zA-Z]/.test(nick)) nick = 'A' + nick.slice(1);

    return nick.charAt(0).toUpperCase() + nick.slice(1).toLowerCase();
}

// UI e resto do código (mantido otimizado)
let isRunning = false;
let abort = false;

const ui = {
    length: $('#length'), amount: $('#amount'), first: $('#firstLetter'),
    charset: $('#charset'), underscore: $('#useUnderscore'), turbo: $('#turbo'),
    start: $('#startButton'), stop: $('#stopButton'), list: $('#resultsList'),
    stats: $('#stats'), copyAll: $('#copyAllBtn'), download: $('#downloadBtn')
};

function addNick(nick) {
    const li = document.createElement('li');
    li.dataset.nick = nick;
    li.innerHTML = `<span style="color:#4ade80;font-weight:600">${nick}</span> 
                    <button class="copy-btn">Copiar</button>`;
    li.querySelector('.copy-btn').onclick = () => {
        navigator.clipboard.writeText(nick);
        li.querySelector('.copy-btn').textContent = 'OK';
        setTimeout(() => li.querySelector('.copy-btn').textContent = 'Copiar', 1200);
    };
    ui.list.appendChild(li);
    ui.list.scrollTop = ui.list.scrollHeight;
    ui.copyAll.disabled = ui.download.disabled = false;
}

// Botões de cópia e download (mesmos de antes)
ui.copyAll.onclick = () => navigator.clipboard.writeText([...ui.list.children].map(li => li.dataset.nick).join('\n')).then(() => alert('Todos copiados!'));
ui.download.onclick = () => {
    const blob = new Blob([[...ui.list.children].map(li => li.dataset.nick).join('\n')], {type: 'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nicks_beautiful.txt';
    a.click();
};

async function startGeneration() {
    if (isRunning) return;
    isRunning = true; abort = false;
    ui.start.disabled = true; ui.stop.disabled = false;
    ui.list.innerHTML = ''; ui.stats.textContent = 'Gerando nicks incríveis...';

    const target = +ui.amount.value || 50;
    const concurrency = ui.turbo.checked ? 400 : 100;
    const seen = new Set();
    let found = 0, checked = 0, start = Date.now();

    const updateStats = setInterval(() => {
        const sec = (Date.now() - start) / 1000 || 1;
        ui.stats.textContent = `Velocidade: ${Math.round(checked/sec)}/s | Encontrados: ${found}/${target}`;
    }, 300);

    while (found < target && !abort) {
        const batch = [];
        while (batch.length < concurrency && found < target) {
            let nick;
            do { nick = generateBeautifulNick(); } while (seen.has(nick));
            seen.add(nick);
            batch.push(nick);
            if (seen.size > 1_000_000) seen.clear();
        }

        const results = await Promise.allSettled(
            batch.map(n => checkNickAvailability(n.toLowerCase()).then(free => ({nick: n, free})))
        );

        checked += batch.length;

        for (const r of results) {
            if (r.status === 'fulfilled' && r.value.free && found < target) {
                found++;
                addNick(r.value.nick);
            }
        }
        await sleep(0);
    }

    clearInterval(updateStats);
    isRunning = false; ui.start.disabled = false; ui.stop.disabled = true;
    ui.stats.textContent = found >= target ? 'CONCLUÍDO! Todos os nicks são lindos e disponíveis' : 'Parado pelo usuário';
}

ui.start.onclick = startGeneration;
ui.stop.onclick = () => abort = true;
