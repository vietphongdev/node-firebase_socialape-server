const admin = require('firebase-admin');
const adminConfig = require('./configs/admin-config.json');

admin.initializeApp({
	credential: admin.credential.cert(adminConfig)
});


module.exports = admin