// ==========================================
// ESTADO E BANCO DE DADOS OFFLINE
// ==========================================
let db;
let servicoEmEdicaoId = null;
let fotoAtualEdicao = null;

const request = indexedDB.open("AppRelatorios", 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains('servicos')) db.createObjectStore('servicos', { keyPath: 'id', autoIncrement: true });
    if (!db.objectStoreNames.contains('locais')) db.createObjectStore('locais', { keyPath: 'nome' });
    if (!db.objectStoreNames.contains('itens')) db.createObjectStore('itens', { keyPath: 'nome' });
};

request.onsuccess = function(event) {
    db = event.target.result;
    carregarRegistros();
    // Preenche inicial se estiver vazio
    const tx = db.transaction("locais", "readonly");
    tx.objectStore("locais").count().onsuccess = e => {
        if(e.target.result === 0) {
            inserirPadrao('locais', 'Ponto 16');
            inserirPadrao('locais', 'Ponto 17');
        }
    };
};

function inserirPadrao(tabela, valor) {
    const transaction = db.transaction([tabela], "readwrite");
    transaction.objectStore(tabela).put({ nome: valor });
}

// ==========================================
// NAVEGAÇÃO E CONTROLE DE TELAS
// ==========================================
window.voltarInicio = function() {
    document.getElementById('tela-inicial').classList.remove('oculto');
    document.getElementById('tela-lancamento').classList.add('oculto');
    document.getElementById('tela-configuracao').classList.add('oculto');
    carregarRegistros();
}

window.abrirLancamento = function() {
    servicoEmEdicaoId = null;
    fotoAtualEdicao = null;
    document.getElementById('form-descricao').value = '';
    document.getElementById('form-foto').value = '';
    document.getElementById('form-data').valueAsDate = new Date();
    
    document.getElementById('tela-inicial').classList.add('oculto');
    document.getElementById('tela-lancamento').classList.remove('oculto');
    carregarDropdowns();
}

window.abrirConfiguracoes = function() {
    document.getElementById('tela-inicial').classList.add('oculto');
    document.getElementById('tela-configuracao').classList.remove('oculto');
    atualizarListasConfig();
    
    const chaveSalva = localStorage.getItem('api_key_ia') || '';
    document.getElementById('input-api-key').value = chaveSalva;
}

// ==========================================
// GERENCIADOR DE CHAVE API (LOCALSTORAGE)
// ==========================================
window.salvarChaveAPI = function() {
    const chave = document.getElementById('input-api-key').value.trim();
    if(chave) {
        localStorage.setItem('api_key_ia', chave);
        alert('Chave API salva com sucesso neste dispositivo!');
    } else {
        alert('Por favor, cole uma chave válida antes de salvar.');
    }
}

window.excluirChaveAPI = function() {
    if(confirm('Tem certeza que deseja remover sua chave de API deste dispositivo?')) {
        localStorage.removeItem('api_key_ia');
        document.getElementById('input-api-key').value = '';
        alert('Chave excluída com sucesso.');
    }
}

// ==========================================
// CONFIGURAÇÕES (CRUD COMPLETO CADASTROS)
// ==========================================
window.adicionarLocalConfig = function() {
    const nome = document.getElementById('novo-local').value.trim();
    if(nome) { inserirPadrao('locais', nome); document.getElementById('novo-local').value=''; atualizarListasConfig(); }
}

window.adicionarItemConfig = function() {
    const nome = document.getElementById('novo-item').value.trim();
    if(nome) { inserirPadrao('itens', nome); document.getElementById('novo-item').value=''; atualizarListasConfig(); }
}

window.excluirItemConfig = function(tabela, nome) {
    if(confirm(`Tem certeza que deseja excluir '${nome}'?`)) {
        const transaction = db.transaction([tabela], "readwrite");
        transaction.objectStore(tabela).delete(nome);
        transaction.oncomplete = () => atualizarListasConfig();
    }
}

window.editarItemConfig = function(tabela, nomeAntigo) {
    const novoNome = prompt("Digite o novo nome:", nomeAntigo);
    if(novoNome && novoNome.trim() !== "" && novoNome !== nomeAntigo) {
        const transaction = db.transaction([tabela], "readwrite");
        const store = transaction.objectStore(tabela);
        store.delete(nomeAntigo);
        store.put({ nome: novoNome.trim() });
        transaction.oncomplete = () => atualizarListasConfig();
    }
}

function atualizarListasConfig() {
    const transaction = db.transaction(["locais", "itens"], "readonly");
    
    transaction.objectStore("locais").getAll().onsuccess = e => {
        document.getElementById('lista-locais').innerHTML = e.target.result.map(l => 
            `<li>
                <span>${l.nome}</span>
                <div>
                    <button onclick="editarItemConfig('locais', '${l.nome}')" style="background:#ffc107; color:black; padding:5px 10px; border:none; border-radius:3px;">✏️ Editar</button>
                    <button onclick="excluirItemConfig('locais', '${l.nome}')" style="background:#dc3545; color:white; padding:5px 10px; border:none; border-radius:3px;">🗑️ Excluir</button>
                </div>
            </li>`
        ).join('');
    };

    transaction.objectStore("itens").getAll().onsuccess = e => {
        document.getElementById('lista-itens').innerHTML = e.target.result.map(i => 
            `<li>
                <span>${i.nome}</span>
                <div>
                    <button onclick="editarItemConfig('itens', '${i.nome}')" style="background:#ffc107; color:black; padding:5px 10px; border:none; border-radius:3px;">✏️ Editar</button>
                    <button onclick="excluirItemConfig('itens', '${i.nome}')" style="background:#dc3545; color:white; padding:5px 10px; border:none; border-radius:3px;">🗑️ Excluir</button>
                </div>
            </li>`
        ).join('');
    };
}

// ==========================================
// FORMULÁRIO E BANCO DE DADOS DE SERVIÇOS
// ==========================================
function carregarDropdowns() {
    const transaction = db.transaction(["locais", "itens"], "readonly");
    transaction.objectStore("locais").getAll().onsuccess = function(e) {
        let html = '<option value="">Selecione...</option>';
        e.target.result.forEach(l => html += `<option value="${l.nome}">${l.nome}</option>`);
        html += '<option value="NOVO">➕ Cadastrar Novo Local...</option>';
        document.getElementById('form-local').innerHTML = html;
    };
    transaction.objectStore("itens").getAll().onsuccess = function(e) {
        let html = '<option value="">Selecione...</option>';
        e.target.result.forEach(i => html += `<option value="${i.nome}">${i.nome}</option>`);
        document.getElementById('form-item').innerHTML = html;
    };
}

window.verificarNovoLocal = function(selectElement) {
    if (selectElement.value === "NOVO") {
        const novoNome = prompt("Digite o nome do novo Local:");
        if (novoNome && novoNome.trim() !== "") {
            inserirPadrao('locais', novoNome.trim());
            carregarDropdowns();
            setTimeout(() => selectElement.value = novoNome.trim(), 100);
        } else {
            selectElement.selectedIndex = 0;
        }
    }
}

window.salvarServico = function() {
    const data = document.getElementById('form-data').value;
    const local = document.getElementById('form-local').value;
    const item = document.getElementById('form-item').value;
    const descricao = document.getElementById('form-descricao').value;
    const fotoInput = document.getElementById('form-foto');

    if(!local || !descricao) { alert("Local e Descrição são obrigatórios!"); return; }

    if (fotoInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = e => gravarNoBanco(data, local, item, descricao, e.target.result);
        reader.readAsDataURL(fotoInput.files[0]);
    } else {
        gravarNoBanco(data, local, item, descricao, fotoAtualEdicao);
    }
}

function gravarNoBanco(data, local, item, desc, fotoBase64) {
    const transaction = db.transaction(["servicos"], "readwrite");
    const store = transaction.objectStore("servicos");
    
    const registro = { data, local, item, descricao: desc, foto: fotoBase64, timestamp: new Date().getTime() };
    
    if (servicoEmEdicaoId) {
        registro.id = servicoEmEdicaoId;
        store.put(registro); // Atualiza
    } else {
        store.add(registro); // Cria novo
    }
    
    transaction.oncomplete = function() {
        alert(servicoEmEdicaoId ? "Serviço atualizado com sucesso!" : "Serviço salvo com sucesso!");
        voltarInicio();
    };
}

// EDIÇÃO DE SERVIÇOS
window.editarServico = function(id) {
    const transaction = db.transaction(["servicos"], "readonly");
    const request = transaction.objectStore("servicos").get(id);
    
    request.onsuccess = function(e) {
        const servico = e.target.result;
        if(!servico) return;
        
        servicoEmEdicaoId = servico.id;
        fotoAtualEdicao = servico.foto;
        
        document.getElementById('form-data').value = servico.data;
        document.getElementById('form-descricao').value = servico.descricao;
        document.getElementById('form-foto').value = ''; // Input file não pode ser preenchido via JS
        
        carregarDropdowns();
        setTimeout(() => {
            document.getElementById('form-local').value = servico.local;
            document.getElementById('form-item').value = servico.item;
        }, 150);
        
        document.getElementById('tela-inicial').classList.add('oculto');
        document.getElementById('tela-lancamento').classList.remove('oculto');
    };
}

// EXCLUSÃO DE SERVIÇOS
window.excluirServico = function(id) {
    if(confirm("Tem certeza que deseja excluir permanentemente este serviço?")) {
        const transaction = db.transaction(["servicos"], "readwrite");
        transaction.objectStore("servicos").delete(id);
        transaction.oncomplete = () => carregarRegistros();
    }
}

function carregarRegistros() {
    const transaction = db.transaction(["servicos"], "readonly");
    const request = transaction.objectStore("servicos").getAll();
    request.onsuccess = function() {
        const tabela = document.getElementById('tabela-registros');
        tabela.innerHTML = "";
        
        // Ordena do mais recente para o mais antigo e pega os últimos 15
        const registros = request.result.sort((a, b) => b.timestamp - a.timestamp).slice(0, 15); 
        
        registros.forEach(r => {
            tabela.innerHTML += `
                <tr>
                    <td>${r.data.split('-').reverse().join('/')}</td>
                    <td>${r.local}</td>
                    <td>${r.descricao.substring(0, 30)}...</td>
                    <td style="text-align: center;">
                        <button onclick="editarServico(${r.id})" style="background:#ffc107; border:none; padding:5px 8px; border-radius:3px; cursor:pointer;" title="Editar">✏️</button>
                        <button onclick="excluirServico(${r.id})" style="background:#dc3545; color:white; border:none; padding:5px 8px; border-radius:3px; cursor:pointer;" title="Excluir">🗑️</button>
                    </td>
                </tr>
            `;
        });
    };
}

// ==========================================
// INTELIGÊNCIA ARTIFICIAL (API GROQ)
// ==========================================
window.corrigirTextoIA = async function() {
    const textoOriginal = document.getElementById('form-descricao').value;
    if (!textoOriginal) { alert("Digite algo na descrição primeiro para a IA corrigir!"); return; }

    const apiKey = localStorage.getItem('api_key_ia');
    if (!apiKey) {
        alert("Chave de API não configurada! Vá nas configurações (⚙️ Cadastros) e cole sua chave da Groq.");
        return;
    }

    const btn = document.getElementById('btn-ia');
    const status = document.getElementById('status-ia');
    btn.disabled = true;
    status.style.display = 'block';
    status.innerText = "Processando texto via Groq...";

    try {
        const resposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { 
                        role: "system", 
                        content: "Você é um assistente técnico de engenharia e manutenção. Sua tarefa é reescrever o relato do usuário utilizando linguagem estritamente técnica, formal, clara e direta para compor um relatório de manutenção oficial. NÃO adicione introduções, encerramentos, aspas ou comentários. Retorne APENAS o texto reescrito." 
                    },
                    { role: "user", content: textoOriginal }
                ],
                temperature: 0.3,
                max_tokens: 500
            })
        });

        if (!resposta.ok) {
            const erroDetalhado = await resposta.json();
            throw new Error(erroDetalhado.error?.message || "Falha ao comunicar com a Groq.");
        }

        const dados = await resposta.json();
        document.getElementById('form-descricao').value = dados.choices[0].message.content.trim();
        status.innerText = "Concluído!";
        
    } catch (erro) {
        console.error("Erro na API da IA:", erro);
        status.innerText = `Erro: ${erro.message}`;
    } finally {
        btn.disabled = false;
        setTimeout(() => { if(status.innerText === "Concluído!") status.style.display = 'none'; }, 4000);
    }
}

// ==========================================
// GERAÇÃO DE RELATÓRIO PDF (COM FILTRO)
// ==========================================
window.gerarRelatorioPDF = function() {
    const dataInicio = document.getElementById('filtro-data-inicio').value;
    const dataFim = document.getElementById('filtro-data-fim').value;

    const transaction = db.transaction(["servicos"], "readonly");
    const request = transaction.objectStore("servicos").getAll();

    request.onsuccess = function() {
        let registros = request.result;

        if (dataInicio && dataFim) registros = registros.filter(r => r.data >= dataInicio && r.data <= dataFim);
        else if (dataInicio) registros = registros.filter(r => r.data >= dataInicio);
        else if (dataFim) registros = registros.filter(r => r.data <= dataFim);

        // Ordena por data antes de imprimir
        registros.sort((a, b) => new Date(a.data) - new Date(b.data));

        if (registros.length === 0) { alert("Não há serviços registrados para este período."); return; }

        let htmlTabela = '';
        registros.forEach((r, index) => {
            const imgTag = r.foto ? `<img src="${r.foto}" style="max-width: 250px; max-height: 250px; object-fit: contain; border-radius: 4px;">` : 'Sem foto';
            htmlTabela += `
                <tr>
                    <td style="border: 1px solid #000; padding: 8px;">${index + 1}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${r.data.split('-').reverse().join('/')}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${r.local}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${r.descricao}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: center; width: 260px;">${imgTag}</td>
                </tr>
            `;
        });

        let periodoTexto = "Todos os registros exportados";
        if (dataInicio && dataFim) periodoTexto = `De ${dataInicio.split('-').reverse().join('/')} até ${dataFim.split('-').reverse().join('/')}`;
        else if (dataInicio) periodoTexto = `A partir de ${dataInicio.split('-').reverse().join('/')}`;
        else if (dataFim) periodoTexto = `Até ${dataFim.split('-').reverse().join('/')}`;

        const janelaRelatorio = window.open('', '', 'width=1000,height=800');
        janelaRelatorio.document.write(`
            <html>
                <head>
                    <title>Relatório de Manutenção</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: auto; }
                        th { background-color: #f2f2f2; border: 1px solid #000; padding: 10px; text-align: left; }
                        h2 { text-align: center; }
                        @media print {
                            @page { margin: 1cm; size: landscape; }
                            body { -webkit-print-color-adjust: exact; }
                            table { page-break-inside: auto; }
                            tr { page-break-inside: avoid; page-break-after: auto; }
                        }
                    </style>
                </head>
                <body>
                    <h2>Relatório de Manutenção</h2>
                    <p><strong>Período:</strong> ${periodoTexto}</p>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 5%;">Item</th>
                                <th style="width: 10%;">Data</th>
                                <th style="width: 15%;">Local</th>
                                <th style="width: 40%;">Descrição do serviço executado</th>
                                <th style="width: 30%;">Evidências fotográficas</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlTabela}
                        </tbody>
                    </table>
                    <script>
                        window.onload = function() { setTimeout(() => window.print(), 500); }
                    </script>
                </body>
            </html>
        `);
        janelaRelatorio.document.close();
    };
}