document.addEventListener('DOMContentLoaded', () => {
    const amountInput = document.getElementById('amount');
    const lengthInput = document.getElementById('nick-length');
    const firstLetterInput = document.getElementById('first-letter');
    const charsetSelect = document.getElementById('charset-type');
    const underscoreCheckbox = document.getElementById('use-underscore');
    const generateButton = document.getElementById('generate-button');
    const resultsList = document.getElementById('results-list');
    const copyAllButton = document.getElementById('copy-all-button');

    const CHARSETS = {
        'letters': 'abcdefghijklmnopqrstuvwxyz',
        'digits': '0123456789',
        'letters_digits': 'abcdefghijklmnopqrstuvwxyz0123456789',
        'all': 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' // Removidos símbolos problemáticos para nicks
    };

    let availableNicks = [];
    const BATCH_SIZE = 10; 
    let isRunning = false;
    const generatedNicksSet = new Set(); 

    /**
     * Gera um nickname aleatório com base nas configurações.
     */
    function generateNick(length, firstLetter, charsetType, useUnderscore) {
        // [Lógica de geração inalterada para manter a funcionalidade original]
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
     * INTEGRAÇÃO REAL DA API: Função que seu back-end precisa implementar.
     * Esta função agora fará a chamada para o seu servidor proxy.
     * * SEU BACK-END DEVE:
     * 1. Receber o 'nick'.
     * 2. Chamar a API Ashcon: `https://api.ashcon.app/mojang/v2/user/{nick}`
     * 3. Chamar a API Mush: `https://mush.com.br/api/player/{nick}`
     * 4. Retornar TRUE apenas se AMBAS retornarem status 404 (Disponível).
     * * @param {string} nick - O nickname a ser checado.
     * @returns {Promise<boolean>} Promessa que resolve para true se disponível, false caso contrário.
     */
    async function checkAvailability(nick) {
        // --- SUBSTITUIÇÃO DA SIMULAÇÃO POR CHAMADA REAL (VIA PROXY) ---
        try {
            // OBS: Você precisa configurar este endpoint no seu servidor
            const response = await fetch(`/api/check-nick?nick=${nick}`, {
                method: 'GET',
                // Use a linha abaixo se o seu back-end estiver em outro domínio
                // mode: 'cors', 
            });

            if (!response.ok) {
                // Se o servidor de back-end falhar (ex: 500 Internal Error)
                console.error(`Back-end retornou erro para ${nick}: ${response.status}`);
                return false; 
            }

            const data = await response.json();
            
            // Esperamos que o back-end retorne { isAvailable: true/false }
            return data.isAvailable === true;

        } catch (error) {
            // Erro de rede ou CORS se o proxy não estiver configurado corretamente
            console.error(`Erro de rede ou proxy ao checar ${nick}:`, error);
            return false;
        }
        // --- FIM DA CHAMADA VIA PROXY ---
    }

    /**
     * Renderiza o resultado de um nick na lista.
     */
    function renderNick(nick, isAvailable) {
        const item = document.createElement('div');
        item.classList.add('nick-item', isAvailable ? 'available' : 'taken');
        
        const nickElement = document.createElement('span');
        nickElement.classList.add('nick-name');
        nickElement.textContent = nick;

        const statusElement = document.createElement('span');
        statusElement.classList.add('status-check');
        statusElement.textContent = isAvailable ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL';
        statusElement.style.color = isAvailable ? 'var(--success-color)' : 'var(--danger-color)';
        
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-nick-btn');
        copyButton.innerHTML = '<i class="fas fa-clipboard"></i> Copiar';
        copyButton.addEventListener('click', () => copyToClipboard(nick));

        item.appendChild(nickElement);
        item.appendChild(statusElement);
        item.appendChild(copyButton);

        // Adiciona disponíveis no topo e indisponíveis no final
        if (isAvailable) {
            resultsList.prepend(item); 
        } else {
            resultsList.appendChild(item); 
        }
    }

    // [Funções auxiliares de cópia e reset inalteradas]
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

    function resetButton() {
        generateButton.disabled = false;
        generateButton.innerHTML = '<i class="fas fa-magic"></i> Gerar Nicks';
        isRunning = false;
    }

    /**
     * Manipulador principal do botão de geração com verificação paralela.
     */
    generateButton.addEventListener('click', async () => {
        if (isRunning) return; 
        isRunning = true;

        // 1. Configuração inicial
        resultsList.innerHTML = '';
        availableNicks = [];
        copyAllButton.disabled = true;
        
        resultsList.innerHTML = '<p class="placeholder-text">Gerando e verificando... Conectando ao servidor proxy.</p>';
        generateButton.disabled = true;
        generateButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando e Checando...';

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
        const maxAttempts = amount * 10; 

        // 2. Loop principal de Geração em Lotes e Checagem Paralela
        while (foundCount < amount && attempts < maxAttempts) {
            const nicksToGenerate = Math.min(BATCH_SIZE, amount - foundCount);
            const batchNicks = [];

            // Geração de um lote de nicks
            for (let i = 0; i < nicksToGenerate; i++) {
                let newNick = generateNick(length, firstLetter, charsetType, useUnderscore);
                attempts++;
                
                if (!generatedNicksSet.has(newNick)) {
                    generatedNicksSet.add(newNick);
                    batchNicks.push(newNick);
                } else {
                    i--; 
                }
            }

            if (batchNicks.length === 0) continue; 

            // Checa todos os nicks do lote em paralelo (usando Promise.all)
            const checkPromises = batchNicks.map(nick => 
                checkAvailability(nick).then(isAvailable => ({ nick, isAvailable }))
            );
            
            const results = await Promise.all(checkPromises);
            
            // Processa os resultados
            results.forEach(({ nick, isAvailable }) => {
                // A renderização é feita sequencialmente para manter a ordem de logs/visibilidade
                renderNick(nick, isAvailable);
                if (isAvailable) {
                    availableNicks.push(nick);
                    foundCount++;
                }
            });

            if (foundCount >= amount) break;
            
            // Pequeno respiro
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

    copyAllButton.addEventListener('click', () => {
        if (availableNicks.length > 0) {
            const allNicks = availableNicks.join('\n');
            copyToClipboard(allNicks);
        }
    });
    
    copyAllButton.disabled = true;
});
