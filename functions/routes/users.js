const BusBoy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs');
const admin = require('../admin');
const firebase = require('../firebase');
const firebaseConfig = require('../configs/firebase-config');
const { isEmpty, isValidEmail, isValidPassword } = require('../helpers/validators');
const errMsg = require('../constants/errror-messages');
const successMsg = require('../constants/success-messages');
const notificationMsg = require('../constants/notification-messages');
const setProfile = require('../helpers/setProfile');
const setImageUrl = require('../helpers/setImageUrl');

// Sign-up: Clear
const signup = (req, res) => {
	const { email, password, confirmPassword, handle } = req.body;
	let errors = {}, token, userId;

	if (isEmpty(email)) {
		errors.email = `email ${errMsg.empty}`;
		return res.status(400).json(errors);
	};
	if (!isValidEmail(email)) {
		errors.email = errMsg.invalidEmail;
		return res.status(400).json(errors);
	};
	if (!isValidPassword(password)) {
		errors.password = errMsg.invalidPassword;
		return res.status(400).json(errors);
	};

	if (password !== confirmPassword) {
		errors.confirmPassword = errMsg.notMatchPassword;
		return res.status(400).json(errors);
	};

	if (isEmpty(handle)) {
		errors.handle = `handle ${errMsg.empty}`;
		return res.status(400).json(errors);
	};

	admin
		.firestore()
		.doc(`/users/${handle}`)
		.get()
		.then(doc => {
			if (doc.exists) {
				return res.status(400).json({ handle: 'this handle is already taken' });
			} else {
				return firebase.auth().createUserWithEmailAndPassword(email, password);
			}
		})
		.then(data => {
			userId = data.user.uid;
			return data.user.getIdToken();
		})
		.then(idToken => {
			token = idToken;
			const userCredentials = {
				email,
				handle,
				createdAt: new Date().toISOString(),
				imageUrl: setImageUrl(),
				userId
			};
			return admin.firestore().doc(`/users/${handle}`).set(userCredentials);
		})
		.then(() => {
			return res.status(201).json({ token });
		})
		.catch(err => {
			if (err.code === 'auth/email-already-in-use') {
				return res.status(400).json({ email: err.message });
			} else {
				return res.status(500).json({ general: err.server });
			}
		})
};

// Log-in: Clear
const login = (req, res) => {
	const { email, password } = req.body;
	let errors = {};

	if (!isValidEmail(email)) {
		errors.email = errMsg.invalidEmail;
		return res.status(400).json(errors);
	};
	if (!isValidPassword(password)) {
		errors.password = errMsg.invalidPassword;
		return res.status(400).json(errors);
	};

	firebase.auth().signInWithEmailAndPassword(email, password)
		.then(data => {
			return data.user.getIdToken();
		})
		.then(token => {
			return res.json({ token });
		})
		.catch(err => {
			if (err.code === 'auth/wrong-password') {
				res.status(403).json({ error: err.message });
			} else {
				return res.status(403).json({ error: err.code });
			}
		})
};

// Update Profile : Clear
const updateProfile = (req, res) => {
	let userProfile = setProfile(req.body);
	admin.firestore().doc(`/users/${req.user.handle}`)
		.update(userProfile)
		.then(() => {
			return res.json({ message: successMsg.updateProfile });
		})
		.catch((err) => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		});
};

// Upload Avatar : Confuse
const uploadAvatar = (req, res) => {
	const busboy = new BusBoy({ headers: req.headers });
	let imageFileName, imageToBeUploaded = {};

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
		admin.storage().bucket(firebaseConfig.storageBucket).upload(imageToBeUploaded.filepath, {
			resumable: false,
			metadata: {
				metadata: {
					contentType: imageToBeUploaded.mimetype
				}
			}
		})
			.then(() => {
				const imageUrl = setImageUrl(imageFileName);
				return admin.firestore().doc(`/users/${req.user.handle}`).update({ imageUrl })
			})
			.then(() => {
				return res.json({ message: successMsg.uploadImage });
			})
			.catch(err => {
				console.error(err);
				return res.status(500).json({ error: err.code });
			})
	});
	busboy.end(req.rawBody);
};

// Get MyProfile : Clear
const getMyProfile = (req, res) => {
	let userData = {};
	admin
		.firestore()
		.doc(`/users/${req.user.handle}`)
		.get()
		.then(doc => {
			if (doc.exists) {
				userData.credentials = doc.data();
				return admin
					.firestore()
					.collection('likes')
					.where('userHandle', '==', req.user.handle)
					.get();
			}
		})
		.then(data => {
			userData.likes = [];
			data.docs.forEach(doc => {
				userData.likes.push(doc.data());
			});
			return admin
				.firestore()
				.collection('notifications')
				.where('recipient', '==', req.user.handle)
				.orderBy('createdAt', 'desc')
				.limit(10)
				.get()
		})
		.then(data => {
			userData.notifications = [];
      data.forEach(doc => {
        userData.notifications.push({
          recipient: doc.data().recipient,
          sender: doc.data().sender,
          createdAt: doc.data().createdAt,
          screamId: doc.data().screamId,
          type: doc.data().type,
          read: doc.data().read,
          notificationId: doc.id
        });
      });
      return res.json(userData);
		})
		.catch((err) => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		});
};

// Get UserProfile : Clear
const getUserProfile = (req, res) => {
	let userData = {};
	admin
		.firestore()
		.doc(`/users/${req.params.handle}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        userData.user = doc.data();
				return admin
					.firestore()
          .collection('screams')
          .where('userHandle', '==', req.params.handle)
          .orderBy('createdAt', 'desc')
          .get();
      } else {
        return res.status(404).json({ errror: errMsg.notFoundUser });
      }
    })
    .then(data => {
      userData.screams = [];
      data.docs.forEach(doc => {
        userData.screams.push({
          body: doc.data().body,
          createdAt: doc.data().createdAt,
          userHandle: doc.data().userHandle,
          userImage: doc.data().userImage,
          likeCount: doc.data().likeCount,
          commentCount: doc.data().commentCount,
          screamId: doc.id
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
  req.body.forEach(notificationId => {
    const notification = admin.firestore().doc(`/notifications/${notificationId}`);
		notification.update({ read: true })
		.then(() => {
			return res.json({ message: notificationMsg.seen });
		})
		.catch(err => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		});
  });
};


module.exports = {
	signup,
	login,
	updateProfile,
	uploadAvatar,
	getMyProfile,
	getUserProfile,
	markNotificationsRead
};