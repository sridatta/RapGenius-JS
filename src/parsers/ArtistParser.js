var cheerio = require("cheerio"),
  superAgent = require("superagent"),
  CONSTANTS = require("../constants/Constants"),
  Song = require("../model/Song"),
  Artist = require("../model/Artist"),
  StringUtils = require("../util/StringUtils"),
  querystring = require('querystring');


function fetchSongs(type, artist, artistLink, artistId, artistPage, callback) {
  var urls = CONSTANTS.Type2URLs[type];
  function fetch(page) {
    var params = {
      for_artist_page:artistPage,
      id:artistId,
      lyrics_seo:false,
      page:page,
      pagination:true,
      "search[by_artist]":artistPage,
      "search[unexplained_songs_last][]":"title",
      "search[unexplained_songs_last][]":"id"
    };

    var url = "http://rapgenius.com/songs?"+querystring.stringify(params)
    superAgent.get(url)
      .set("Accept", "text/html")
      .end(function(res){
        if(res.ok){
          var $ = cheerio.load(res.text);
          var songs = $(".song_list li");
          songs.each(function (index, song) {
            var songLinkElem = $(song).find(".song_link");
            songLinkElem.each(function (i, s) {
              var songLink = urls.base_url + $(s).attr("href");
              var songName = StringUtils.removeWhiteSpacesAndNewLines($(s).children(".title_with_artists").text());
              var rapSong = new Song(songName, artistLink, songLink);
              artist.addSong(rapSong);
            });
          });
          if(page < 2 && songs.length > 0) {
            fetch(page + 1)
          } else {
            callback(null, artist);
          }
        } else{
          console.log("An error occurred while trying to access lyrics[url=%s, status=%s]", url, res.status);
          return callback(new Error("Unable to access the page for lyrics [url=" + link + "]"));
        }
      });
  }

  fetch(1);

}


function parseArtistHTML(html, type, callback) {
  try {
    var urls = CONSTANTS.Type2URLs[type];
    var $ = cheerio.load(html);

    var artistElem = $(".canonical_name", "#main");
    var artistName = "";

    if (artistElem.length <= 0) {
      return new Error("Could not find artist");
    }

    //TODO either find a library that enables be to extract text from text nodes of direct
    // children or improve cheerio API
    artistElem = artistElem[0];

    artistElem.children.forEach(function (childElem) {
      if (childElem.type === "text") {
        artistName += StringUtils.removeWhiteSpacesAndNewLines(childElem.data);
      }
    });

    var artistLink = urls.artist_url + artistName.replace(" ", "-");
    var rapArtist = new Artist(artistName, artistLink);

    var artistId = artistName.replace(" ", "-")
    var artistPage = $(".edit_artist").attr("action").split("/")[2];
    return fetchSongs(type, rapArtist, artistLink, artistId, artistPage, callback);
  } catch (e) {
    console.log("An error occured while trying to parse the artist: [html=" + html + "], error: " + e);
    return callback(new Error("Unable to parse artist details results from RapGenius"));
  }
}

module.exports.parseArtistHTML = parseArtistHTML;
