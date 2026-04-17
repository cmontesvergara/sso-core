/**
 * Manual mock para JWT - usado automáticamente por Jest cuando se llama jest.mock('../jwt')
 */

export const JWT = {
  verifyToken: jest.fn(),
  decodeToken: jest.fn(),
  signToken: jest.fn(),
};
