const admin = require('../admin');
const {isEmpty} = require('../helpers/validators');
const errMsg = require('../constants/errror-messages');
const successMsg = require('../constants/success-messages');

// Create Scream : Clear
const createScream = (req, res) => {
	if(isEmpty(req.body.body)){
		return res.status(400).json({body: `Body ${errMsg.empty}`});
  }  
	let newScream = {
		body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0
	};
	admin
		.firestore()
		.collection('screams')
		.add(newScream)
		.then(doc => {
      newScream = {
        ...newScream,
        screamId : doc.id
      }
			res.json(newScream);
		})
		.catch(err => {
			res.status(500).json({error: errMsg.server});
			console.error(err)
		})
};

// Get All Screams : Clear
const getScreams = (req, res) => {
	admin
		.firestore()
		.collection("screams")
		.orderBy('createdAt', 'desc')
    .get()
    .then(data => {      
      let screams = [];
      data.docs.forEach(doc => {
        screams.push({
					screamId: doc.id,
					body: doc.data().body,
					userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt,
          commentCount: doc.data().commentCount,
          likeCount: doc.data().likeCount,
          userImage: doc.data().userImage
				});
      });
      return res.json(screams);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({error: err.code})
    });
};

// Get Scream Detail : Clear
const getScream = (req, res) => {
  let screamData = {};
	admin
		.firestore()
		.doc(`/screams/${req.params.screamId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: errMsg.notFoundScream });
      }
      screamData = doc.data();
      screamData.screamId = doc.id;
			return admin
				.firestore()
        .collection('comments')
        .orderBy('createdAt', 'desc')
        .where('screamId', '==', req.params.screamId)
        .get();
    })
    .then(data => {
      screamData.comments = [];
      data.docs.forEach(doc => {
        screamData.comments.push(doc.data());
      });
      return res.json(screamData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// Delete Scream : Clear
const deleteScream = (req, res) => {
  const screamDocument = admin.firestore().doc(`/screams/${req.params.screamId}`);
  screamDocument
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: errMsg.notFoundScream });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: errMsg.unauthorize });
      } else {
        return screamDocument.delete();
      }
    })
    .then(() => {
      res.json({ message: successMsg.deleteScreamSuccess });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.code });
    });
};

// Like Scream : Clear
const likeScream = (req, res) => {

  const screamDocument = admin
    .firestore()
    .doc(`/screams/${req.params.screamId}`);

  const likeDocument = admin
    .firestore()
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('screamId', '==', req.params.screamId)
    .limit(1); 

  let screamData;

  screamDocument
    .get()
    .then(doc => {      
      if (doc.exists) {
        screamData = doc.data();
        screamData.screamId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: errMsg.notFoundScream });
      }
    })
    .then(data => {
      if (data.empty) {
        return admin
          .firestore()
          .collection('likes')
          .add({
            screamId: req.params.screamId,
            userHandle: req.user.handle
          })
          .then(() => {
            screamData.likeCount++;
            return screamDocument.update({ likeCount: screamData.likeCount });
          })
          .then(() => {
            return res.json(screamData);
          });
      } 
      else {
        return res.status(400).json({ error: errMsg.screamAlreadyLiked });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// Unlike Scream : Clear
const unlikeScream = (req, res) => {

  const screamDocument = admin.firestore().doc(`/screams/${req.params.screamId}`);
  const likeDocument = admin
  .firestore()
  .collection('likes')
  .where('userHandle', '==', req.user.handle)
  .where('screamId', '==', req.params.screamId)
  .limit(1);

  let screamData;

  screamDocument
    .get()
    .then(doc => {
      if (doc.exists) {
        screamData = doc.data();
        screamData.screamId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: errMsg.notFoundScream });
      }
    })
    .then(data => {
      if (data.empty) {
        return res.status(400).json({ error: 'Scream not liked' });
      } else {
        return admin
          .firestore()
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            screamData.likeCount--;
            return screamDocument.update({ likeCount: screamData.likeCount });
          })
          .then(() => {
            res.json(screamData);
          });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// Add Comment On Scream  : Clear
const addComment = (req, res) => {
  if(isEmpty(req.body.body)) return res.status(400).json({error: `Comment ${errMsg.empty}`});
  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    screamId: req.params.screamId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl
  };
  admin
    .firestore()
    .doc(`screams/${req.params.screamId}`)
    .get()
    .then(doc => {
      if(doc.exists){
        return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
      }else{
        return res.status(404).json({error: errMsg.notFoundScream});
      }
    })
    .then(() => {
      return admin.firestore().collection('comments').add(newComment);
    })
    .then(() => {
      res.json(newComment)
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({error: err.code})
    })
};

module.exports = {
  createScream,
	getScreams,
  getScream,
  deleteScream,
  likeScream,
  unlikeScream,
  addComment
};