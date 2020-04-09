const errMsg = {
  // General
  server: 'Something went wrong',
  invalidFileType: 'Wrong file type submitted',

  // authentication
  empty: 'must not be empty !',
  invalidEmail: 'email must be a valid email address !',
  invalidPassword: 'password must be at least 6 characters !',
  notMatchPassword: 'password confirm must match',
  notFoundToken: 'No token found !',
  alreadyToken: 'this handle is already taken',
  unauthorize: 'Unauthorized',

  // User
  notFoundUser : 'User not found',
  
  // Scream
  notFoundScream: 'Scream not found',
  screamAlreadyLiked: 'Scream already liked',
}

module.exports = errMsg;