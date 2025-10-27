document.addEventListener('DOMContentLoaded', () => {
    // Seleção de Elementos (igual)
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
    const statusMessage = document.getElementById('status-message'); 

    // Estado da Aplicação (igual)
    let isRunning = false;
    let foundNicks = [];
    
    // Event Listeners (igual)
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        startGeneration();
    });

    stopBtn.addEventListener('click', stopGeneration);
    copyBtn.addEventListener('click', copyNicksToClipboard);

    // --- (NOVA FUNÇÃO) ---
    /** * Adiciona um atraso (delay) em milissegundos.
     * Isso é essencial para evitar o Rate Limit (erro 429) das APIs.
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // --- Funções de Controle (iguais) ---

    function startGeneration() {
        if (isRunning) return;

        const length = parseInt(lengthInput.value);
        if (length < 4 || length > 16) {
            updateStatus("O tamanho do nick deve ser entre 4 e 16.", true);
            return;
        }
        if (firstLetterInput.value && !/^[a-zA-Z]*$/.test(firstLetterInput.value)) {
             updateStatus("Primeira letra deve ser A-Z.", true);
            return;
        }

        isRunning = true;
        updateUI(true);
        clearResults();
        updateStatus("Buscando nicks... ⌛");
        runRealApiGeneration();
    }
    
    function stopGeneration() {
        if (!isRunning) return;
        isRunning = false;
        // A mensagem de status será atualizada pelo loop quando ele parar
    }

    function updateStatus(message, isError = false) {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.style.color = isError ? 'var(--error-color)' : 'var(--text-secondary)';
    }

    function updateUI(running) {
        isRunning = running; 
        startBtn.disabled = running;
        stopBtn.disabled = !running;
        copyBtn.disabled = running || foundNicks.length === 0;
        [amountInput, lengthInput, firstLetterInput, charsetSelect, underscoreCheck]
            .forEach(el => el.disabled = running);
    }

    function clearResults() {
        nicksList.innerHTML = '';
        foundNicks = [];
        copyBtn.disabled = true; 
        updateStatus(""); 
    }
    
    function addFoundNick(nick) {
        foundNicks.push(nick);
        const li = document.createElement('li');
        li.textContent = nick;
        nicksList.appendChild(li);
        nicksList.scrollTop = nicksList.scrollHeight;
        
        copyBtn.disabled = false; 
        updateStatus(`Nick encontrado: ${nick}`); 
    }

    async function copyNicksToClipboard() {
        if (foundNicks.length === 0) {
            updateStatus("Nenhum nick para copiar.", true);
            return;
        }
        
        try {
            await navigator.clipboard.writeText(foundNicks.join('\n'));
            copyBtn.textContent = 'Copiado!';
            updateStatus("Nicks copiados para a área de transferência! 👍");
            setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 2000);
        } catch (err) {
            console.error('Falha ao copiar nicks: ', err);
            updateStatus("Falha ao copiar. Verifique o console.", true);
        }
    }

    // --- Funções de API (iguais) ---

    async function checkAshcon(nick) {
        try {
            const response = await fetch(`https://api.ashcon.app/mojang/v2/user/${nick}`);
            // 404 = Not Found (Disponível)
            return response.status === 404;
        } catch (error) {
            console.error(`Erro ao checar Ashcon para ${nick}:`, error);
            // (MELHORIA) Se o erro for 429, loga especificamente
            if (error instanceof Response && error.status === 429) {
                 console.warn(`[Ashcon] Rate limit atingido!`);
            }
            return false; // Seguro: Assume que não está disponível em caso de erro
        }
    }

    async function checkMush(nick) {
        try {
            const response = await fetch(`https://mush.com.br/api/player/${nick}`);
            // (MELHORIA) Checa se a resposta foi 429 ANTES de tentar ler o JSON
            if (response.status === 429) {
                console.warn(`[Mush] Rate limit atingido!`);
                return false;
            }
            const data = await response.json();
            return data.success === false && data.error_code === 404;
        } catch (error) {
            console.error(`Erro ao checar Mush para ${nick}:`, error);
            return false; 
        }
    }

    // --- Lógica Principal de Geração (COM MELHORIA) ---

    async function runRealApiGeneration() {
        const options = {
            amount: parseInt(amountInput.value),
            length: parseInt(lengthInput.value),
            firstLetter: firstLetterInput.value.toLowerCase(), 
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

            // (MELHORIA DE UX) Informa o usuário qual nick está sendo checado
            // Isso é bom pois agora haverá um delay
            updateStatus(`Verificando: ${nick}...`);
            
            const [isAshconAvailable, isMushAvailable] = await Promise.all([
                checkAshcon(nick),
                checkMush(nick)
            ]);

            if (isMushAvailable && isAshconAvailable && isRunning) {
                generatedCount++;
                addFoundNick(nick); // Esta função já atualiza o status
            }

            // --- (MELHORIA CRÍTICA) ---
            // Adiciona um atraso de 1 segundo (1000ms) para evitar
            // o bloqueio das APIs (Rate Limit / Erro 429).
            if (isRunning) {
                await delay(1000);
            }
        }
        
        // Finaliza o processo
        updateStatus(isRunning ? `Geração concluída. ${generatedCount} nicks encontrados.` : "Geração parada.");
        updateUI(false);
    }
    
    // Função de Geração de Nick (igual)
    function generateNick({ length, firstLetter, charset, useUnderscore }) {
        let chars = '';
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const digits = '0123456789';

        if (charset === 'letters') chars = lower;
        else if (charset === 'digits') chars = digits;
        else if (charset === 'letters_digits') chars = lower + digits;
        else if (charset === 'all') chars = lower + upper + digits;

        if (useUnderscore) {
            chars += '_';
        }

        if (chars === '' || chars === '_') {
            chars = lower + (useUnderscore ? '_' : '');
        }

        let result = '';
        const remainingLength = firstLetter ? length - 1 : length;
        
        for (let i = 0; i < remainingLength; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        if (firstLetter) {
            result = firstLetter + result;
        }

        return result;
    }
});
