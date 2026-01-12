import { Validator } from '../validator';

describe('Validator', () => {
  it('should validate required field', () => {
    const validator = Validator.create();
    validator.isRequired('', 'email');

    expect(validator.isValid()).toBe(false);
    expect(validator.getErrors()).toHaveLength(1);
  });

  it('should validate email format', () => {
    const validator = Validator.create();
    validator.isEmail('invalid-email', 'email');

    expect(validator.isValid()).toBe(false);
    expect(validator.getErrors()).toHaveLength(1);
  });

  it('should accept valid email', () => {
    const validator = Validator.create();
    validator.isEmail('test@example.com', 'email');

    expect(validator.isValid()).toBe(true);
  });

  it('should validate string type', () => {
    const validator = Validator.create();
    validator.isString(123, 'name');

    expect(validator.isValid()).toBe(false);
  });

  it('should validate min length', () => {
    const validator = Validator.create();
    validator.minLength('hi', 5, 'password');

    expect(validator.isValid()).toBe(false);
  });

  it('should validate max length', () => {
    const validator = Validator.create();
    validator.maxLength('this is a very long string', 10, 'name');

    expect(validator.isValid()).toBe(false);
  });

  it('should support chaining', () => {
    const validator = Validator.create()
      .isRequired('test@example.com', 'email')
      .isEmail('test@example.com', 'email')
      .minLength('password123', 8, 'password');

    expect(validator.isValid()).toBe(true);
  });
});
