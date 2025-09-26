document.addEventListener('DOMContentLoaded', () => {
    const amountInput = document.getElementById('amount');
    const lengthInput = document.getElementById('nick-length');
    const firstLetterInput = document.getElementById('first-letter');
    const charsetSelect = document.getElementById('charset-type');
    const underscoreCheckbox = document.getElementById('use-underscore');
    const generateButton = document.getElementById('generate-button');
    const resultsList = document.getElementById('results-list');
    const copyAllButton = document.getElementById('copy-all-button');

    // Mapeamento de caracteres para geração
    const CHARSETS = {
        'letters': 'abcdefghijklmnopqrstuvwxyz',
        'digits': '0123456789',
        'letters_digits': 'abcdefghijklmnopqrstuvwxyz0123456789',
        'all': 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_' 
    };

    let availableNicks = [];
    // Define o número de checagens a serem feitas em paralelo a cada rodada.
    const BATCH_SIZE = 10; 
    let isRunning = false;
    const generatedNicksSet = new Set(); // Para evitar checar o mesmo nick duas vezes

    /**
     * Gera um nickname aleatório com base nas configurações. (Função inalterada)
     */
    function generateNick(length, firstLetter, charsetType, useUnderscore) {
        let chars = CHARSETS[charsetType];
        let base = '';

        if (firstLetter) {
            base += firstLetter.toLowerCase();
            length--;
        }

        for (let i = 0; i < length; i++) {
            base += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        if (useUnderscore && base.length >= 4) {
            let insertionIndex = Math.floor(Math.random() * (base.length - 2)) + 1;
            base = base.substring(0, insertionIndex) + '_' + base.substring(insertionIndex + 1);
        }

        if (base.startsWith('_')) base = base.substring(1) + base[0];
        if (base.endsWith('_')) base = base[base.length - 1] + base.substring(0, base.length - 1);
        
        return base.substring(0, lengthInput.value);
    }

    /**
     * SIMULAÇÃO: Checa a disponibilidade do nick. (Função inalterada)
     * @returns {Promise<boolean>} 
     */
    async function checkAvailability(nick) {
        // SIMULAÇÃO DE LATÊNCIA DA REDE
        await new Promise(resolve => setTimeout(resolve, 500)); 

        if (/(.)\1/.test(nick.toLowerCase()) || nick.includes('test')) {
            return false;
        }
        
        if (nick.toLowerCase().endsWith('pro') || nick.toLowerCase().endsWith('vip')) {
            return false;
        }

        return true; 
    }

    /**
     * Renderiza o resultado de um nick na lista. (Função inalterada)
     */
    function renderNick(nick, isAvailable) {
        const item = document.createElement('div');
        item.classList.add('nick-item');
        
        const nickElement = document.createElement('span');
        nickElement.classList.add('nick-name');
        nickElement.textContent = nick;

        const statusElement = document.createElement('span');
        statusElement.classList.add('status-check');
        
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-nick-btn');
        copyButton.innerHTML = '<i class="fas fa-clipboard"></i>';
        copyButton.addEventListener('click', () => copyToClipboard(nick));

        if (isAvailable) {
            statusElement.textContent = '✅ DISPONÍVEL';
            statusElement.style.color = 'var(--primary-color)';
            item.appendChild(nickElement);
            item.appendChild(statusElement);
            item.appendChild(copyButton);
            resultsList.prepend(item);
        } else {
            statusElement.textContent = '❌ INDISPONÍVEL';
            statusElement.style.color = 'var(--danger-color)';
            item.style.opacity = '0.5';
            item.appendChild(nickElement);
            item.appendChild(statusElement);
            item.appendChild(copyButton);
            resultsList.appendChild(item);
        }
    }

    /**
     * Função auxiliar para copiar texto para a área de transferência. (Função inalterada)
     */
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(() => {
                alert(`"${text}" copiado!`);
            })
            .catch(err => {
                console.error('Erro ao copiar: ', err);
                alert('Falha ao copiar. Tente manualmente.');
            });
    }

    /**
     * Restaura o botão de geração.
     */
    function resetButton() {
        generateButton.disabled = false;
        generateButton.innerHTML = '<i class="fas fa-magic"></i> Gerar Nicks';
        isRunning = false;
    }

    /**
     * Manipulador principal do botão de geração.
     */
    generateButton.addEventListener('click', async () => {
        if (isRunning) return; // Previne cliques múltiplos
        isRunning = true;

        // 1. Configuração inicial
        resultsList.innerHTML = '';
        availableNicks = [];
        copyAllButton.disabled = true;
        
        resultsList.innerHTML = '<p class="placeholder-text">Gerando e verificando, aguarde...</p>';
        generateButton.disabled = true;
        generateButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

        const amount = parseInt(amountInput.value);
        const length = parseInt(lengthInput.value);
        const firstLetter = firstLetterInput.value.trim();
        const charsetType = charsetSelect.value;
        const useUnderscore = underscoreCheckbox.checked;
        
        // Validação
        if (length < 4 || length > 16 || amount < 1) {
            alert("Erro de entrada: O tamanho deve ser entre 4-16 e a quantidade deve ser maior que 0.");
            resetButton();
            return;
        }

        let foundCount = 0;
        let attempts = 0;
        const maxAttempts = amount * 10; // Limite de tentativas para geração

        // 2. Loop principal de Geração em Lotes e Checagem Paralela
        while (foundCount < amount && attempts < maxAttempts) {
            const nicksToGenerate = Math.min(BATCH_SIZE, amount - foundCount);
            const batchNicks = [];

            // Geração de um lote de nicks
            for (let i = 0; i < nicksToGenerate; i++) {
                let newNick = generateNick(length, firstLetter, charsetType, useUnderscore);
                attempts++;
                
                // Garante que o nick não foi gerado/checado antes
                if (!generatedNicksSet.has(newNick)) {
                    generatedNicksSet.add(newNick);
                    batchNicks.push(newNick);
                } else {
                    i--; // Tenta gerar outro se houver repetição
                }
            }

            if (batchNicks.length === 0) continue; // Sai se não gerou nada novo

            // Cria um array de Promises (checa todos os nicks do lote em paralelo)
            const checkPromises = batchNicks.map(nick => 
                checkAvailability(nick).then(isAvailable => ({ nick, isAvailable }))
            );
            
            // Espera que todas as checagens do lote terminem
            const results = await Promise.all(checkPromises);
            
            // Processa os resultados do lote
            results.forEach(({ nick, isAvailable }) => {
                renderNick(nick, isAvailable);
                if (isAvailable) {
                    availableNicks.push(nick);
                    foundCount++;
                }
            });

            // Se atingimos a quantidade desejada, encerra.
            if (foundCount >= amount) break;
            
            // Dê um pequeno respiro para o navegador entre os lotes (opcional, mas bom para UX)
            await new Promise(resolve => setTimeout(resolve, 50)); 
        }
        
        // 3. Finalização
        resultsList.querySelector('.placeholder-text')?.remove();
        if (availableNicks.length > 0) {
            copyAllButton.disabled = false;
        }
        
        resultsList.insertAdjacentHTML('beforeend', `<p class="placeholder-text">Fim da Geração. ${availableNicks.length} nicks disponíveis encontrados (Total de tentativas: ${attempts}).</p>`);
        resetButton();
    });

    /**
     * Manipulador do botão de copiar todos. (Função inalterada)
     */
    copyAllButton.addEventListener('click', () => {
        if (availableNicks.length > 0) {
            const allNicks = availableNicks.join('\n');
            copyToClipboard(allNicks);
        }
    });
    
    copyAllButton.disabled = true;
});
