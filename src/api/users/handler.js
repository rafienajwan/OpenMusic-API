const autoBind = require('auto-bind');
const ClientError = require('../../exceptions/ClientError');

class UsersHandler {
  constructor(service, validator) {
    this._service = service;
    this._validator = validator;

    autoBind(this);
  }

  async postUserHandler(request, h) {
    this._validator.validateUserPayload(request.payload);
    const { username, password, fullname } = request.payload;

    const userId = await this._service.addUser({ username, password, fullname });

    if (!userId) {
      throw new ClientError('User failed to add', 500);
    }

    const response = h.response({
      status: 'success',
      message: 'User successfully added',
      data: {
        userId,
      },
    });
    response.code(201);
    return response;
  }

  async getUserByIdHandler(request, h) {
    const { id } = request.params;

    const { user, source } = await this._service.getUserById(id);

    const response = h.response({
      status: 'success',
      data: {
        user,
      },
    });
    response.header('X-Data-Source', source);
    response.code(200);
    return response;
  }

  async getUsersByUsernameHandler(request, h) {
    try {
      const { username = '' } = request.query;
      const users = await this._service.getUsersByUsername(username);
      return {
        status: 'success',
        data: {
          users,
        },
      };
    } catch (error) {
      if (error instanceof ClientError) {
        const response = h.response({
          status: 'fail',
          message: error.message,
        });
        response.code(error.statusCode);
        return response;
      }

      // Server ERROR!
      const response = h.response({
        status: 'error',
        message: 'Sorry, something went wrong.',
      });
      response.code(500);
      console.error(error);
      return response;
    }
  }
}

module.exports = UsersHandler;