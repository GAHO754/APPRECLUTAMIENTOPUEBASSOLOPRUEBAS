// Configura Firebase (reemplaza con tus datos)
const firebaseConfig = {
  apiKey: "AIzaSyC_WhpJxW6V6C6stDeyv6wGsj4-2rR2edQ",
  authDomain: "appreclutameinto.firebaseapp.com",
  databaseURL: "https://appreclutameinto-default-rtdb.firebaseio.com",
  projectId: "appreclutameinto",
    storageBucket: "appreclutameinto.appspot.com",
  messagingSenderId: "447789838113",
  appId: "1:447789838113:web:41d7c2ba5cd6bb304e5860",
  measurementId: "G-M9LWSVYNHC"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const storage = firebase.storage();

// Elementos
const userNameEl = document.getElementById('userName');
const userInitialsEl = document.getElementById('userInitials');
const profileBtn = document.getElementById('profileBtn');
const profileModal = document.getElementById('profileModal');
const closeModal = document.getElementById('closeModal');
const profilePic = document.getElementById('profilePic');
const fileInput = document.getElementById('fileInput');
const cameraBtn = document.getElementById('cameraBtn');
const nameInput = document.getElementById('nameInput');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const welcomeMsg = document.getElementById('welcomeMsg');

let currentUser = null;

// Mostrar usuario si está logueado, sino redirigir a login
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    // Nombre - puede venir de displayName, o email si no hay nombre
    const displayName = user.displayName || user.email.split('@')[0];
    userNameEl.textContent = displayName;
    welcomeMsg.textContent = `Bienvenido, ${displayName}`;

    // Iniciales
    userInitialsEl.textContent = getInitials(displayName);

    // Foto perfil
    if(user.photoURL){
      profilePic.src = user.photoURL;
      profileBtn.style.backgroundImage = `url(${user.photoURL})`;
      profileBtn.style.backgroundSize = 'cover';
      profileBtn.style.color = 'transparent';
    } else {
      profilePic.src = 'default-profile.png';
      profileBtn.style.backgroundImage = 'none';
      profileBtn.style.color = 'white';
    }
  } else {
    window.location.href = "index.html";
  }
});

// Función para obtener iniciales
function getInitials(name) {
  const words = name.trim().split(' ');
  if(words.length === 1) return words[0].substring(0,2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Abrir modal
profileBtn.addEventListener('click', () => {
  profileModal.style.display = 'block';
  nameInput.value = userNameEl.textContent;
});

// Cerrar modal
closeModal.addEventListener('click', () => {
  profileModal.style.display = 'none';
});

// Cerrar modal si clic fuera contenido
window.addEventListener('click', e => {
  if (e.target === profileModal) profileModal.style.display = 'none';
});

// Cambiar foto desde input
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if(file){
    const reader = new FileReader();
    reader.onload = function(ev){
      profilePic.src = ev.target.result;
    }
    reader.readAsDataURL(file);
  }
});
    //Boton cerrar sesion
    const logoutBtn = document.getElementById('logout-btn');

logoutBtn.addEventListener('click', async () => {
  try {
    await firebase.auth().signOut();
    // Redirigir a la página de login
    window.location.href = 'index.html';
  } catch (error) {
    alert('Error al cerrar sesión: ' + error.message);
  }
});


// Tomar foto con cámara
cameraBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    // Crear canvas para capturar imagen
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Reemplazar modal contenido para mostrar video y botón capturar
    const modalContent = profileModal.querySelector('.modal-content');
    modalContent.innerHTML = `
      <span class="close" id="closeModalCam">&times;</span>
      <h3>Toma tu foto</h3>
      <video id="videoCam" autoplay playsinline style="width: 100%; border-radius: 10px;"></video>
      <button id="captureBtn">Capturar</button>
    `;

    const videoCam = modalContent.querySelector('#videoCam');
    videoCam.srcObject = stream;

    const closeModalCam = modalContent.querySelector('#closeModalCam');
    const captureBtn = modalContent.querySelector('#captureBtn');

    closeModalCam.addEventListener('click', () => {
      stream.getTracks().forEach(t => t.stop());
      profileModal.style.display = 'none';
      // Restaurar modal original
      location.reload();
    });

    captureBtn.addEventListener('click', () => {
      canvas.width = videoCam.videoWidth;
      canvas.height = videoCam.videoHeight;
      ctx.drawImage(videoCam, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      profilePic.src = dataURL;
      stream.getTracks().forEach(t => t.stop());
      // Restaurar modal original
      location.reload();
    });

  } catch (err) {
    alert('No se pudo acceder a la cámara: ' + err.message);
  }
});

saveProfileBtn.addEventListener('click', async () => {
  const newName = nameInput.value.trim();
  if (newName === '') {
    alert('El nombre no puede estar vacío');
    return;
  }

  try {
    const currentUser = auth.currentUser;

    let photoURL = currentUser.photoURL || null;

    // Si se cambió la imagen (no es URL de Firebase ni 'default-profile.png')
    if (profilePic.src && !profilePic.src.startsWith('http') && !profilePic.src.includes('default-profile.png')) {
      const blob = await (await fetch(profilePic.src)).blob();
      const storageRef = storage.ref(`profile_pictures/${currentUser.uid}.jpg`);
      await storageRef.put(blob);
      photoURL = await storageRef.getDownloadURL();
    }

    // Actualizar el perfil (con o sin foto)
    await currentUser.updateProfile({
      displayName: newName,
      photoURL: photoURL
    });

    // Actualizar UI
    userNameEl.textContent = newName;
    welcomeMsg.textContent = `Bienvenido, ${newName}`;
    userInitialsEl.textContent = getInitials(newName);
    if (photoURL) {
      profileBtn.style.backgroundImage = `url(${photoURL})`;
      profileBtn.style.backgroundSize = 'cover';
      profileBtn.style.color = 'transparent';
      profilePic.src = photoURL;
    } else {
      profileBtn.style.backgroundImage = 'none';
      profileBtn.style.color = 'white';
    }

    alert('Perfil actualizado correctamente');
    profileModal.style.display = 'none';

  } catch (error) {
    console.error('Error al guardar perfil:', error);
    alert('Ocurrió un error al guardar los cambios');
  }
});



