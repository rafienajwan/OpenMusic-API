const mapAlbumsToModel = ({
  id,
  name,
  year,
  songs = [],
}) => ({
  id,
  name,
  year,
  songs,
});

module.exports = { mapAlbumsToModel };