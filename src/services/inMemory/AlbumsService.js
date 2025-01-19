const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');

class AlbumsService {
  constructor() {
    this.albums = [];
  }

  async addAlbums({ name, year }) {
    const id = `album-${nanoid(16)}`;

    const newAlbum = {
      id, name, year,
    };

    this._albums.push(newAlbum);

    const isSuccess = this._albums.filter((album) => album.id === id).length > 0;

    if (!isSuccess) {
      throw new InvariantError('Failed to add album');
    }

    return id;
  }

  async getAlbums() {
    return this._albums;
  }

  async getAlbumById(id) {
    const album = this._albums.filter((album) => album.id === id)[0];

    if (!album) {
      throw new NotFoundError('Album not found');
    }

    return album;
  }

  async editAlbumById(id, { name, year }) {
    const index = this._albums.findIndex((album) => album.id === id);

    if (index === -1) {
      throw new NotFoundError('Failed to update album. Id not found');
    }

    this._albums[index] = {
      ...this._albums[index],
      name,
      year,
    };
  }
}

module.exports = AlbumsService;
