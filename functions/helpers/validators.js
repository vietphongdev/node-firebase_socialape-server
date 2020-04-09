const isEmpty = string => {
  if(typeof(string) === 'undefined'){
    return true
  }else{
    return string.trim() === '';
  }
};

const isValidEmail = (email) => {
  const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (email.match(regEx)) return true;
  else return false;
};

const isValidPassword = password => password.length >= 6;

module.exports = {
  isEmpty,
  isValidEmail,
  isValidPassword
};