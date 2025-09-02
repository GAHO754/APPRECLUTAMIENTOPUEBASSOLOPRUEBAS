// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC_WhpJxW6V6C6stDeyv6wGsj4-2rR2edQ",
  authDomain: "appreclutameinto.firebaseapp.com",
  databaseURL: "https://appreclutameinto-default-rtdb.firebaseio.com",
  projectId: "appreclutameinto",
storageBucket: "appreclutameinto.appspot.com", // ✅ Correcto
  messagingSenderId: "447789838113",
  appId: "1:447789838113:web:41d7c2ba5cd6bb304e5860",
  measurementId: "G-M9LWSVYNHC"
};
// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      alert('¡Sesión iniciada con éxito!');
      window.location.href = "dashboard.html";
    })
    .catch(error => {
      document.getElementById('error-message').innerText = error.message;
    });
}