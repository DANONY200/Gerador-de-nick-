document.addEventListener('DOMContentLoaded', () => {
    // Seleção de Elementos
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
    const statusMessage = document.getElementById('status-message'); // (MELHORIA)

    // Estado da Aplicação
    let isRunning = false;
    let foundNicks = [];
    
    // Event Listeners
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        startGeneration();
    });

    stopBtn.addEventListener('click', stopGeneration);
    copyBtn.addEventListener('click', copyNicksToClipboard);

    // --- Funções de Controle ---

    function startGeneration() {
        if (isRunning) return;

        // Validação de inputs
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
        updateUI(false);
        updateStatus("Geração parada.");
    }

    /** (MELHORIA) Atualiza a UI e a área de status */
    function updateStatus(message, isError = false) {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.style.color = isError ? 'var(--error-color)' : 'var(--text-secondary)';
    }

    /** Atualiza o estado (habilitado/desabilitado) dos controles */
    function updateUI(running) {
        isRunning = running; // Garante que o estado seja o mesmo
        startBtn.disabled = running;
        stopBtn.disabled = !running;
        // (MELHORIA) Botão de copiar só é habilitado se não estiver rodando E tiver nicks
        copyBtn.disabled = running || foundNicks.length === 0;
        [amountInput, lengthInput, firstLetterInput, charsetSelect, underscoreCheck]
            .forEach(el => el.disabled = running);
    }

    /** Limpa a lista de nicks e o status */
    function clearResults() {
        nicksList.innerHTML = '';
        foundNicks = [];
        copyBtn.disabled = true; // (MELHORIA)
        updateStatus(""); // Limpa a mensagem de status
    }
    
    /** Adiciona um nick à lista visual e ao array */
    function addFoundNick(nick) {
        foundNicks.push(nick);
        const li = document.createElement('li');
        li.textContent = nick;
        nicksList.appendChild(li);
        nicksList.scrollTop = nicksList.scrollHeight;
        
        copyBtn.disabled = false; // (MELHORIA) Habilita o botão
        updateStatus(`Nick encontrado: ${nick}`); // (MELHORIA)
    }

    /** (MELHORIA) Copia para clipboard usando a API e atualiza status */
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

    // --- Funções de API ---

    /** Checa disponibilidade na API Ashcon (Mojang) */
    async function checkAshcon(nick) {
        try {
            const response = await fetch(`https://api.ashcon.app/mojang/v2/user/${nick}`);
            // 404 = Not Found (Disponível)
            return response.status === 404;
        } catch (error) {
            console.error(`Erro ao checar Ashcon para ${nick}:`, error);
            return false; // Seguro: Assume que não está disponível em caso de erro
        }
    }

    /** Checa disponibilidade na API Mush */
    async function checkMush(nick) {
        try {
            const response = await fetch(`https://mush.com.br/api/player/${nick}`);
            const data = await response.json();
            // API retorna success:false e error_code:404 se não existir
            return data.success === false && data.error_code === 404;
        } catch (error) {
            console.error(`Erro ao checar Mush para ${nick}:`, error);
            return false; // Seguro: Assume que não está disponível
        }
    }

    // --- Lógica Principal de Geração ---

    /** Roda o loop principal de geração e verificação */
    async function runRealApiGeneration() {
        const options = {
            amount: parseInt(amountInput.value),
            length: parseInt(lengthInput.value),
            firstLetter: firstLetterInput.value.toLowerCase(), // Normaliza
            charset: charsetSelect.value,
            useUnderscore: underscoreCheck.checked
        };
        let generatedCount = 0;
        const seenNicks = new Set(); // Evita checar o mesmo nick duas vezes

        while (generatedCount < options.amount && isRunning) {
            let nick;
            do {
                nick = generateNick(options);
            } while (seenNicks.has(nick)); // Gera novo se já vimos esse
            
            seenNicks.add(nick);
            
            // (MELHORIA DE PERFORMANCE) Roda as duas checagens em paralelo
            const [isAshconAvailable, isMushAvailable] = await Promise.all([
                checkAshcon(nick),
                checkMush(nick)
            ]);

            // Só adiciona se estiver disponível em AMBAS as plataformas
            if (isMushAvailable && isAshconAvailable && isRunning) {
                generatedCount++;
                addFoundNick(nick);
            }
        }
        
        // Finaliza o processo
        updateStatus(isRunning ? `Geração concluída. ${generatedCount} nicks encontrados.` : "Geração parada.");
        updateUI(false);
    }
    
    /** Gera um nick aleatório baseado nas opções */
    function generateNick({ length, firstLetter, charset, useUnderscore }) {
        let chars = '';
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const digits = '0123456789';

        // Define o conjunto de caracteres base
        if (charset === 'letters') chars = lower;
        else if (charset === 'digits') chars = digits;
        else if (charset === 'letters_digits') chars = lower + digits;
        else if (charset === 'all') chars = lower + upper + digits;

        // (CORREÇÃO DE BUG) Adiciona underscore ao conjunto, em vez de substituir
        if (useUnderscore) {
            chars += '_';
        }

        // Se o charset ainda estiver vazio (ex: só underscore), usa letras
        if (chars === '' || chars === '_') {
            chars = lower + (useUnderscore ? '_' : '');
        }

        let result = '';
        const remainingLength = firstLetter ? length - 1 : length;
        
        for (let i = 0; i < remainingLength; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        // Adiciona a primeira letra (já normalizada para minúscula)
        if (firstLetter) {
            result = firstLetter + result;
        }

        return result;
    }
});
