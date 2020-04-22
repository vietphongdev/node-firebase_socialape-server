const BusBoy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs');
const admin = require('../admin');
const firebase = require('../firebase');
const firebaseConfig = require('../configs/firebase-config');
const {
  isEmpty,
  isValidEmail,
  isValidPassword,
} = require('../helpers/validators');
const errMsg = require('../constants/errror-messages');
const successMsg = require('../constants/success-messages');
const notificationMsg = require('../constants/notification-messages');
const setUserDetail = require('../helpers/setUserDetail');
const setImageUrl = require('../helpers/setImageUrl');

// Sign-up: Clear
const signup = (req, res) => {
  const { userName, email, password, confirmPassword } = req.body;
  let errors = {},
    token,
    userId;

  if (isEmpty(userName)) {
    errors.userName = `userName ${errMsg.empty}`;
  }
  if (isEmpty(email)) {
    errors.email = `email ${errMsg.empty}`;
  }
  if (!isValidEmail(email)) {
    errors.email = errMsg.invalidEmail;
  }
  if (!isValidPassword(password)) {
    errors.password = errMsg.invalidPassword;
  }
  if (password !== confirmPassword) {
    errors.confirmPassword = errMsg.notMatchPassword;
  }

  if (Object.keys(errors).length) {
    return res.status(400).json(errors);
  }

  firebase
    .auth()
    .createUserWithEmailAndPassword(email, password)
    .then((data) => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })
    .then((idToken) => {
      token = idToken;
      const userCredentials = {
        userId,
        userName,
        email,
        createdAt: new Date().toISOString(),
        userImage: setImageUrl(),
      };
      return admin.firestore().doc(`/users/${userId}`).set(userCredentials);
    })
    .then(() => {
      return res.status(200).json({ token });
    })
    .catch((error) => {
      if (error.code) {
        return res.status(400).json({ general: error.code });
      } else {
        return res.status(400).json({ general: error.message });
      }
    });
};

// Log-in: Clear
const login = (req, res) => {
  const { email, password } = req.body;  
  let errors = {};

  if (!isValidEmail(email)) {
    errors.email = errMsg.invalidEmail;
  }
  if (!isValidPassword(password)) {
    errors.password = errMsg.invalidPassword;
  };

  if (Object.keys(errors).length) {
    return res.status(400).json(errors);
  }

  firebase
    .auth()
    .signInWithEmailAndPassword(email, password)
    .then((data) => {
      return data.user.getIdToken();
    })
    .then((token) => {
      return res.json({ token });
    })
    .catch((error) => {
      return res.status(403).json({ general: error.message });
    });
};

// Update Profile : Clear
const updateUser = (req, res) => {
  let userDetail = setUserDetail(req.body);
  admin
    .firestore()
    .doc(`/users/${req.user.userId}`)
    .update(userDetail)
    .then(() => {
      return res.json({ message: successMsg.updateUser });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.code });
    });
};

// Upload Avatar : Confuse
const uploadAvatar = (req, res) => {
  const busboy = new BusBoy({ headers: req.headers });
  let imageFileName,
    imageToBeUploaded = {};

  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
      return res.status(400).json({ error: errMsg.invalidFileType });
    }

    const imageExtension = filename.split('.')[filename.split('.').length - 1];
    imageFileName = `${Math.round(Math.random() * 10000000)}.${imageExtension}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filepath, mimetype };
    file.pipe(fs.createWriteStream(filepath));
  });

  busboy.on('finish', () => {
    admin
      .storage()
      .bucket(firebaseConfig.storageBucket)
      .upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetype,
          },
        },
      })
      .then(() => {
        const userImage = setImageUrl(imageFileName);
        return admin
          .firestore()
          .doc(`/users/${req.user.userId}`)
          .update({ userImage });
      })
      .then(() => {
        return res.json({ message: successMsg.uploadImage });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  });
  busboy.end(req.rawBody);
};

// Get user - owner : Clear
const getUserOwner = (req, res) => {
  let userData = {};

  admin
    .firestore()
    .doc(`/users/${req.user.userId}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        userData.credentials = doc.data();

        // Get like
        return admin
          .firestore()
          .collection('likes')
          .where('userHandle', '==', req.user.userId)
          .get();
      }
    })
    .then((data) => {
      userData.likes = [];
      data.docs.forEach((doc) => {
        userData.likes.push(doc.data());
      });

      // Get notifications
      return admin
        .firestore()
        .collection('notifications')
        .where('recipient', '==', req.user.userId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
    })
    .then(data => {
      userData.notifications = [];
      data.forEach((doc) => {
        userData.notifications.push({
          recipient: doc.data().recipient,
          sender: doc.data().sender,
          createdAt: doc.data().createdAt,
          postId: doc.data().postId,
          type: doc.data().type,
          read: doc.data().read,
          notificationId: doc.id,
        });
      });

      // Get posts
      return admin
        .firestore()
        .collection('posts')
        .where('authorId', '==', req.user.userId)
        .orderBy('createdAt', 'desc')
        .get();
    })
    .then(data => {
      userData.posts = [];
      data.docs.forEach((doc) => {
        userData.posts.push({
          body: doc.data().body,
          createdAt: doc.data().createdAt,
          authorId: doc.data().authorId,
          authorName: doc.data().authorName,
          authorImage: doc.data().authorImage,
          likeCount: doc.data().likeCount,
          commentCount: doc.data().commentCount,
          postId: doc.id,
        });
      });
      return res.json(userData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

// Get user - guest : Clear
const getUserGuest = (req, res) => {
  let userData = {};
  admin
    .firestore()
    .doc(`/users/${req.params.userId}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        userData.credentials = doc.data();
        return admin
          .firestore()
          .collection('posts')
          .where('authorId', '==', req.params.userId)
          .orderBy('createdAt', 'desc')
          .get();
      } else {
        return res.status(404).json({ errror: errMsg.notFoundUser });
      }
    })
    .then((data) => {
      userData.posts = [];
      data.docs.forEach(doc => {       
        userData.posts.push({
          body: doc.data().body,
          createdAt: doc.data().createdAt,
          authorId: doc.data().authorId,
          authorName: doc.data().authorName,
          authorImage: doc.data().authorImage,
          likeCount: doc.data().likeCount,
          commentCount: doc.data().commentCount,
          postId: doc.id,
        });
      });
      return res.json(userData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

// markNotificationsRead : Confused
// const markNotificationsRead = (req, res) => {
// 	let batch = admin.firestore().batch();
//   req.body.forEach(notificationId => {
//     const notification = admin.firestore().doc(`/notifications/${notificationId}`);
//     batch.update(notification, { read: true });
//   });
//   batch
//     .commit()
//     .then(() => {
//       return res.json({ message: notificationMsg.seen });
//     })
//     .catch(err => {
//       console.error(err);
//       return res.status(500).json({ error: err.code });
//     });
// };
const markNotificationsRead = (req, res) => {
  req.body.forEach((notificationId) => {
    const notification = admin
      .firestore()
      .doc(`/notifications/${notificationId}`);
    notification
      .update({ read: true })
      .then(() => {
        return res.json({ message: notificationMsg.seen });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  });
};

module.exports = {
  signup,
  login,
  updateUser,
  uploadAvatar,
  getUserOwner,
  getUserGuest,
  markNotificationsRead,
};
