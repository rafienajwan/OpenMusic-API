const autoBind = require('auto-bind');
const NotFoundError = require('../../exceptions/NotFoundError');
const InvariantError = require('../../exceptions/InvariantError');
const AuthorizationError = require('../../exceptions/AuthorizationError');

class PlaylistsHandler {
  constructor(service, validator) {
    this._service = service;
    this._validator = validator;

    autoBind(this);
  }

  async postPlaylistHandler(request, h) {
    this._validator.validatePlaylistPayload(request.payload);
    const { name } = request.payload;
    const { id: credentialId } = request.auth.credentials;

    const playlistId = await this._service.addPlaylist({ name, owner: credentialId });

    const response = h.response({
      status: 'success',
      message: 'Playlist has been added successfully',
      data: {
        playlistId,
      },
    });
    response.code(201);
    return response;
  }

  async getPlaylistsHandler(request, h) {
    const { id: credentialId } = request.auth.credentials;
    const playlists = await this._service.getPlaylists(credentialId);

    const response = h.response({
      status: 'success',
      data: {
        playlists,
      },
    });
    response.code(200);
    return response;
  }

  async deletePlaylistByIdHandler(request) {
    const { playlistId } = request.params;
    const { id: owner } = request.auth.credentials;

    await this._service.verifyPlaylistOwner(playlistId, owner);
    await this._service.deletePlaylistById(playlistId);

    return {
      status: 'success',
      message: 'Playlist has been deleted',
    };
  }

  async postPlaylistSongHandler(request, h) {
    try {
      this._validator.validatePlaylistSongPayload(request.payload);
      const { id: credentialId } = request.auth.credentials;
      const { playlistId } = request.params;
      const { songId } = request.payload;

      await this._service.verifyPlaylistAccess(playlistId, credentialId);
      const playlistSongId = await this._service.addPlaylistSong(playlistId, songId, credentialId);

      const response = h.response({
        status: 'success',
        message: 'Song has been added to the playlist successfully',
        data: {
          playlistSongId,
        },
      });
      response.code(201);
      return response;
    } catch (error) {
      if (error instanceof NotFoundError) {
        const response = h.response({
          status: 'fail',
          message: error.message,
        });
        response.code(404);
        return response;
      }

      if (error instanceof InvariantError) {
        const response = h.response({
          status: 'fail',
          message: error.message,
        });
        response.code(400);
        return response;
      }

      // Re-throw the error if it's not a NotFoundError or InvariantError
      throw error;
    }
  }

  async getPlaylistSongsHandler(request, h) {
    try {
      const { id: credentialId } = request.auth.credentials;
      const { playlistId } = request.params;

      await this._service.verifyPlaylistAccess(playlistId, credentialId);
      const playlist = await this._service.getPlaylistSongs(playlistId);

      const response = h.response({
        status: 'success',
        data: {
          playlist,
        },
      });
      response.code(200);
      return response;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        const response = h.response({
          status: 'fail',
          message: error.message,
        });
        response.code(403);
        return response;
      }

      if (error instanceof NotFoundError) {
        const response = h.response({
          status: 'fail',
          message: error.message,
        });
        response.code(404);
        return response;
      }

      throw error;
    }
  }

  async deletePlaylistSongByIdHandler(request, h) {
    this._validator.validatePlaylistSongPayload(request.payload);
    const { id: credentialId } = request.auth.credentials;
    const { playlistId } = request.params;
    const { songId } = request.payload;

    await this._service.verifyPlaylistAccess(playlistId, credentialId);
    await this._service.deletePlaylistSongById(playlistId, songId, credentialId);

    const response = h.response({
      status: 'success',
      message: 'Song has been removed from playlist',
    });
    response.code(200);
    return response;
  }

  async getPlaylistSongActivitiesHandler(request, h) {
    try {
      const { id: credentialId } = request.auth.credentials;
      const { playlistId } = request.params;

      // First check if playlist exists
      const playlistExists = await this._service.checkPlaylistExists(playlistId);
      if (!playlistExists) {
        const response = h.response({
          status: 'fail',
          message: 'Playlist not found',
        });
        response.code(404);
        return response;
      }

      // Then check if user has access to the playlist
      await this._service.verifyPlaylistAccess(playlistId, credentialId);
      const activities = await this._service.getPlaylistSongActivities(playlistId);

      const response = h.response({
        status: 'success',
        data: {
          playlistId,
          activities,
        },
      });
      response.code(200);
      return response;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        const response = h.response({
          status: 'fail',
          message: error.message,
        });
        response.code(403);
        return response;
      }

      if (error instanceof NotFoundError) {
        const response = h.response({
          status: 'fail',
          message: error.message,
        });
        response.code(404);
        return response;
      }

      // Re-throw the error if it's not handled
      throw error;
    }
  }
}

module.exports = PlaylistsHandler;