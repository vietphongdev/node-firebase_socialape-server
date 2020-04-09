const imageUrl = require('../configs/imageUrl-config');

const setImageUrl = (fileName = 'default-avatar.jpg') => {
  return `${imageUrl}/${fileName}?alt=media`;
};

module.exports = setImageUrl;