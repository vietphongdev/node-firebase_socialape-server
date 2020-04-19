const admin = require('../admin');
const {isEmpty} = require('../helpers/validators');
const errMsg = require('../constants/errror-messages');
const successMsg = require('../constants/success-messages');

// Create Post : Clear
const createPost = (req, res) => {
  const { category, title, body } = req.body;
  let errors = {};
  if (isEmpty(category)) {
		errors.category = `category ${errMsg.empty}`;
	};
  if (isEmpty(title)) {
		errors.title = `title ${errMsg.empty}`;
	};
  if (isEmpty(body)) {
		errors.body = `body ${errMsg.empty}`;
  };
  if (Object.keys(errors).length) {
    return res.status(400).json(errors);
  }

	let newPost = {
    category,
    title,
		body,
    authorId: req.user.userId,
    authorName: req.user.userName,
    authorImage: req.user.userImage,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0
	};
	admin
		.firestore()
		.collection('posts')
		.add(newPost)
		.then(doc => {
      newPost = {
        ...newPost,
        postId : doc.id
      }
			res.json(newPost);
		})
		.catch(err => {
			res.status(500).json({error: err.code});
		})
};

// Get All Posts : Clear
const getPosts = (req, res) => {
	admin
		.firestore()
		.collection("posts")
		.orderBy('createdAt', 'desc')
    .get()
    .then(data => {      
      let posts = [];
      data.docs.forEach(doc => {
        posts.push({
					postId: doc.id,
					category: doc.data().category,
					title: doc.data().title,
					body: doc.data().body,
					authorId: doc.data().authorId,
					authorName: doc.data().authorName,
					authorImage: doc.data().authorImage,
          createdAt: doc.data().createdAt,
          commentCount: doc.data().commentCount,
          likeCount: doc.data().likeCount,
				});
      });
      return res.json(posts);
    })
    .catch(err => {
      res.status(500).json({error: err.code})
    });
};

// Get Post Detail : Clear
const getPost = (req, res) => {
  let postData = {};
	admin
		.firestore()
		.doc(`/posts/${req.params.postId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: errMsg.notFoundPost });
      }
      postData = doc.data();
      postData.postId = doc.id;
			return admin
				.firestore()
        .collection('comments')
        .orderBy('createdAt', 'desc')
        .where('postId', '==', req.params.postId)
        .get();
    })
    .then(data => {
      postData.comments = [];
      data.docs.forEach(doc => {
        postData.comments.push(doc.data());
      });
      return res.json(postData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// Like Post : Clear
const likePost = (req, res) => {

  const postDocument = admin
    .firestore()
    .doc(`/posts/${req.params.postId}`);

  const likeDocument = admin
    .firestore()
    .collection('likes')
    .where('userHandle', '==', req.user.userId)
    .where('postId', '==', req.params.postId)
    .limit(1); 

  let postData;

  postDocument
    .get()
    .then(doc => {      
      if (doc.exists) {
        postData = doc.data();
        postData.postId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: errMsg.notFoundPost });
      }
    })
    .then(data => {
      if (data.empty) {
        return admin
          .firestore()
          .collection('likes')
          .add({
            postId: req.params.postId,
            userHandle: req.user.userId
          })
          .then(() => {
            postData.likeCount++;
            return postDocument.update({ likeCount: postData.likeCount });
          })
          .then(() => {
            return res.json(postData);
          });
      } 
      else {
        return res.status(400).json({ error: errMsg.postAlreadyLiked });
      }
    })
    .catch((err) => {
      res.status(500).json({ error: err.code });
    });
};

// Unlike Post : Clear
const unlikePost = (req, res) => {

  const postDocument = admin.firestore().doc(`/posts/${req.params.postId}`);
  const likeDocument = admin
  .firestore()
  .collection('likes')
  .where('userHandle', '==', req.user.userId)
  .where('postId', '==', req.params.postId)
  .limit(1);

  let postData;

  postDocument
    .get()
    .then(doc => {
      if (doc.exists) {
        postData = doc.data();
        postData.postId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: errMsg.notFoundPost });
      }
    })
    .then(data => {
      if (data.empty) {
        return res.status(400).json({ error: errMsg.postNotLikeYet });
      } else {
        return admin
          .firestore()
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            postData.likeCount--;
            return postDocument.update({ likeCount: postData.likeCount });
          })
          .then(() => {
            res.json(postData);
          });
      }
    })
    .catch((err) => {
      res.status(500).json({ error: err.code });
    });
};

// Add Comment On Post  : Clear
const addComment = (req, res) => {
  if(isEmpty(req.body.body)) return res.status(400).json({error: `Comment ${errMsg.empty}`});
  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    postId: req.params.postId,
    userHandle: req.user.userId,
    userImage: req.user.userImage
  };
  admin
    .firestore()
    .doc(`posts/${req.params.postId}`)
    .get()
    .then(doc => {
      if(doc.exists){
        return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
      }else{
        return res.status(404).json({error: errMsg.notFoundPost});
      }
    })
    .then(() => {
      return admin.firestore().collection('comments').add(newComment);
    })
    .then(() => {
      res.json(newComment)
    })
    .catch(err => {
      res.status(500).json({error: err.code})
    })
};

// Delete Post : Clear
const deletePost = (req, res) => {
  const postDocument = admin.firestore().doc(`/posts/${req.params.postId}`);
  postDocument
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: errMsg.notFoundPost });
      }
      if (doc.data().authorId !== req.user.userId) {
        return res.status(403).json({ error: errMsg.unauthorize });
      } else {
        return postDocument.delete();
      }
    })
    .then(() => {
      res.json({ message: successMsg.deletePostSuccess });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.code });
    });
};

module.exports = {
  createPost,
	getPosts,
  getPost,
  likePost,
  unlikePost,
  addComment,
  deletePost
};