import Joi from 'joi';

export const loginV2Schema = Joi.object({
  email: Joi.string().email().trim().lowercase(),
  nuid: Joi.string().trim(),
  password: Joi.string().required(),
  deviceInfo: Joi.object({
    ip: Joi.string(),
    userAgent: Joi.string(),
    fingerprint: Joi.string().max(255),
  }).optional(),
}).xor('email', 'nuid').messages({
  'object.xor': 'Either email or nuid must be provided',
  'object.missing': 'Either email or nuid is required',
});

export const authorizeV2Schema = Joi.object({
  tenantId: Joi.string().required(),
  appId: Joi.string().required(),
  redirectUri: Joi.string().uri().required(),
  codeChallenge: Joi.string().max(128).required(),
  codeChallengeMethod: Joi.string().valid('S256', 'plain').default('S256'),
  state: Joi.string().max(255).optional(),
  nonce: Joi.string().max(255).optional(),
});

export const exchangeV2Schema = Joi.object({
  code: Joi.string().required(),
  appId: Joi.string().required(),
  codeVerifier: Joi.string().required(),
});

export const refreshV2Schema = Joi.object({
  refreshToken: Joi.string().optional(),
});

export const logoutV2Schema = Joi.object({
  revokeAll: Joi.boolean().default(false),
});