const functions = require('firebase-functions');
const express = require('express');
const authenticate = require('./middleware/auth-middleware');
const admin = require('./admin');

const {
  getScreams, 
  createScream,
  getScream,
  deleteScream,
  likeScream,
  unlikeScream,
  addComment,
} = require('./routes/screams');
const {
  signup, 
  login, 
  uploadAvatar, 
  updateProfile,
  getMyProfile,
  getUserProfile,
  markNotificationsRead
} = require('./routes/users');

const app = express();

// User route
app.post('/signup', signup);
app.post('/login', login);
app.post('/user', authenticate, updateProfile);
app.post('/user/avatar', authenticate, uploadAvatar);
app.get('/user', authenticate, getMyProfile);
app.get('/user/:handle', getUserProfile);
app.post('/notifications', authenticate, markNotificationsRead);


// Screams route
app.post('/scream', authenticate, createScream);
app.get('/screams', getScreams);
app.get('/scream/:screamId', getScream);
app.delete('/scream/:screamId', authenticate, deleteScream);
app.get('/scream/:screamId/like', authenticate, likeScream);
app.get('/scream/:screamId/unlike', authenticate, unlikeScream);
app.post('/scream/:screamId/comment', authenticate, addComment);


exports.api = functions.https.onRequest(app);

// Create Notification When Liked : Clear
exports.createNotificationOnLike = functions.firestore.document('likes/{id}')
  .onCreate(likeDoc => {
    const screamRef = admin.firestore().doc(`/screams/${likeDoc.data().screamId}`);
    return screamRef
      .get()
      .then(screamDoc => {
        if(
          screamDoc.exists && 
          screamDoc.data().userHandle !== likeDoc.data().userHandle
        ){
          return admin.firestore().doc(`/notifications/${likeDoc.id}`).set({
            screamId: screamDoc.id,
            createdAt: new Date().toISOString(),
            recipient: screamDoc.data().userHandle,
            sender: likeDoc.data().userHandle,
            type: 'like',
            read: false
          })
        }
      })
      .catch(err => {
        console.error(err);
      })
  });

// Create Notification When Liked : Clear
exports.deleteNotificationOnUnlike = functions.firestore.document('likes/{id}')
  .onDelete(likeDoc => {
    const notificationRef = admin.firestore().doc(`/notifications/${likeDoc.id}`);
    return notificationRef
      .delete()
      .catch(err => {
        console.error(err);
        return
      })
  });

// Create Notification When New Comment : Clear
exports.createNotificationOnComment = functions.firestore.document('comments/{id}')
  .onCreate(commentDoc => {
    const screamRef = admin.firestore().doc(`/screams/${commentDoc.data().screamId}`);
    return screamRef
      .get()
      .then(screamDoc => {
        if(
            screamDoc.exists &&
            screamDoc.data().userHandle !== likeDoc.data().userHandle
          ){
          return admin.firestore().doc(`/notifications/${commentDoc.id}`).set({
            screamId: screamDoc.id,
            createdAt: new Date().toISOString(),
            recipient: screamDoc.data().userHandle,
            sender: commentDoc.data().userHandle,
            type: 'comment',
            read: false
          })
        }
      })
      .catch(err => {
        console.error(err);
        return;
      })
  });

// User change image avatar : Confuse
exports.onUserImageChange = functions.firestore.document('/users/{userId}')
  .onUpdate(userDoc => {
    console.log(userDoc.before.data());
    console.log(userDoc.after.data());
    if (userDoc.before.data().imageUrl !== userDoc.after.data().imageUrl) {
      console.log('image has changed');
      const batch = admin.firestore().batch();
      return admin
        .firestore()
        .collection('screams')
        .where('userHandle', '==', userDoc.before.data().handle)
        .get()
        .then(data => {
          data.docs.forEach(doc => {
            const scream = admin.firestore().doc(`/screams/${doc.id}`);
            batch.update(scream, { userImage: userDoc.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else {
      return true;
    }
  });

  // Delete Scream : Confuse
exports.onScreamDelete = functions.firestore.document('/screams/{screamId}')
  .onDelete((snapshot, context) => {
    const screamId = context.params.screamId;
    const batch = admin.firestore().batch();
    return admin
      .firestore()
      .collection('comments')
      .where('screamId', '==', screamId)
      .get()
      .then(data => {
        data.docs.forEach(doc => {
          batch.delete(admin.firestore().doc(`/comments/${doc.id}`));
        });
        return admin
          .firestore()
          .collection('likes')
          .where('screamId', '==', screamId)
          .get();
      })
      .then(data => {
        data.docs.forEach(doc => {
          batch.delete(admin.firestore().doc(`/likes/${doc.id}`));
        });
        return admin
          .firestore()
          .collection('notifications')
          .where('screamId', '==', screamId)
          .get();
      })
      .then(data => {
        data.docs.forEach(doc => {
          batch.delete(admin.firestore().doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch(err => console.error(err));
  });