// 1. CONFIGURACIÓN DE FIREBASE (Tus datos reales)
const firebaseConfig = {
  apiKey: "AIzaSyB6VLXeRU5qQ8qhC5fSOUvJHJwWfy_17ks",
  authDomain: "omegabingoreserva.firebaseapp.com",
  projectId: "omegabingoreserva",
  storageBucket: "omegabingoreserva.firebasestorage.app",
  messagingSenderId: "79927996266",
  appId: "1:79927996266:web:6bcb502804e8a402913f13"
};

// 2. INICIALIZAR FIREBASE
// Usamos "compat" para que funcione fácil en el navegador del celular
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Variables globales
let allCards = [];
const container = document.getElementById('bingoCardsContainer');
const modal = document.getElementById('cardModal');

// 3. CARGAR DATOS AL INICIAR
document.addEventListener('DOMContentLoaded', () => {
    loadCards();
});

async function loadCards() {
    try {
        // Cargar JSON
        const response = await fetch('cartones.json');
        allCards = await response.json();
        
        // Escuchar cambios en la base de datos en tiempo real
        database.ref('estado_cartones').on('value', (snapshot) => {
            const states = snapshot.val() || {};
            renderTokens(states);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="color:white">Error cargando cartones.json</p>';
    }
}

// 4. DIBUJAR LOS CIRCULITOS (TOKENS)
function renderTokens(states) {
    container.innerHTML = ''; // Limpiar

    allCards.forEach(card => {
        // Obtener estado de Firebase o 'disponible' por defecto
        const stateData = states[card.id] || { estado: 'disponible' };
        const estado = stateData.estado;

        // Crear elemento HTML
        const token = document.createElement('div');
        token.className = `token ${estado}`;
        token.innerHTML = `
            <span class="num">${card.id}</span>
            <span class="ver-text">VER</span>
        `;

        // Click evento
        token.addEventListener('click', () => {
            openModal(card, stateData);
        });

        container.appendChild(token);
    });
}

// 5. ABRIR EL MODAL (VERDE)
function openModal(card, stateData) {
    const modalId = document.getElementById('modalCardId');
    const modalVisual = document.getElementById('modalCardVisual');
    const btnReservar = document.getElementById('btnReservar');
    const statusMsg = document.getElementById('statusMessage');

    modalId.innerText = card.id;

    // Construir el cartón visual (Grilla 5x5)
    let html = '';
    const headers = ['B','I','N','G','O'];
    headers.forEach(h => html += `<div class="header-cell">${h}</div>`);

    // Filas
    for(let i=0; i<5; i++) {
        html += `<div class="cell">${card.b[i]}</div>`;
        html += `<div class="cell">${card.i[i]}</div>`;
        html += `<div class="cell">${i===2 ? '★' : card.n[i]}</div>`; // Centro estrella
        html += `<div class="cell">${card.g[i]}</div>`;
        html += `<div class="cell">${card.o[i]}</div>`;
    }
    modalVisual.innerHTML = html;

    // Lógica de botones según estado
    if(stateData.estado === 'disponible') {
        statusMsg.innerText = '';
        btnReservar.style.display = 'block';
        btnReservar.onclick = () => reservarCarton(card.id);
    } else if (stateData.estado === 'reservado') {
        statusMsg.innerText = '⚠ ESTE CARTÓN YA ESTÁ RESERVADO';
        btnReservar.style.display = 'none';
    } else {
        statusMsg.innerText = '❌ VENDIDO';
        btnReservar.style.display = 'none';
    }

    modal.style.display = 'flex';
}

// 6. FUNCIÓN RESERVAR (GUARDAR EN FIREBASE)
function reservarCarton(id) {
    const btn = document.getElementById('btnReservar');
    btn.innerText = 'Procesando...';

    // Guardar en la base de datos
    database.ref('estado_cartones/' + id).set({
        estado: 'reservado',
        fecha: Date.now()
    }).then(() => {
        alert('¡Cartón reservado con éxito!');
        modal.style.display = 'none';
        btn.innerText = 'RESERVAR CARTÓN';
    }).catch(error => {
        alert('Error: ' + error.message);
        btn.innerText = 'RESERVAR CARTÓN';
    });
}

// Cerrar modal
document.querySelector('.close-button').addEventListener('click', () => modal.style.display = 'none');
document.getElementById('btnCerrar').addEventListener('click', () => modal.style.display = 'none');

// Buscador simple
function searchCard() {
    const id = document.getElementById('searchInput').value;
    if(!id) return;
    
    // Buscar en el array
    const found = allCards.find(c => c.id == id);
    if(found) {
        // Necesitamos obtener el estado actual para abrir el modal correctamente
        database.ref('estado_cartones/' + id).once('value').then(snapshot => {
            const state = snapshot.val() || { estado: 'disponible' };
            openModal(found, state);
        });
    } else {
        alert('Cartón no encontrado');
    }
}

