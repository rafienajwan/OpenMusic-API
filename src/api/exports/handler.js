const autoBind = require('auto-bind');

class ExportsHandler {
  constructor(ProducerService, playlistsService, validator) {
    this._ProducerService = ProducerService;
    this._playlistsService = playlistsService;
    this._validator = validator;

    autoBind(this);
  }

  async postExportPlaylistsHandler(request, h) {
    this._validator.validateExportPlaylistsPayload(request.payload);

    const { id: credentialId } = request.auth.credentials;
    const { playlistId } = request.params;

    // verify playlist ownership
    await this._playlistsService.verifyPlaylistOwner(playlistId, credentialId);

    // verify playlist existence
    const playlistExists = await this._playlistsService.checkPlaylistExists(playlistId);
    if (!playlistExists) {
      const response = h.response({
        status: 'fail',
        message: 'Playlist not found',
      });
      response.code(404);
      return response;
    }

    const message = {
      userId: credentialId,
      targetEmail: request.payload.targetEmail,
    };

    await this._ProducerService.sendMessage('export:playlists', JSON.stringify(message));

    const response = h.response({
      status: 'success',
      message: 'Permintaan Anda sedang kami proses',
    });
    response.code(201);
    return response;
  }
}

module.exports = ExportsHandler;