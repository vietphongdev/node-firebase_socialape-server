const {isEmpty} = require('./validators');

const setProfile = (data) => {
  let userProfile = {};

  if (!isEmpty(data.bio.trim())) userProfile.bio = data.bio;
  if (!isEmpty(data.website.trim())) {
    // https://website.com
    if (data.website.trim().substring(0, 4) !== 'http') {
      userProfile.website = `http://${data.website.trim()}`;
    } else userProfile.website = data.website;
  }
  if (!isEmpty(data.location.trim())) userProfile.location = data.location;

  return userProfile;
};

module.exports = setProfile;