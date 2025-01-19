const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');

class SongsService {
  constructor() {
    this._songs = [];
  }

  async addSong({ title, year, genre, performer, duration = null, albumId = null }) {
    const id = `song-${nanoid(16)}`;

    const newSong = {
      id, title, year, genre, performer, duration, albumId,
    };

    this._songs.push(newSong);

    const isSuccess = this._songs.filter((song) => song.id === id).length > 0;

    if (!isSuccess) {
      throw new InvariantError('Failed to add song');
    }

    return id;
  }

  async getSongs() {
    return this._songs;
  }

  async getSongById(id) {
    const song = this._songs.filter((n) => n.id === id)[0];

    if (!song) {
      throw new NotFoundError('Song not found');
    }

    return song;
  }

  async editSongById(id, { title, year, genre, performer, duration, albumId }) {
    const index = this._songs.findIndex((song) => song.id === id);

    if (index === -1) {
      throw new NotFoundError('Failed to update song. Id not found');
    }

    this._songs[index] = {
      ...this._songs[index],
      title,
      year,
      genre,
      performer,
      duration,
      albumId,
    };
  }
}

module.exports = SongsService;
