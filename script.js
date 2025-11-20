// =========================================================
// PASO 1: CONFIGURACIÓN DE FIREBASE (¡MUY IMPORTANTE!)
// =========================================================
// Ve a console.firebase.google.com -> Tu Proyecto -> Configuración del proyecto (icono de engranaje)
// Desplázate hacia abajo hasta "Tus apps" -> "SDK setup and configuration" -> "Config"
// Copia el objeto 'firebaseConfig' y pégalo aquí.
// ¡NO COMPARTAS ESTAS CREDENCIALES EN UN REPOSITORIO PÚBLICO EN PRODUCCIÓN!
// Para este ejemplo, está bien, pero sé consciente de la seguridad.

const firebaseConfig = {
    apiKey: "TU_API_KEY", // <--- REEMPLAZA ESTO
    authDomain: "TU_PROJECT_ID.firebaseapp.com", // <--- REEMPLAZA ESTO
    projectId: "TU_PROJECT_ID", // <--- REEMPLAZA ESTO
    storageBucket: "TU_PROJECT_ID.appspot.com", // <--- REEMPLAZA ESTO
    messagingSenderId: "TU_MESSAGING_SENDER_ID", // <--- REEMPLAZA ESTO
    appId: "TU_APP_ID", // <--- REEMPLAZA ESTO
    databaseURL: "https://TU_PROJECT_ID-default-rtdb.firebaseio.com" // <--- REEMPLAZA ESTO
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
// Si también vas a usar Storage para subir comprobantes:
// const storage = firebase.storage();


// =========================================================
// Variables y Elementos del DOM
// =========================================================
let allBingoCards = []; // Almacenará todos los cartones cargados desde el JSON
let totalCardsCount = 0;

const bingoCardsContainer = document.getElementById('bingoCardsContainer');
const availableCountSpan = document.getElementById('availableCount');
const totalCountSpan = document.getElementById('totalCount');
const salesProgressBar = document.getElementById('salesProgressBar');
const searchButton = document.getElementById('searchButton');
const cartonIdInput = document.getElementById('cartonIdInput');
const showAllAvailableButton = document.getElementById('showAllAvailableButton');

// Modal elementos
const cardModal = document.getElementById('cardModal');
const closeButton = cardModal.querySelector('.close-button');
const modalCardId = document.getElementById('modalCardId');
const modalCardContent = document.getElementById('modalCardContent');
const modalCardStatus = document.getElementById('modalCardStatus');
const reserveButton = document.getElementById('reserveButton');
const reservationTimer = document.getElementById('reservationTimer');
const paymentInstructions = document.getElementById('paymentInstructions');
const paymentProofInput = document.getElementById('paymentProofInput');
const uploadProofButton = document.getElementById('uploadProofButton');
const uploadStatus = document.getElementById('uploadStatus');

let currentModalCardId = null;
let reservationInterval = null; // Para el temporizador de la reserva

// =========================================================
// Funciones de Ayuda
// =========================================================

// Función para generar un cartón visualmente
function generateBingoCardHTML(cardData, isLarge = false) {
    if (!cardData || !cardData.id) {
        return '<div class="bingo-card">Error al cargar cartón</div>';
    }

    const headers = ['B', 'I', 'N', 'G', 'O'];
    let gridHTML = `<div class="bingo-grid">`;
    headers.forEach(header => {
        gridHTML += `<div class="header-cell">${header}</div>`;
    });

    // Asumiendo 5 filas para cada letra
    for (let i = 0; i < 5; i++) {
        gridHTML += `<div class="number-cell">${cardData.b[i] || ''}</div>`;
        gridHTML += `<div class="number-cell">${cardData.i[i] || ''}</div>`;
        gridHTML += `<div class="number-cell ${i === 2 ? 'free-cell' : ''}">${i === 2 ? 'FREE' : (cardData.n[i] || '')}</div>`;
        gridHTML += `<div class="number-cell">${cardData.g[i] || ''}</div>`;
        gridHTML += `<div class="number-cell">${cardData.o[i] || ''}</div>`;
    }
    gridHTML += `</div>`;

    const statusClass = cardData.estado ? cardData.estado.toLowerCase() : 'available';
    const cardClass = isLarge ? 'bingo-card large-card' : 'bingo-card';

    return `
        <div class="${cardClass} ${statusClass}" data-card-id="${cardData.id}">
            <h3>Cartón #${cardData.id}</h3>
            ${gridHTML}
            <div class="card-status status-${statusClass}">${cardData.estado || 'Disponible'}</div>
        </div>
    `;
}

// Función para actualizar el contador de cartones y la barra de progreso
function updateCardCounts(cardStates) {
    const availableCards = Object.values(cardStates).filter(state => state.estado === 'disponible').length;
    const reservedCards = Object.values(cardStates).filter(state => state.estado === 'reservado').length;
    const soldCards = Object.values(cardStates).filter(state => state.estado === 'vendido').length;

    availableCountSpan.textContent = availableCards;
    totalCountSpan.textContent = totalCardsCount;

    const soldPercentage = (soldCards / totalCardsCount) * 100;
    salesProgressBar.style.width = `${soldPercentage}%`;
}

// Función para mostrar el modal de cartón
async function showCardInModal(cardId) {
    const cardData = allBingoCards.find(card => card.id === cardId);
    if (!cardData) {
        alert('Cartón no encontrado.');
        return;
    }

    currentModalCardId = cardId;
    modalCardId.textContent = cardId;
    modalCardContent.innerHTML = generateBingoCardHTML(cardData, true); // Genera el contenido del cartón grande

    // Obtener el estado actual de Firebase
    const snapshot = await database.ref(`estado_cartones/${cardId}`).once('value');
    const firebaseCardState = snapshot.val();

    let statusText = 'Disponible';
    let statusClass = 'status-available';
    let showReserveButton = true;
    let showPaymentInstructions = false;

    if (firebaseCardState) {
        statusText = firebaseCardState.estado;
        statusClass = `status-${firebaseCardState.estado.toLowerCase()}`;

        if (firebaseCardState.estado === 'reservado') {
            showReserveButton = false;
            showPaymentInstructions = true;
            startReservationTimer(firebaseCardState.hora_reserva);
        } else if (firebaseCardState.estado === 'vendido') {
            showReserveButton = false;
            showPaymentInstructions = false;
            clearInterval(reservationInterval);
            reservationTimer.textContent = '';
        } else { // Si vuelve a disponible por caducidad de reserva
            clearInterval(reservationInterval);
            reservationTimer.textContent = '';
        }
    } else {
        // Si no hay estado en Firebase, es 'disponible' por defecto
        clearInterval(reservationInterval);
        reservationTimer.textContent = '';
    }

    modalCardStatus.textContent = statusText;
    modalCardStatus.className = `card-status ${statusClass}`;
    reserveButton.style.display = showReserveButton ? 'block' : 'none';
    paymentInstructions.style.display = showPaymentInstructions ? 'block' : 'none';
    uploadStatus.textContent = ''; // Limpiar estado de subida

    cardModal.style.display = 'flex'; // Mostrar el modal
}

// Iniciar/actualizar el temporizador de reserva
function startReservationTimer(reservationTimestamp) {
    clearInterval(reservationInterval); // Limpiar cualquier temporizador anterior

    const fiveMinutes = 5 * 60 * 1000; // 5 minutos en milisegundos

    reservationInterval = setInterval(() => {
        const now = Date.now();
        const timeElapsed = now - reservationTimestamp;
        const timeLeft = fiveMinutes - timeElapsed;

        if (timeLeft <= 0) {
            reservationTimer.textContent = 'Tiempo de reserva agotado.';
            // Aquí podríamos actualizar Firebase para liberar el cartón
            // database.ref(`estado_cartones/${currentModalCardId}/estado`).set('disponible');
            clearInterval(reservationInterval);
            reserveButton.style.display = 'block'; // Permitir reservar de nuevo
            paymentInstructions.style.display = 'none';
            modalCardStatus.textContent = 'Disponible';
            modalCardStatus.className = 'card-status status-available';
        } else {
            const minutes = Math.floor(timeLeft / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
            reservationTimer.textContent = `Tiempo restante: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}


// =========================================================
// Event Listeners
// =========================================================

// Cargar cartones desde el JSON local
async function loadBingoCards() {
    try {
        const response = await fetch('cartones.json');
        allBingoCards = await response.json();
        totalCardsCount = allBingoCards.length;
        bingoCardsContainer.querySelector('.loading-message').style.display = 'none';
        
        // Cargar y mostrar todos los cartones disponibles inicialmente
        await displayAvailableCards();

    } catch (error) {
        console.error('Error al cargar los cartones:', error);
        bingoCardsContainer.innerHTML = '<p class="loading-message error">Error al cargar los cartones. Intenta de nuevo más tarde.</p>';
    }
}

// Escuchar cambios en la base de datos de Firebase para actualizar los estados
database.ref('estado_cartones').on('value', (snapshot) => {
    const cardStates = snapshot.val() || {};
    updateCardCounts(cardStates); // Actualizar contadores
    displayCards(allBingoCards, cardStates); // Volver a renderizar para actualizar estados visuales
});

async function displayCards(cardsToDisplay, cardStates) {
    bingoCardsContainer.innerHTML = ''; // Limpiar el contenedor
    if (cardsToDisplay.length === 0) {
        bingoCardsContainer.innerHTML = '<p class="loading-message">No se encontraron cartones.</p>';
        return;
    }
    cardsToDisplay.forEach(card => {
        // Fusionar datos del cartón con su estado de Firebase
        const cardWithState = { ...card, ...cardStates[card.id] };
        bingoCardsContainer.innerHTML += generateBingoCardHTML(cardWithState);
    });
}

async function displayAvailableCards() {
    const snapshot = await database.ref('estado_cartones').once('value');
    const cardStates = snapshot.val() || {};
    const availableCardIds = Object.keys(cardStates).filter(id => cardStates[id].estado === 'disponible');
    
    // Si la base de datos está vacía, todos los cartones del JSON se consideran disponibles
    const cardsToShow = availableCardIds.length > 0 
        ? allBingoCards.filter(card => availableCardIds.includes(String(card.id)))
        : allBingoCards; // Si no hay estados en Firebase, todos son disponibles
    
    displayCards(cardsToShow, cardStates);
}


// Evento para buscar cartón por ID
searchButton.addEventListener('click', () => {
    const id = parseInt(cartonIdInput.value);
    if (isNaN(id)) {
        alert('Por favor, ingresa un número de cartón válido.');
        return;
    }
    showCardInModal(id);
});

// Evento para mostrar todos los cartones disponibles
showAllAvailableButton.addEventListener('click', () => {
    displayAvailableCards();
});


// Evento para abrir el modal al hacer click en un cartón pequeño
bingoCardsContainer.addEventListener('click', (event) => {
    const cardElement = event.target.closest('.bingo-card');
    if (cardElement) {
        const cardId = parseInt(cardElement.dataset.cardId);
        showCardInModal(cardId);
    }
});

// Cierra el modal
closeButton.addEventListener('click', () => {
    cardModal.style.display = 'none';
    clearInterval(reservationInterval); // Limpiar el temporizador al cerrar el modal
});

// Cierra el modal si se hace clic fuera del contenido
window.addEventListener('click', (event) => {
    if (event.target === cardModal) {
        cardModal.style.display = 'none';
        clearInterval(reservationInterval);
    }
});

// Función para reservar el cartón
reserveButton.addEventListener('click', async () => {
    if (!currentModalCardId) return;

    // Verificar el estado actual justo antes de reservar para evitar colisiones
    const snapshot = await database.ref(`estado_cartones/${currentModalCardId}/estado`).once('value');
    const currentState = snapshot.val();

    if (currentState === 'disponible' || !currentState) { // Si está disponible o no tiene estado (lo que implica disponible)
        const reservationTime = Date.now();
        try {
            await database.ref(`estado_cartones/${currentModalCardId}`).set({
                estado: 'reservado',
                hora_reserva: reservationTime,
                usuario_test: 'usuario_demo' // En un proyecto real, esto vendría de la autenticación de Firebase
            });
            alert(`Cartón #${currentModalCardId} reservado por 5 minutos.`);
            showCardInModal(currentModalCardId); // Actualizar el modal
        } catch (error) {
            console.error('Error al reservar cartón:', error);
            alert('Hubo un error al intentar reservar el cartón.');
        }
    } else {
        alert(`Este cartón ya está ${currentState}.`);
        showCardInModal(currentModalCardId); // Refrescar el modal con el estado actual
    }
});

// Manejar la subida del comprobante (¡Esto requeriría Firebase Storage para ser completo!)
uploadProofButton.addEventListener('click', () => {
    const file = paymentProofInput.files[0];
    if (file) {
        uploadStatus.textContent = 'Subiendo comprobante...';
        // Aquí iría la lógica para subir el archivo a Firebase Storage
        // Ejemplo (pseudo-código para Storage):
        /*
        const storageRef = storage.ref(`comprobantes/${currentModalCardId}_${Date.now()}_${file.name}`);
        const uploadTask = storageRef.put(file);

        uploadTask.on('state_changed',
            (snapshot) => {
                // Progreso de la subida
            },
            (error) => {
                console.error('Error al subir:', error);
                uploadStatus.textContent = 'Error al subir el comprobante.';
            },
            () => {
                // Subida completada
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    console.log('Archivo disponible en', downloadURL);
                    // Actualizar Firebase Realtime Database con la URL del comprobante y cambiar a estado "pendiente_verificacion"
                    // database.ref(`estado_cartones/${currentModalCardId}/comprobante_url`).set(downloadURL);
                    // database.ref(`estado_cartones/${currentModalCardId}/estado`).set('pendiente_verificacion');
                    uploadStatus.textContent = 'Comprobante subido. Esperando verificación.';
                    alert('Comprobante subido correctamente. Tu reserva está pendiente de verificación.');
                    showCardInModal(currentModalCardId); // Actualizar el modal
                });
            }
        );
        */
        // Por ahora, solo simulamos la subida y marcamos como vendido (en un entorno real, un admin lo verificaría)
        setTimeout(async () => {
            await database.ref(`estado_cartones/${currentModalCardId}`).update({
                estado: 'vendido',
                comprobante_subido_simulado: true, // Esto sería la URL real del comprobante
                fecha_venta: Date.now()
            });
            uploadStatus.textContent = 'Comprobante subido y cartón marcado como VENDIDO (simulado).';
            showCardInModal(currentModalCardId); // Actualizar el modal
        }, 2000);

    } else {
        uploadStatus.textContent = 'Por favor, selecciona un archivo.';
    }
});


// =========================================================
// Inicialización
// =========================================================
document.addEventListener('DOMContentLoaded', loadBingoCards);

// Función para generar cartones de bingo (¡útil para crear tu cartones.json!)
// Esta función es solo para generar el JSON, no se usa en el front-end directamente.
function generateSampleBingoCards(count) {
    const cards = [];
    const getRandom = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    for (let i = 1; i <= count; i++) {
        const b = [];
        while

