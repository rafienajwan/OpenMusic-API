const { nanoid } = require('nanoid');
const { Pool } = require('pg');

const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const AuthenticationError = require('../../exceptions/AuthenticationError');

const bcrypt = require('bcrypt');

class UsersService {
  constructor(cacheService) {
    this._pool = new Pool();
    this._cacheService = cacheService;
  }

  async verifyNewUsername(username) {
    const query = {
      text: 'SELECT username FROM users WHERE username = $1',
      values: [username],
    };

    const result = await this._pool.query(query);

    if (result.rows.length > 0) {
      throw new InvariantError('failed to add user. Username has already been used.');
    }
  }

  async addUser({ username, password, fullname }) {
    await this.verifyNewUsername(username);

    const id = `user-${nanoid(16)}`;
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = {
      text: 'INSERT INTO users VALUES($1, $2, $3, $4) RETURNING id',
      values: [id, username, hashedPassword, fullname],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('User failed to add');
    }

    return result.rows[0].id;
  }

  async getUserById(userId) {
    try {
      const result = await this._cacheService.get(`user:${userId}`);
      return {
        user: JSON.parse(result),
        source: 'cache'
      };
    } catch {
      const query = {
        text: 'SELECT id, username, fullname FROM users WHERE id = $1',
        values: [userId],
      };

      const result = await this._pool.query(query);

      if (!result.rows.length) {
        throw new NotFoundError('User not found');
      }

      await this._cacheService.set(`user:${userId}`, JSON.stringify(result.rows[0]));

      return {
        user: result.rows[0],
        source: 'server'
      };
    }
  }

  async getUsersByUsername(username) {
    const query = {
      text: 'SELECT id, username, fullname FROM users WHERE username LIKE $1',
      values: [`%${username}%`],
    };
    const result = await this._pool.query(query);
    return result.rows;
  }

  async verifyUserCredential(username, password) {
    const query = {
      text: 'SELECT id, password FROM users WHERE username = $1',
      values: [username],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new AuthenticationError('the credentials you provided are incorrect');
    }

    const { id, password: hashedPassword } = result.rows[0];

    const isPasswordMatch = await bcrypt.compare(password, hashedPassword);

    if (!isPasswordMatch) {
      throw new AuthenticationError('the credentials you provided are incorrect');
    }

    return id;
  }
}

module.exports = UsersService;