const admin = require('../admin');
const errMsg = require('../constants/errror-messages');

// Confuse
const authenticate = (req, res, next) => {
  let idToken;
  if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')){
    idToken = req.headers.authorization.split('Bearer ')[1];
  }else{    
    return res.status(403).json({ error: errMsg.unauthorize });
  }

  admin
    .auth()
    .verifyIdToken(idToken)
    .then(decodedToken => {
      req.user = decodedToken;
      return admin
        .firestore()
        .collection('users')
        .where('userId', '==', req.user.uid)
        .limit(1) // why?
        .get();
    })
    .then(data => {
      req.user.userId = data.docs[0].data().userId;
      req.user.userName = data.docs[0].data().userName;
      req.user.userImage = data.docs[0].data().userImage;
      return next();
    })
    .catch(err => {
      return res.status(403).json({ error: err.code })
    })
}

module.exports = authenticate;