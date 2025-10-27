// Seletores do DOM
const lengthInput = document.getElementById('length');
const amountInput = document.getElementById('amount');
const firstLetterInput = document.getElementById('firstLetter');
const charsetInput = document.getElementById('charset');
const underscoreInput = document.getElementById('useUnderscore');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const resultsList = document.getElementById('resultsList');
const logElement = document.getElementById('log');

// Variável de controle
let isRunning = false;
let foundNicks = [];

// Helper: Pausa a execução (para não sobrecarregar a API)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Escreve no log da tela
function log(message) {
    console.log(message);
    logElement.textContent = message;
}

// 1. Geração do Nick (Tradução do seu Python)
function generateNick(length, firstLetter, charset, useUnderscore) {
    let chars = '';
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';

    if (charset === 'letters') {
        chars = letters;
    } else if (charset === 'letters_digits') {
        chars = letters + digits;
    }

    let base = '';
    if (firstLetter) {
        base = firstLetter.toLowerCase() + Array.from({ length: length - 1 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    } else {
        base = Array.from({ length: length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    }

    if (useUnderscore && length > 1) {
        const index = Math.floor(Math.random() * (length - 1)) + 1; // Não coloca no início
        base = base.substring(0, index) + '_' + base.substring(index + 1);
    }

    return base;
}

// 2. Verificação do Nick (APENAS Ashcon)
async function checkNickAvailability(nick) {
    // NOTA: Não podemos checar mush.com.br por causa de CORS.
    // Vamos checar apenas a API Ashcon, que permite requisições do navegador.
    
    const url = `https://api.ashcon.app/mojang/v2/user/${nick}`;
    
    try {
        const response = await fetch(url, { method: 'GET' });
        
        // Status 404 significa "Not Found", ou seja, o nick NÃO existe e está DISPONÍVEL.
        if (response.status === 404) {
            return true; // Disponível
        }
        
        // Qualquer outro status (como 200) significa que o nick foi encontrado e está OCUPADO.
        return false; // Ocupado
        
    } catch (error) {
        log(`Erro de rede ao checar ${nick}: ${error.message}`);
        return false; // Assumir como ocupado se houver erro
    }
}

// 3. Função principal de Geração
async function startGeneration() {
    if (isRunning) return;

    isRunning = true;
    foundNicks = [];
    resultsList.innerHTML = '';
    startButton.disabled = true;
    stopButton.disabled = false;
    log('Iniciando geração...');

    const length = parseInt(lengthInput.value, 10);
    const amount = parseInt(amountInput.value, 10);
    const firstLetter = firstLetterInput.value;
    const charset = charsetInput.value;
    const useUnderscore = underscoreInput.checked;

    let foundCount = 0;
    let attempts = 0;
    const seen = new Set(); // Para não checar o mesmo nick duas vezes

    while (foundCount < amount && isRunning) {
        attempts++;
        let nick = generateNick(length, firstLetter, charset, useUnderscore);

        if (seen.has(nick)) {
            continue; // Já tentamos esse
        }
        seen.add(nick);
        
        log(`Tentando nick: ${nick} (Tentativa ${attempts})`);

        const isAvailable = await checkNickAvailability(nick);

        if (isAvailable) {
            foundCount++;
            foundNicks.push(nick);
            
            // Adiciona na lista da tela
            const li = document.createElement('li');
            li.textContent = nick;
            resultsList.appendChild(li);
            
            log(`Nick VÁLIDO encontrado: ${nick} (${foundCount}/${amount})`);
        }
        
        // Pausa de 300ms para não dar rate limit na API
        await sleep(300);
    }

    if (isRunning) {
        log(`Geração concluída! ${foundCount} nicks encontrados.`);
    } else {
        log('Geração interrompida pelo usuário.');
    }
    
    stopGeneration(); // Limpa o estado
}

// 4. Função de Parada
function stopGeneration() {
    isRunning = false;
    startButton.disabled = false;
    stopButton.disabled = true;
}

// 5. Event Listeners
startButton.addEventListener('click', startGeneration);
stopButton.addEventListener('click', stopGeneration);
