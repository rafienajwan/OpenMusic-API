/* eslint-disable camelcase */

const mapAlbumsToModel = ({
  id,
  name,
  year,
  cover_url,
  songs = [],
}) => ({
  id,
  name,
  year,
  coverUrl: cover_url,
  songs,
});

module.exports = { mapAlbumsToModel };