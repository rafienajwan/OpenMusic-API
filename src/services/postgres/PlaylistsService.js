const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const AuthorizationError = require('../../exceptions/AuthorizationError');

class PlaylistsService {
  constructor(collaborationsService, cacheService) {
    this._pool = new Pool();
    this._collaborationsService = collaborationsService;
    this._cacheService = cacheService;
  }

  async addPlaylist({ name, owner }) {
    const id = `playlist-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlists VALUES($1, $2, $3) RETURNING id',
      values: [id, name, owner],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError('Failed to add playlist');
    }

    await this._cacheService.delete(`playlists:${owner}`);

    return result.rows[0].id;
  }

  async getPlaylists(owner) {
    try {
      const result = await this._cacheService.get(`playlists:${owner}`);
      return {
        playlists: JSON.parse(result),
        source: 'cache'
      };
    } catch {
      const query = {
        text: `
        SELECT playlists.id, playlists.name , users.username FROM playlists
        LEFT JOIN users ON users.id = playlists.owner 
        LEFT JOIN collaborations ON collaborations.playlist_id = playlists.id 
        WHERE playlists.owner = $1 OR collaborations.user_id = $1
        `,
        values: [owner],
      };

      const result = await this._pool.query(query);

      await this._cacheService.set(`playlists:${owner}`, JSON.stringify(result.rows));

      return {
        playlists: result.rows,
        source: 'server'
      };
    }
  }

  async deletePlaylistById(id) {
    const query = {
      text: 'DELETE FROM playlists WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Failed to delete playlist. Id not found');
    }

    await this._cacheService.delete(`playlist:${id}`);
    await this._cacheService.delete(`activities:${id}`);
  }

  async addPlaylistSong(playlistId, songId, userId) {
    const id = `playlistsongs-${nanoid(16)}`;

    const query = {
      text: `
        WITH song_check AS (
          SELECT id FROM songs WHERE id = $1
        )
        INSERT INTO playlistsongs (id, playlist_id, song_id)
        SELECT $2, $3, $1
        FROM song_check
        RETURNING id
      `,
      values: [songId, id, playlistId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Failed to add song to playlist. Song not found');
    }

    // Record the activity
    await this.addActivity(playlistId, songId, userId, 'add');

    await this._cacheService.delete(`playlist:${playlistId}`);
    await this._cacheService.delete(`activities:${playlistId}`);

    return result.rows[0].id;
  }

  async getPlaylistSongs(playlistId) {
    try {
      const result = await this._cacheService.get(`playlist:${playlistId}`);
      return {
        playlist: JSON.parse(result),
        source: 'cache'
      };
    } catch {
      const playlistQuery = {
        text: `
          SELECT playlists.id, playlists.name, users.username 
          FROM playlists 
          JOIN users ON playlists.owner = users.id 
          WHERE playlists.id = $1
        `,
        values: [playlistId],
      };

      const playlistResult = await this._pool.query(playlistQuery);

      if (!playlistResult.rows.length) {
        throw new NotFoundError('Playlist not found');
      }

      const playlist = playlistResult.rows[0];

      const songsQuery = {
        text: `
          SELECT songs.id, songs.title, songs.performer 
          FROM playlistsongs
          JOIN songs ON playlistsongs.song_id = songs.id
          WHERE playlistsongs.playlist_id = $1
        `,
        values: [playlistId],
      };

      const songsResult = await this._pool.query(songsQuery);

      playlist.songs = songsResult.rows;

      await this._cacheService.set(`playlist:${playlistId}`, JSON.stringify(playlist));

      return {
        playlist,
        source: 'server'
      };
    }
  }

  async deletePlaylistSongById(playlistId, songId, userId) {
    const query = {
      text: 'DELETE FROM playlistsongs WHERE playlist_id = $1 AND song_id = $2 RETURNING id',
      values: [playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Failed to delete song from playlist. Song not found');
    }

    // Record the activity
    await this.addActivity(playlistId, songId, userId, 'delete');

    await this._cacheService.delete(`playlist:${playlistId}`);
    await this._cacheService.delete(`activities:${playlistId}`);

    return result.rows[0].id;
  }

  async verifyPlaylistOwner(playlistId, owner) {
    const query = {
      text: 'SELECT owner FROM playlists WHERE id = $1',
      values: [playlistId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Playlist not found');
    }

    const playlist = result.rows[0];

    if (playlist.owner !== owner) {
      throw new AuthorizationError('You have no access to this playlist');
    }
  }

  async checkPlaylistExists(playlistId) {
    const query = {
      text: 'SELECT id FROM playlists WHERE id = $1',
      values: [playlistId],
    };

    const result = await this._pool.query(query);
    return result.rows.length > 0;
  }

  async verifyPlaylistAccess(playlistId, userId) {
    try {
      await this.verifyPlaylistOwner(playlistId, userId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      if (error instanceof AuthorizationError) {
        const query = {
          text: 'SELECT * FROM collaborations WHERE playlist_id = $1 AND user_id = $2',
          values: [playlistId, userId],
        };

        const result = await this._pool.query(query);

        if (!result.rows.length) {
          throw new AuthorizationError('You have no access to this playlist');
        }
      }
    }
  }

  async getPlaylistSongActivities(playlistId) {
    try {
      const result = await this._cacheService.get(`activities:${playlistId}`);
      return {
        activities: JSON.parse(result),
        source: 'cache'
      };
    } catch {
      const playlistQuery = {
        text: 'SELECT id FROM playlists WHERE id = $1',
        values: [playlistId],
      };

      const playlistResult = await this._pool.query(playlistQuery);

      if (!playlistResult.rows.length) {
        throw new NotFoundError('Playlist not found');
      }

      const query = {
        text: `
          SELECT users.username, songs.title, playlist_song_activities.action, 
                 playlist_song_activities.time
          FROM playlist_song_activities 
          JOIN users ON playlist_song_activities.user_id = users.id
          JOIN songs ON playlist_song_activities.song_id = songs.id
          WHERE playlist_song_activities.playlist_id = $1
          ORDER BY playlist_song_activities.time ASC
        `,
        values: [playlistId],
      };

      const result = await this._pool.query(query);

      await this._cacheService.set(`activities:${playlistId}`, JSON.stringify(result.rows));

      return {
        activities: result.rows,
        source: 'server'
      };
    }
  }

  async addActivity(playlistId, songId, userId, action) {
    const id = `activity-${nanoid(16)}`;
    const time = new Date().toISOString();

    const query = {
      text: 'INSERT INTO playlist_song_activities VALUES($1, $2, $3, $4, $5, $6) RETURNING id',
      values: [id, playlistId, songId, userId, action, time],
    };

    await this._pool.query(query);
  }
}

module.exports = PlaylistsService;