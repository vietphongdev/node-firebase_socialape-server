const firebase = require('firebase');
const firebaseConfig = require('./configs/firebase-config');

firebase.initializeApp(firebaseConfig);

module.exports = firebase;