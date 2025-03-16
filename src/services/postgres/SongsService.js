const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const { mapSongsToModel } = require('../../utils/songs');

class SongsService {
  constructor(cacheService) {
    this._pool = new Pool();
    this._cacheService = cacheService;
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
    try {
      if (!title && !performer) {
        const result = await this._cacheService.get('songs:all');
        return {
          songs: JSON.parse(result),
          source: 'cache'
        };
      }
      throw new Error('Skip cache for filtered queries');
    } catch {
      let query = 'SELECT id, title, performer FROM songs';
      const conditions = [];
      const values = [];

      if (title) {
        conditions.push(`title ILIKE $${conditions.length + 1}`);
        values.push(`%${title}%`);
      }

      if (performer) {
        conditions.push(`performer ILIKE $${conditions.length + 1}`);
        values.push(`%${performer}%`);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      const result = await this._pool.query(query, values);
      const mappedResult = result.rows.map(mapSongsToModel);

      if (!title && !performer) {
        await this._cacheService.set('songs:all', JSON.stringify(mappedResult));
      }

      return {
        songs: mappedResult,
        source: 'server'
      };
    }
  }

  async getSongById(id) {
    try {
      const result = await this._cacheService.get(`song:${id}`);
      return {
        song: JSON.parse(result),
        source: 'cache'
      };
    } catch {
      const query = {
        text: 'SELECT * FROM songs WHERE id = $1',
        values: [id],
      };

      const result = await this._pool.query(query);

      if (!result.rows.length) {
        throw new NotFoundError('Song not found');
      }

      const song = result.rows.map(mapSongsToModel)[0];

      await this._cacheService.set(`song:${id}`, JSON.stringify(song));

      return {
        song,
        source: 'server'
      };
    }
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

    await this._cacheService.delete(`song:${id}`);

    if (albumId) {
      await this._cacheService.delete(`album:${albumId}`);
    }
  }

  async deleteSongById(id) {
    const songQuery = {
      text: 'SELECT album_id FROM songs WHERE id = $1',
      values: [id],
    };
    const songResult = await this._pool.query(songQuery);

    if (songResult.rows.length > 0) {
      const { albumId } = songResult.rows[0];
      if (albumId) {
        await this._cacheService.delete(`album:${albumId}`);
      }
    }

    const query = {
      text: 'DELETE FROM songs WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Failed to delete song. Id not found');
    }

    await this._cacheService.delete(`song:${id}`);
  }
}

module.exports = SongsService;