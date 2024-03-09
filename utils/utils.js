const sha1 = require('sha1');

export const pwdHashed = (pwd) => sha1(pwd);

export const getAuthzHeader = (req) => {
  const hd = req.headers.authorization;

  if (!hd) {
    return null;
  }
  return hd;
};

export const getToken = (authzHeader) => {
  const tkType = authzHeader.substring(0, 6);

  if (tkType !== 'Basic ') {
    return null;
  }
  return authzHeader.substring(6);
};

export const decodeToken = (token) => {
  const dcToken = Buffer.from(token, 'base64').toString('utf8');

  if (!dcToken.includes(':')) {
    return null;
  }
  return dcToken;
};

export const getCredentials = (decodedToken) => {
  const [email, password] = dcToken.split(':');

  if (!email || !password) {
    return null;
  }
  return { email, password };
};
