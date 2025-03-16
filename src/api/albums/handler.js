const autoBind = require('auto-bind');

class AlbumsHandler {
  constructor(service, validator) {
    this._service = service;
    this._validator = validator;

    autoBind(this);
  }

  async postAlbumHandler(request, h) {
    this._validator.validateAlbumPayload(request.payload);
    const { name, year } = request.payload;

    const albumId = await this._service.addAlbums({ name, year });

    const response = h.response({
      status: 'success',
      message: 'Album has been succesfully added',
      data: {
        albumId,
      },
    });
    response.code(201);
    return response;
  }

  async getAlbumByIdHandler(request, h) {
    const { id } = request.params;
    const album = await this._service.getAlbumById(id);
    const response = h.response({
      status: 'success',
      data: {
        album,
      },
    });
    response.code(200);
    return response;
  }

  async putAlbumByIdHandler(request, h) {
    this._validator.validateAlbumPayload(request.payload);
    const { name, year } = request.payload;
    const { id } = request.params;

    await this._service.editAlbumById(id, { name, year });

    const response = h.response({
      status: 'success',
      message: 'Album has been succesfully updated',
    });
    response.code(200);
    return response;
  }

  async deleteAlbumByIdHandler(request, h) {
    const { id } = request.params;

    await this._service.deleteAlbumById(id);

    const response = h.response({
      status: 'success',
      message: 'Album has been succesfully deleted',
    });
    response.code(200);
    return response;
  }

  async postAlbumLikeHandler(request, h) {
    const { id: albumId } = request.params;
    const { id: userId } = request.auth.credentials;

    // Debugging userId and albumId
    console.log('User ID:', userId);
    console.log('Album ID:', albumId);

    await this._service.getAlbumById(albumId);

    const alreadyLike = await this._service.validateLikeAlbum(userId, albumId);
    if (!alreadyLike) {
      await this._service.addAlbumLikes(userId, albumId);
    } else {
      const response = h.response({
        status: 'fail',
        message: 'you can only like the album once',
      });
      response.code(400);
      return response;
    }

    const response = h.response({
      status: 'success',
      message: 'Like successfully added',
    });
    response.code(201);
    return response;
  }

  async getAlbumLikeHandler(request, h) {
    const { id: albumId } = request.params;
    const { customHeader, likes } = await this._service.getAlbumLikes(albumId);

    const response = h.response({
      status: 'success',
      data: {
        likes,
      },
    });
    response.header('X-Data-Source', customHeader);
    response.code(200);
    return response;
  }

  async deleteAlbumLikeHandler(request, h) {
    const { id: albumId } = request.params;
    const { id: userId } = request.auth.credentials;

    await this._service.deleteAlbumLike(albumId, userId);

    const response = h.response({
      status: 'success',
      message: 'Successfully unliked the album',
    });
    response.code(200);
    return response;
  }
}

module.exports = AlbumsHandler;