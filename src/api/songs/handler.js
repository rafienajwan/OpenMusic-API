const autoBind = require('auto-bind');

class SongsHandler {
  constructor(service, validator) {
    this._service = service;
    this._validator = validator;

    autoBind(this);
  }

  async postSongHandler(request, h) {
    this._validator.validateSongPayload(request.payload);
    const { title, year, performer, genre, duration, albumId } = request.payload;

    const songId = await this._service.addSong({ title, year, performer, genre, duration, albumId });

    const response = h.response({
      status: 'success',
      message: 'Song has been succesfully added',
      data: {
        songId,
      },
    });
    response.code(201);
    return response;
  }

  async getSongsHandler(request, h) {
    const { title, performer } = request.query;
    const { songs, source } = await this._service.getSongs({ title, performer });

    const response = h.response({
      status: 'success',
      data: {
        songs,
      },
    });
    response.header('X-Data-Source', source);
    return response;
  }

  async getSongByIdHandler(request, h) {
    const { id } = request.params;
    const { song, source } = await this._service.getSongById(id);

    const response = h.response({
      status: 'success',
      data: {
        song,
      },
    });
    response.header('X-Data-Source', source);
    response.code(200);
    return response;
  }

  async putSongByIdHandler(request, h) {
    this._validator.validateSongPayload(request.payload);
    const { title, year, performer, genre, duration, albumId } = request.payload;
    const { id } = request.params;

    await this._service.editSongById(id, { title, year, performer, genre, duration, albumId });

    const response = h.response({
      status: 'success',
      message: 'Song has been succesfully updated',
    });
    response.code(200);
    return response;
  }

  async deleteSongByIdHandler(request, h) {
    const { id } = request.params;

    await this._service.deleteSongById(id);

    const response = h.response({
      status: 'success',
      message: 'Song has been succesfully deleted',
    });
    response.code(200);
    return response;
  }
}

module.exports = SongsHandler;