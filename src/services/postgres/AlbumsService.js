const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const { mapAlbumsToModel } = require('../../utils/albums');
const { mapSongsToModel } = require('../../utils/songs');

class AlbumsService {
  constructor(cacheService) {
    this._pool = new Pool();
    this._cacheService = cacheService;
  }

  async addAlbums({ name, year }) {
    const id = `album-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO albums VALUES($1, $2, $3) RETURNING id',
      values: [id, name, year],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError('Failed to add album');
    }

    return result.rows[0].id;
  }

  async getAlbumById(id) {
    try {
      const result = await this._cacheService.get(`album:${id}`);
      return {
        album: JSON.parse(result),
        source: 'cache'
      };
    } catch {
      const query = {
        text: 'SELECT * FROM albums WHERE id = $1',
        values: [id],
      };

      const result = await this._pool.query(query);

      if (!result.rows.length) {
        throw new NotFoundError('Album not found');
      }

      const album = result.rows.map(mapAlbumsToModel)[0];

      const querySongs = {
        text: 'SELECT id, title, performer FROM songs WHERE album_id = $1',
        values: [album.id],
      };

      const songsResult = await this._pool.query(querySongs);

      album.songs = songsResult.rows.map(mapSongsToModel);

      const albumData = {
        id: album.id,
        name: album.name,
        year: album.year,
        coverUrl: album.coverUrl || null,
        songs: album.songs,
      };

      await this._cacheService.set(`album:${id}`, JSON.stringify(albumData));

      return {
        album: albumData,
        source: 'server'
      };
    }
  }

  async editAlbumById(id, { name, year }) {
    const query = {
      text: 'UPDATE albums SET name = $1, year = $2 WHERE id = $3 RETURNING id',
      values: [name, year, id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Failed to update album. Id not found');
    }

    await this._cacheService.delete(`album:${id}`);
  }

  async deleteAlbumById(id) {
    const query = {
      text: 'DELETE FROM albums WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Failed to delete album. Id not found');
    }

    await this._cacheService.delete(`album:${id}`);
  }

  async editAlbumToAddCoverById(id, coverUrl) {
    await this.getAlbumById(id);

    const query = {
      text: 'UPDATE albums SET cover_url = $1 WHERE id = $2 RETURNING id',
      values: [coverUrl, id],
    };
    const result = await this._pool.query(query);
    if (!result.rowCount) {
      throw new NotFoundError(
        'Cover Album failed to update. Id is not found',
      );
    }

    await this._cacheService.delete(`album:${id}`);
  }

  async addAlbumLikes(userId, albumId) {
    const id = `album_like-${nanoid(16)}`;
    const query = {
      text: 'INSERT INTO user_album_likes VALUES($1, $2, $3) RETURNING id',
      values: [id, userId, albumId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError('Failed to add album like');
    }

    await this._cacheService.delete(`likes:${albumId}`);
    return result.rows[0].id;
  }

  async getAlbumLikes(id) {
    try {
      const customHeader = 'cache';
      const likes = await this._cacheService.get(`likes:${id}`);
      return { customHeader, likes: +likes };
    } catch {
      await this.getAlbumById(id);

      const customHeader = 'server';
      const query = {
        text: 'SELECT * FROM user_album_likes WHERE album_id = $1',
        values: [id],
      };

      const result = await this._pool.query(query);
      const likes = result.rowCount;
      await this._cacheService.set(`likes:${id}`, likes);
      return { customHeader, likes };
    }
  }

  async deleteAlbumLike(id, userId) {
    await this.getAlbumById(id);

    const query = {
      text: 'DELETE FROM user_album_likes WHERE user_id = $1 AND album_id = $2 RETURNING id',
      values: [userId, id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Failed to delete album like. Id not foundn');
    }

    await this._cacheService.delete(`likes:${id}`);
  }

  async validateLikeAlbum(userId, albumId) {
    const query = {
      text: 'SELECT * FROM user_album_likes WHERE user_id = $1 AND album_id = $2',
      values: [userId, albumId],
    };
    const result = await this._pool.query(query);
    if (!result.rows.length) {
      return false;
    }
    return true;
  }
}

module.exports = AlbumsService;