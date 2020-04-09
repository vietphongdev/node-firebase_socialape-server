const firebaseConfig = require('./firebase-config');

const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o`;

module.exports = imageUrl;
