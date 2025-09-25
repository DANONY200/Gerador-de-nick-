document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos da página
    const amountInput = document.getElementById('amount');
    const lengthInput = document.getElementById('length');
    const firstLetterInput = document.getElementById('first-letter');
    const charsetSelect = document.getElementById('charset');
    const underscoreCheckbox = document.getElementById('use-underscore');

    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');

    const statusText = document.getElementById('status-text');
    const progressBar = document.getElementById('progress-bar');
    const resultsLog = document.getElementById('results-log');

    // Variáveis de estado
    let isRunning = false;
    let foundNicks = [];
    const checkedNicks = new Set();

    // --- Lógica de Geração de Nicks ---
    function generateNick(length, firstLetter, charset, useUnderscore) {
        const charsets = {
            letters: 'abcdefghijklmnopqrstuvwxyz',
            digits: '0123456789',
            letters_digits: 'abcdefghijklmnopqrstuvwxyz0123456789',
            all: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        };

        let chars = charsets[charset] || charsets.letters;
        let nick = '';

        if (firstLetter) {
            nick += firstLetter;
            length--;
        }

        for (let i = 0; i < length; i++) {
            nick += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        if (useUnderscore && nick.length > 1) {
            const index = Math.floor(Math.random() * (nick.length - 1)) + 1; // Não coloca no início
            nick = nick.slice(0, index) + '_' + nick.slice(index);
        }

        return nick;
    }

    // --- Verificações de API ---
    async function checkAshcon(nick) {
        try {
            const response = await fetch(`https://api.ashcon.app/mojang/v2/user/${nick}`);
            return response.status === 404;
        } catch (error) {
            console.error(`Ashcon check failed for ${nick}:`, error);
            return false;
        }
    }

    async function checkMush(nick) {
        try {
            const response = await fetch(`https://mush.com.br/api/player/${nick}`);
            const data = await response.json();
            return !data.success && data.error_code === 404;
        } catch (error) {
            console.error(`Mush check failed for ${nick}:`, error);
            return false;
        }
    }
    
    // --- Lógica Principal de Geração e Verificação ---
    async function startGeneration() {
        // Obter e validar inputs
        const amount = parseInt(amountInput.value);
        const length = parseInt(lengthInput.value);
        const firstLetter = firstLetterInput.value;
        const charset = charsetSelect.value;
        const useUnderscore = underscoreCheckbox.checked;
        
        if (isNaN(amount) || amount <= 0) {
            alert("Por favor, insira uma quantidade válida.");
            return;
        }
        if (isNaN(length) || length < 4 || length > 16) {
            alert("O tamanho do nick deve ser entre 4 e 16 caracteres.");
            return;
        }

        // Configurar estado inicial
        isRunning = true;
        foundNicks = [];
        checkedNicks.clear();
        resultsLog.innerHTML = '';
        updateUI(true);

        let generatedCount = 0;
        let attempts = 0;
        const maxAttempts = amount * 100; // Limite de tentativas para evitar loops infinitos

        while (generatedCount < amount && isRunning && attempts < maxAttempts) {
            const nick = generateNick(length, firstLetter, charset, useUnderscore);
            attempts++;
            
            if (checkedNicks.has(nick)) {
                continue; // Pula nicks já verificados
            }
            checkedNicks.add(nick);

            statusText.textContent = `Verificando: ${nick}... (${generatedCount}/${amount} encontrados)`;

            // Verifica as duas APIs em paralelo para mais velocidade
            const [isAshconAvailable, isMushAvailable] = await Promise.all([
                checkAshcon(nick),
                checkMush(nick)
            ]);

            if (isAshconAvailable && isMushAvailable) {
                generatedCount++;
                foundNicks.push(nick);
                addNickToLog(nick);
            }
            
            const progress = (generatedCount / amount) * 100;
            progressBar.style.width = `${progress}%`;
        }

        finishGeneration(generatedCount, amount);
    }
    
    function stopGeneration() {
        isRunning = false;
        statusText.textContent = "Geração parada pelo usuário.";
        updateUI(false);
    }

    function finishGeneration(found, total) {
        isRunning = false;
        if (found >= total) {
            statusText.textContent = `Concluído! ${found} nicks válidos encontrados.`;
        } else {
             statusText.textContent = `Finalizado. Não foi possível encontrar a quantidade desejada. ${found} nicks encontrados.`;
        }
        updateUI(false);
    }

    // --- Funções de UI e Utilidades ---
    function updateUI(running) {
        startBtn.disabled = running;
        stopBtn.disabled = !running;
        amountInput.disabled = running;
        lengthInput.disabled = running;
        firstLetterInput.disabled = running;
        charsetSelect.disabled = running;
        underscoreCheckbox.disabled = running;
    }
    
    function addNickToLog(nick) {
        const li = document.createElement('li');
        li.textContent = nick;
        resultsLog.appendChild(li);
        resultsLog.scrollTop = resultsLog.scrollHeight; // Auto-scroll
    }

    function copyNicks() {
        if (foundNicks.length === 0) {
            alert("Nenhum nick foi encontrado para copiar.");
            return;
        }
        const textToCopy = foundNicks.join('\n');
        navigator.clipboard.writeText(textToCopy)
            .then(() => alert(`${foundNicks.length} nicks copiados para a área de transferência!`))
            .catch(err => console.error('Erro ao copiar nicks:', err));
    }

    function downloadNicks() {
         if (foundNicks.length === 0) {
            alert("Nenhum nick foi encontrado para baixar.");
            return;
        }
        const text = foundNicks.join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nicks_gerados.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Event Listeners para os botões
    startBtn.addEventListener('click', startGeneration);
    stopBtn.addEventListener('click', stopGeneration);
    copyBtn.addEventListener('click', copyNicks);
    downloadBtn.addEventListener('click', downloadNicks);
});
