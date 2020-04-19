const functions = require('firebase-functions');
const express = require('express');
const authenticate = require('./middleware/auth-middleware');
const admin = require('./admin');

const {
  getPosts, 
  createPost,
  getPost,
  deletePost,
  likePost,
  unlikePost,
  addComment,
} = require('./routes/posts');
const {
  signup, 
  login, 
  uploadAvatar, 
  updateUser,
  getUserOwner,
  getUserGuest,
  markNotificationsRead
} = require('./routes/users');

const app = express();

// User route
app.post('/signup', signup);
app.post('/login', login);
app.post('/user', authenticate, updateUser);
app.post('/user/avatar', authenticate, uploadAvatar);
app.get('/user', authenticate, getUserOwner);
app.get('/user/:userId', getUserGuest);
app.post('/notifications', authenticate, markNotificationsRead);


// Post route
app.post('/post', authenticate, createPost);
app.get('/posts', getPosts);
app.get('/post/:postId', getPost);
app.get('/post/:postId/like', authenticate, likePost);
app.get('/post/:postId/unlike', authenticate, unlikePost);
app.post('/post/:postId/comment', authenticate, addComment);
app.delete('/post/:postId', authenticate, deletePost);


exports.api = functions.https.onRequest(app);

// Create Notification When Liked : Clear
exports.createNotificationOnLike = functions.firestore.document('likes/{id}')
  .onCreate(likeDoc => {
    const postRef = admin.firestore().doc(`/posts/${likeDoc.data().postId}`);
    return postRef
      .get()
      .then(postDoc => {
        if(
          postDoc.exists && 
          postDoc.data().authorId !== likeDoc.data().userHandle
        ){
          return admin.firestore().doc(`/notifications/${likeDoc.id}`).set({
            postId: postDoc.id,
            createdAt: new Date().toISOString(),
            recipient: postDoc.data().authorId,
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

// Create Notification When Unliked : Clear
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
    const postRef = admin.firestore().doc(`/posts/${commentDoc.data().postId}`);
    return postRef
      .get()
      .then(postDoc => {
        if(
          postDoc.exists &&
          postDoc.data().authorId !== commentDoc.data().userHandle
          ){
          return admin.firestore().doc(`/notifications/${commentDoc.id}`).set({
            postId: postDoc.id,
            createdAt: new Date().toISOString(),
            recipient: postDoc.data().authorId,
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
    console.log('before >>>', userDoc.before.data());
    console.log('after >>>', userDoc.after.data());
    if (userDoc.before.data().userImage !== userDoc.after.data().userImage) {
      console.log('image has changed');
      const batch = admin.firestore().batch();
      return admin
        .firestore()
        .collection('posts')
        .where('authorId', '==', userDoc.before.data().userId)
        .get()
        .then(data => { 
          data.docs.forEach(doc => {
            const post = admin.firestore().doc(`/posts/${doc.id}`);
            batch.update(post, { authorImage: userDoc.after.data().userImage });
          });
          return batch.commit();
        });
    } else {
      return true;
    }
  });

  // Delete Post : Confuse
exports.onPostDelete = functions.firestore.document('/posts/{postId}')
  .onDelete((snapshot, context) => {
    const postId = context.params.postId;
    const batch = admin.firestore().batch();
    return admin
      .firestore()
      .collection('comments')
      .where('postId', '==', postId)
      .get()
      .then(data => {
        data.docs.forEach(doc => {
          batch.delete(admin.firestore().doc(`/comments/${doc.id}`));
        });
        return admin
          .firestore()
          .collection('likes')
          .where('postId', '==', postId)
          .get();
      })
      .then(data => {
        data.docs.forEach(doc => {
          batch.delete(admin.firestore().doc(`/likes/${doc.id}`));
        });
        return admin
          .firestore()
          .collection('notifications')
          .where('postId', '==', postId)
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