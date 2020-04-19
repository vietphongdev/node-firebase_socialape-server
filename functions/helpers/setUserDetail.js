const {isEmpty} = require('./validators');

const setUserDetail = (data) => {
  let userDetail = {};

  if (!isEmpty(data.bio.trim())) userDetail.bio = data.bio;
  if (!isEmpty(data.website.trim())) {
    // https://website.com
    if (data.website.trim().substring(0, 4) !== 'http') {
      userDetail.website = `http://${data.website.trim()}`;
    } else {
      userDetail.website = data.website;
    }
  }
  if (!isEmpty(data.location.trim())) userDetail.location = data.location;

  return userDetail;
};

module.exports = setUserDetail;