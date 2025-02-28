const Joi = require('joi');

const CollaborationPayloadSchema = Joi.object({
  songId: Joi.string().required(),
  userId: Joi.string().required(),
});

module.exports = { CollaborationPayloadSchema };