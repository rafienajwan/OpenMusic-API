const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const { mapSongsToModel } = require('../../utils/songs');

class SongsService {
  constructor() {
    this._pool = new Pool();
  }

  async addSong({ title, year, performer, genre, duration = null, albumId = null }) {
    const id = `song-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO songs VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      values: [id, title, year, performer, genre, duration, albumId],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Failed to add song');
    }

    return result.rows[0].id;
  }

  async getSongs({ title, performer }) {
    let query = 'SELECT id, title, performer FROM songs';
    const conditions = [];
    const values = [];

    if (title) {
      conditions.push(`title ILIKE $${  conditions.length + 1}`);
      values.push(`%${title}%`);
    }

    if (performer) {
      conditions.push(`performer ILIKE $${  conditions.length + 1}`);
      values.push(`%${performer}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${  conditions.join(' AND ')}`;
    }

    const result = await this._pool.query(query, values);
    return result.rows.map(mapSongsToModel);
  }

  async getSongById(id) {
    const query = {
      text: 'SELECT * FROM songs WHERE id = $1',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Song not found');
    }

    return result.rows.map(mapSongsToModel)[0];
  }

  async editSongById(id, { title, year, genre, performer, duration, albumId }) {

    const query = {
      text: 'UPDATE songs SET title = $1, year = $2, genre = $3, performer = $4, duration = $5, album_id = $6 WHERE id = $7 RETURNING id',
      values: [title, year, genre, performer, duration, albumId, id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Failed to update song. Id not found');
    }
  }

  async deleteSongById(id) {
    const query = {
      text: 'DELETE FROM songs WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Failed to delete song. Id not found');
    }
  }
}

module.exports = SongsService;