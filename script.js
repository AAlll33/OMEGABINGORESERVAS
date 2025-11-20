// --- PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO_ID",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID",
    databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com" 
};
// ---------------------------------------------

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

let allBingoCards = [];
const bingoCardsContainer = document.getElementById('bingoCardsContainer');
const cardModal = document.getElementById('cardModal');

// 1. Cargar Cartones (JSON)
async function loadBingoCards() {
    try {
        const response = await fetch('cartones.json');
        allBingoCards = await response.json();
        // Escuchar cambios en Firebase en tiempo real
        database.ref('estado_cartones').on('value', (snapshot) => {
            const states = snapshot.val() || {};
            renderTokens(states);
        });
    } catch (error) {
        console.error("Error cargando cartones:", error);
        bingoCardsContainer.innerHTML = "<p style='color:white'>Error cargando datos o cartones.json no encontrado.</p>";
    }
}

// 2. Dibujar los Circulitos (Tokens)
function renderTokens(states) {
    bingoCardsContainer.innerHTML = '';
    allBingoCards.forEach(card => {
        const stateData = states[card.id] || { estado: 'disponible' };
        const statusClass = stateData.estado; // disponible, reservado, vendido
        
        // Crear el circulito
        const token = document.createElement('div');
        token.className = `carton-token ${statusClass}`;
        token.innerHTML = `
            <span>${card.id}</span>
            <div class="ver-btn">VER</div>
        `;
        
        // Al hacer clic, abrir el modal estilo Carabobo
        token.addEventListener('click', () => openModal(card, stateData));
        bingoCardsContainer.appendChild(token);
    });
}

// 3. Abrir Modal (Ver Cartón Verde)
function openModal(card, stateData) {
    const modalContent = document.getElementById('modalCardContent');
    const btnAction = document.getElementById('actionButton');
    const timerDisplay = document.getElementById('timer');

    // Generar la grilla verde
    let html = `<div class="bingo-grid">`;
    const headers = ['B','I','N','G','O'];
    headers.forEach(h => html += `<div class="cell header-cell">${h}</div>`);
    
    for(let i=0; i<5; i++) {
        html += `<div class="cell">${card.b[i]}</div>`;
        html += `<div class="cell">${card.i[i]}</div>`;
        html += `<div class="cell">${i===2 ? '★' : card.n[i]}</div>`; // Estrella en el centro
        html += `<div class="cell">${card.g[i]}</div>`;
        html += `<div class="cell">${card.o[i]}</div>`;
    }
    html += `</div>`;
    
    modalContent.innerHTML = html;
    document.getElementById('modalCardId').innerText = `#${card.id}`;
    cardModal.style.display = 'flex';

    // Configurar Botón según estado
    if (stateData.estado === 'disponible') {
        btnAction.style.display = 'block';
        btnAction.innerText = 'RESERVAR CARTÓN';
        btnAction.onclick = () => reserveCard(card.id);
        timerDisplay.innerText = '';
    } else if (stateData.estado === 'reservado') {
        btnAction.style.display = 'none'; // Ocultar botón si ya está reservado
        timerDisplay.innerText = 'Este cartón está reservado.';
    } else {
        btnAction.style.display = 'none';
        timerDisplay.innerText = 'VENDIDO';
    }
}

// 4. Reservar
function reserveCard(id) {
    const btn = document.getElementById('actionButton');
    btn.innerText = 'Procesando...';
    
    database.ref(`estado_cartones/${id}`).set({
        estado: 'reservado',
        timestamp: Date.now()
    }).then(() => {
        alert('¡Cartón Reservado! Tienes 5 minutos para pagar.');
        cardModal.style.display = 'none';
    }).catch(e => {
        alert('Error al reservar: ' + e.message);
    });
}

// Cerrar Modal
document.querySelector('.close-button').addEventListener('click', () => {
    cardModal.style.display = 'none';
});

// Iniciar
document.addEventListener('DOMContentLoaded', loadBingoCards);
