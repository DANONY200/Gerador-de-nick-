document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('generator-form');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const copyBtn = document.getElementById('copy-btn');
    
    const amountInput = document.getElementById('amount');
    const lengthInput = document.getElementById('length');
    const firstLetterInput = document.getElementById('first-letter');
    const charsetSelect = document.getElementById('charset');
    const underscoreCheck = document.getElementById('use-underscore');
    
    const nicksList = document.getElementById('nicks-list');

    let isRunning = false;
    let foundNicks = [];
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        startGeneration();
    });

    stopBtn.addEventListener('click', stopGeneration);
    copyBtn.addEventListener('click', copyNicksToClipboard);
    
    function startGeneration() {
        if (isRunning) return;

        const amount = parseInt(amountInput.value);
        const length = parseInt(lengthInput.value);
        if (length < 4 || length > 16) {
            alert("O tamanho do nick deve ser entre 4 e 16 caracteres.");
            return;
        }

        isRunning = true;
        updateUI(true);
        clearResults();
        runRealApiGeneration();
    }
    
    function stopGeneration() {
        if (!isRunning) return;
        isRunning = false;
        updateUI(false);
    }

    function updateUI(running) {
        startBtn.disabled = running;
        stopBtn.disabled = !running;
        [amountInput, lengthInput, firstLetterInput, charsetSelect, underscoreCheck].forEach(el => el.disabled = running);
    }

    function clearResults() {
        nicksList.innerHTML = '';
        foundNicks = [];
    }
    
    function addFoundNick(nick) {
        foundNicks.push(nick);
        const li = document.createElement('li');
        li.textContent = nick;
        nicksList.appendChild(li);
        nicksList.scrollTop = nicksList.scrollHeight;
    }

    async function copyNicksToClipboard() {
        if (foundNicks.length === 0) {
            alert("Nenhum nick foi gerado para copiar.");
            return;
        }
        
        try {
            await navigator.clipboard.writeText(foundNicks.join('\n'));
            copyBtn.textContent = 'Copiado!';
            setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 2000);
        } catch (err) {
            console.error('Falha ao copiar nicks: ', err);
            alert("Não foi possível copiar os nicks.");
        }
    }

    async function checkAshcon(nick) {
        try {
            const response = await fetch(`https://api.ashcon.app/mojang/v2/user/${nick}`);
            return response.status === 404;
        } catch (error) {
            console.error(`Erro ao checar Ashcon para ${nick}:`, error);
            return false;
        }
    }

    async function checkMush(nick) {
        try {
            const response = await fetch(`https://mush.com.br/api/player/${nick}`);
            const data = await response.json();
            return data.success === false && data.error_code === 404;
        } catch (error) {
            console.error(`Erro ao checar Mush para ${nick}:`, error);
            return false;
        }
    }

    async function runRealApiGeneration() {
        const options = {
            amount: parseInt(amountInput.value),
            length: parseInt(lengthInput.value),
            firstLetter: firstLetterInput.value,
            charset: charsetSelect.value,
            useUnderscore: underscoreCheck.checked
        };
        let generatedCount = 0;
        const seenNicks = new Set();

        while (generatedCount < options.amount && isRunning) {
            let nick;
            do {
                nick = generateNick(options);
            } while (seenNicks.has(nick));
            seenNicks.add(nick);
            
            const isAshconAvailable = await checkAshcon(nick);
            const isMushAvailable = await checkMush(nick);

            if (isMushAvailable && isAshconAvailable) {
                generatedCount++;
                addFoundNick(nick);
            }
        }
        
        isRunning = false;
        updateUI(false);
    }
    
    function generateNick({ length, firstLetter, charset, useUnderscore }) {
        let chars = '';
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const digits = '0123456789';

        if (charset === 'letters') chars = lower;
        else if (charset === 'digits') chars = digits;
        else if (charset === 'letters_digits') chars = lower + digits;
        else if (charset === 'all') chars = lower + upper + digits;

        let base = '';
        const k = firstLetter ? length - 1 : length;
        for (let i = 0; i < k; i++) {
            base += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        if (firstLetter) {
            base = firstLetter.toLowerCase() + base;
        }

        if (useUnderscore && length > 1) {
            const index = Math.floor(Math.random() * length);
            base = base.substring(0, index) + '_' + base.substring(index + 1);
        }

        return base;
    }
});
