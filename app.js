import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.0';

// ==========================================
// ESTADO E BANCO DE DADOS OFFLINE
// ==========================================
let db;
let geradorIA = null;
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
// NAVEGAÇÃO
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
// CONFIGURAÇÕES (CRUD COMPLETO)
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
// FORMULÁRIO E BANCO DE DADOS
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
        gravarNoBanco(data, local, item, descricao, null);
    }
}

function gravarNoBanco(data, local, item, desc, fotoBase64) {
    const transaction = db.transaction(["servicos"], "readwrite");
    const store = transaction.objectStore("servicos");
    store.add({ data, local, item, descricao: desc, foto: fotoBase64, timestamp: new Date().getTime() });
    
    transaction.oncomplete = function() {
        alert("Serviço salvo com sucesso!");
        document.getElementById('form-descricao').value = "";
        document.getElementById('form-foto').value = "";
        voltarInicio();
    };
}

function carregarRegistros() {
    const transaction = db.transaction(["servicos"], "readonly");
    const request = transaction.objectStore("servicos").getAll();
    request.onsuccess = function() {
        const tabela = document.getElementById('tabela-registros');
        tabela.innerHTML = "";
        const registros = request.result.reverse().slice(0, 10); 
        registros.forEach(r => {
            tabela.innerHTML += `<tr><td>${r.data}</td><td>${r.local}</td><td>${r.descricao.substring(0, 30)}...</td></tr>`;
        });
    };
}

// ==========================================
// INTELIGÊNCIA ARTIFICIAL (COM PROGRESSO)
// ==========================================
window.corrigirTextoIA = async function() {
    const textoOriginal = document.getElementById('form-descricao').value;
    if (!textoOriginal) { alert("Digite algo na descrição primeiro!"); return; }

    const btn = document.getElementById('btn-ia');
    const status = document.getElementById('status-ia');
    btn.disabled = true;
    status.style.display = 'block';
    status.innerText = "Iniciando motor de IA...";

    try {
        if (!geradorIA) {
            geradorIA = await pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Chat', {
                progress_callback: dados => {
                    if (dados.status === 'progress') {
                        status.innerText = `Baixando IA: ${Math.round(dados.progress)}% concluído (Apenas no 1º uso)...`;
                    } else if (dados.status === 'ready') {
                        status.innerText = "Download concluído! Carregando memória...";
                    }
                }
            });
        }

        const prompt = `<|im_start|>user\nReescreva o seguinte relato de manutenção em linguagem técnica formal, corrigindo erros. Seja direto. Relato: "${textoOriginal}"<|im_end|>\n<|im_start|>assistant\n`;
        status.innerText = "Processando texto... (Aguarde)";
        const resultado = await geradorIA(prompt, { max_new_tokens: 150 });
        
        document.getElementById('form-descricao').value = resultado[0].generated_text.split('<|im_start|>assistant\n')[1].trim();
        status.innerText = "Concluído!";
    } catch (erro) {
        console.error(erro);
        status.innerText = "Erro ao carregar IA. Verifique a internet e tente novamente.";
    } finally {
        btn.disabled = false;
        setTimeout(() => status.style.display = 'none', 4000);
    }
}

// ==========================================
// GERAÇÃO DE RELATÓRIO PDF
// ==========================================
window.gerarRelatorioPDF = function() {
    const transaction = db.transaction(["servicos"], "readonly");
    const request = transaction.objectStore("servicos").getAll();

    request.onsuccess = function() {
        const registros = request.result;
        if (registros.length === 0) { alert("Não há serviços registrados."); return; }

        let htmlTabela = '';
        registros.forEach((r, index) => {
            // A FOTO FOI REDIMENSIONADA AQUI PARA O TAMANHO IDEAL NA FOLHA A4
            const imgTag = r.foto ? `<img src="${r.foto}" style="max-width: 250px; max-height: 250px; object-fit: contain; border-radius: 4px;">` : 'Sem foto';
            htmlTabela += `
                <tr>
                    <td style="border: 1px solid #000; padding: 8px;">${index + 1}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${r.data}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${r.local}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${r.descricao}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: center; width: 260px;">${imgTag}</td>
                </tr>
            `;
        });

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
                    <p><strong>Período:</strong> Todos os registros exportados</p>
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