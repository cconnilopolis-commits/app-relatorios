// Importa o motor da IA local direto da CDN (Isso baixa o modelo para o cache do navegador)
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.0';

// ==========================================
// 1. GERENCIAMENTO DE TELAS
// ==========================================
window.voltarInicio = function() {
    document.getElementById('tela-inicial').classList.remove('oculto');
    document.getElementById('tela-lancamento').classList.add('oculto');
    document.getElementById('tela-configuracao').classList.add('oculto');
    carregarRegistros();
}

window.abrirLancamento = function() {
    document.getElementById('tela-inicial').classList.add('oculto');
    document.getElementById('tela-lancamento').classList.remove('oculto');
    document.getElementById('form-data').valueAsDate = new Date();
    carregarDropdowns();
}

window.abrirConfiguracoes = function() {
    document.getElementById('tela-inicial').classList.add('oculto');
    document.getElementById('tela-configuracao').classList.remove('oculto');
    atualizarListasConfig();
}

// ==========================================
// 2. BANCO DE DADOS OFFLINE (IndexedDB)
// ==========================================
let db;
const request = indexedDB.open("AppRelatorios", 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    // Cria as gavetas do banco
    if (!db.objectStoreNames.contains('servicos')) {
        db.createObjectStore('servicos', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('locais')) {
        db.createObjectStore('locais', { keyPath: 'nome' });
    }
    if (!db.objectStoreNames.contains('itens')) {
        db.createObjectStore('itens', { keyPath: 'nome' });
    }
};

request.onsuccess = function(event) {
    db = event.target.result;
    carregarRegistros();
    // Adiciona alguns locais padrão se o banco for novo
    inserirPadrao('locais', 'Ponto 16');
    inserirPadrao('locais', 'Ponto 17');
};

function inserirPadrao(tabela, valor) {
    const transaction = db.transaction([tabela], "readwrite");
    const store = transaction.objectStore(tabela);
    store.put({ nome: valor });
}

// ==========================================
// 3. INTELIGÊNCIA ARTIFICIAL (Transformers.js)
// ==========================================
let geradorIA = null;

window.corrigirTextoIA = async function() {
    const textoOriginal = document.getElementById('form-descricao').value;
    if (!textoOriginal) {
        alert("Digite algo na descrição primeiro!");
        return;
    }

    const btn = document.getElementById('btn-ia');
    const status = document.getElementById('status-ia');
    
    btn.disabled = true;
    status.style.display = 'block';
    status.innerText = "Carregando motor IA e analisando texto... (Aguarde)";

    try {
        // Carrega um modelo pequeno e rápido otimizado para navegadores
        if (!geradorIA) {
            geradorIA = await pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Chat');
        }

        const prompt = `<|im_start|>user\nReescreva o seguinte relato de manutenção em linguagem técnica formal, corrigindo erros. Seja direto. Relato: "${textoOriginal}"<|im_end|>\n<|im_start|>assistant\n`;
        
        status.innerText = "Processando texto...";
        const resultado = await geradorIA(prompt, { max_new_tokens: 150 });
        
        // Extrai apenas a resposta da IA
        let respostaFinal = resultado[0].generated_text.split('<|im_start|>assistant\n')[1].trim();
        document.getElementById('form-descricao').value = respostaFinal;
        
        status.innerText = "Concluído!";
    } catch (erro) {
        console.error("Erro na IA:", erro);
        alert("Ocorreu um erro ao processar a IA. Verifique o console.");
    } finally {
        btn.disabled = false;
        setTimeout(() => status.style.display = 'none', 3000);
    }
}

// ==========================================
// 4. LÓGICA DE SALVAMENTO E UI
// ==========================================
window.salvarServico = function() {
    const data = document.getElementById('form-data').value;
    const local = document.getElementById('form-local').value;
    const item = document.getElementById('form-item').value;
    const descricao = document.getElementById('form-descricao').value;
    const fotoInput = document.getElementById('form-foto');

    if(!local || !descricao) {
        alert("Local e Descrição são obrigatórios!");
        return;
    }

    // Processa a foto para Base64 (Texto)
    if (fotoInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            gravarNoBanco(data, local, item, descricao, e.target.result);
        };
        reader.readAsDataURL(fotoInput.files[0]);
    } else {
        gravarNoBanco(data, local, item, descricao, null);
    }
}

function gravarNoBanco(data, local, item, desc, fotoBase64) {
    const transaction = db.transaction(["servicos"], "readwrite");
    const store = transaction.objectStore("servicos");
    
    const registro = {
        data: data,
        local: local,
        item: item,
        descricao: desc,
        foto: fotoBase64,
        timestamp: new Date().getTime()
    };

    store.add(registro);
    transaction.oncomplete = function() {
        alert("Serviço salvo com sucesso!");
        document.getElementById('form-descricao').value = "";
        document.getElementById('form-foto').value = "";
        voltarInicio();
    };
}

window.verificarNovoLocal = function(selectElement) {
    if (selectElement.value === "NOVO") {
        const novoNome = prompt("Digite o nome do novo Local:");
        if (novoNome) {
            inserirPadrao('locais', novoNome);
            carregarDropdowns();
            setTimeout(() => selectElement.value = novoNome, 100);
        } else {
            selectElement.selectedIndex = 0;
        }
    }
}

function carregarDropdowns() {
    const transaction = db.transaction(["locais", "itens"], "readonly");
    
    // Locais
    const reqLocais = transaction.objectStore("locais").getAll();
    reqLocais.onsuccess = function() {
        let html = '<option value="">Selecione...</option>';
        reqLocais.result.forEach(l => html += `<option value="${l.nome}">${l.nome}</option>`);
        html += '<option value="NOVO">➕ Cadastrar Novo Local...</option>';
        document.getElementById('form-local').innerHTML = html;
    };

    // Itens
    const reqItens = transaction.objectStore("itens").getAll();
    reqItens.onsuccess = function() {
        let html = '<option value="">Selecione...</option>';
        reqItens.result.forEach(i => html += `<option value="${i.nome}">${i.nome}</option>`);
        document.getElementById('form-item').innerHTML = html;
    };
}

function carregarRegistros() {
    const transaction = db.transaction(["servicos"], "readonly");
    const store = transaction.objectStore("servicos");
    const request = store.getAll();

    request.onsuccess = function() {
        const tabela = document.getElementById('tabela-registros');
        tabela.innerHTML = "";
        // Inverte para mostrar os mais recentes primeiro
        const registros = request.result.reverse().slice(0, 5); 
        
        registros.forEach(r => {
            let tr = `<tr>
                <td>${r.data}</td>
                <td>${r.local}</td>
                <td>${r.descricao.substring(0, 30)}...</td>
            </tr>`;
            tabela.innerHTML += tr;
        });
    };
}

window.gerarRelatorioPDF = function() {
    alert("Função de renderização de PDF será conectada na próxima etapa.");
}

window.adicionarLocalConfig = function() {
    const nome = document.getElementById('novo-local').value;
    if(nome) { inserirPadrao('locais', nome); document.getElementById('novo-local').value=''; atualizarListasConfig(); }
}
window.adicionarItemConfig = function() {
    const nome = document.getElementById('novo-item').value;
    if(nome) { inserirPadrao('itens', nome); document.getElementById('novo-item').value=''; atualizarListasConfig(); }
}

function atualizarListasConfig() {
    const transaction = db.transaction(["locais", "itens"], "readonly");
    transaction.objectStore("locais").getAll().onsuccess = e => {
        document.getElementById('lista-locais').innerHTML = e.target.result.map(l => `<li>${l.nome}</li>`).join('');
    };
    transaction.objectStore("itens").getAll().onsuccess = e => {
        document.getElementById('lista-itens').innerHTML = e.target.result.map(i => `<li>${i.nome}</li>`).join('');
    };
}