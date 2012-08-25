var util = require('util');
var TtBot = require('ttapi');
var repl = require('repl');
var fs = require('fs');

// A turntable.fm bot implemented with ttapi. 

function RoboDJ(properties) {
    
    this.auth   = properties.bot.auth;
    this.userID = properties.bot.userID;
    this.roomID = properties.bot.roomID;
    this.bot = null;
    this.filter = "";
    this.lastSongIdPlayed = "";
    this.botName = "";
    this.masterId = properties.bot.masterId;
	  this.masterName = properties.bot.masterName;
    this.masterOnlyCommands = properties.bot.masterOnlyCommands;
    this.djAgainOnKnockedDown = properties.bot.djAgainOnKnockedDown;
    this.lastCommand = "";

    var self = this;
    
    // Connect to Turntable and configure Bot 
    this.connect = function() {
        this.bot = new TtBot(this.auth, this.userID, this.roomID);
        
        // On a new song, 75% chance of bopping to it after 10 seconds.
        // If bot is playing the song, load up more songs to bot's playlist.
        this.bot.on('newsong', function(data) {
            util.log("A new song is playing: " + util.inspect(data));
            if (Math.random() > 0.25) {
                setTimeout(function() {
                    self.bot.bop();
                }, 10000);
            }
            if (self.bot.currentDjId === self.userID) {
                self.lastSongIdPlayed = self.bot.currentSongId;
                self.findAndAddSong(0);
            }
        });

		// Welcome new people
		this.bot.on('registered',	function (data) { 
		    if (data.user[0].userid == self.userID) { 
          // announces himself
		    } else if (data.user[0].userid == self.masterId) { 
          // if the master arrives announce him specifically
		      self.bot.speak('ALL BOW BEFORE '+self.masterName+'! The master has arrived!');
		    } else {
		      self.bot.pm(('Hey '+data.user[0].name+'! I am a robot DJ created by '+self.masterName+' to DJ for you. Welcome!'), data.user[0].userid ); //welcome the rest
			    self.bot.speak('Hi '+data.user[0].name+'!');
		    }
		});
        
        // On first joining a room, wait 3 seconds before trying to DJ
        // and wait 2 seconds and try to find out bot's own name.
        this.bot.on('roomChanged', function(data) {
          util.log("Joined room");
          setTimeout(self.tryToDj, 3000);
          setTimeout(self.findDjName, 2000);
			    setTimeout(self.bot.speak('BELAL_BOT IS IN DA HOUSE'), 5000);
        });
        
        // When bot is done playing his own song, prune playlist
        this.bot.on('endsong', function(data) {
            if (self.bot.currentDjId === self.userID) {
                self.prunePlaylist();
            }
        });
        
        // If djAgainOnKnockedDown is true, try to become a DJ again after 10 seconds.
        this.bot.on('rem_dj', function(data) {
            if (data.user[0].userid === self.userID && self.djAgainOnKnockedDown && self.lastCommand !== "down") {
                util.log("I've been kicked off the DJ booth, I'll try to get back up!");
                setTimeout(self.tryToDj, 10000);
            }
        });

		// Skip songs that the master lames
		this.bot.on('update_votes', function(data) {
			data.room.metadata.votelog.forEach(function(vote) {
		    	if (vote[0] == self.masterId && vote[1] == "down") {
					if (self.bot.currentDjId === self.userID) {
			  			self.bot.speak("Sorry master! I will skip this song.");
						self.bot.skip();
					}
					else{
						self.bot.vote('down');
					}
				}
				if (vote[0] == self.masterId && vote[1] == "up") {
					self.bot.vote('up');
				}
			});
		});	
				
		
        
        // Responds to chat room messages
        this.bot.on('speak', function(data) {
            
            // Change music filter
            var m = data.text.match(/^\/play (.*)/);
            if (m && self.authorizedCommand("play", data.userid)) {
                if (m[1] !== "") {
					if (m[1] =="reset") {
						self.filter = "";
					}
					else {
                    	self.filter = m[1];
					}
                    self.bot.speak("I will try to play " + self.filter);
                    self.findAndAddSong(0);
                }
            }
            
            // Stop DJing
            if (data.text.match(/^\/down/) && self.authorizedCommand("down", data.userid)) {
                self.bot.remDj();
            }
            
            // Try to get up and DJ!
            if (data.text.match(/^\/up/) && self.authorizedCommand("up", data.userid)) {
                self.tryToDj();
            }

            // Skip song
            if (data.text.match(/^\/skip/) && self.authorizedCommand("skip", data.userid)) {
                self.bot.skip();
            }
            
            // Respond to bot's own name
            var pattern = new RegExp(("^"+self.botName+"$"), "i");
            if (pattern.test(data.text)) {
                self.bot.speak("Type '/play <string>' to change my taste in music e.g. /play indie");
            }
        });
        
    };

    // Return true if the bot should accept cmd from userId
    this.authorizedCommand = function(cmd, userId) {
        this.lastCommand = cmd;
        if (! this.masterId || this.masterId === "") {
            return true;
        }
        if (userId === this.masterId) {
            return true;
        } else {
            if (! this.masterOnlyCommands || this.masterOnlyCommands.indexOf(cmd) === -1) {
                return true;
            }
        }
        
        return false;
    };

    // Figure out the bot's own name
    this.findDjName = function() {
        self.bot.userInfo(function(resp) {
            var name = resp.name;
            if ( (/^@/).test(name) ) {
                name = name.substring(1);
            }
            self.botName = name;
            util.log("My name is " + self.botName);
			return name;
        });
    };

    // Try to DJ. If all the DJ spots are full, wait one minute then 
    // check again. Upon becoming a DJ, add some new songs to playlist.
    this.tryToDj = function() {
        self.bot.roomInfo(function(resp) {
            util.log(util.inspect(resp));
            if (resp.room.metadata.djcount < resp.room.metadata.max_djs) {
                util.log("Room has open DJ spots, adding DJ...");
                self.bot.addDj();
                self.findAndAddSong(0);
            } else {
                util.log("Room has no open DJ spots, waiting...");
                setTimeout(self.tryToDj, 60000);
            }
        });
    };

    // Try to keep the playlist limited to no more than 20 songs. 
    this.prunePlaylist = function() {
        util.log("Attempting to prune playlist");
        self.bot.playlistAll(function(resp) {
            var playlistLength = resp.list.length;
            util.log("Playlist length is " + playlistLength);
            if (playlistLength > 20) {
                var excess = playlistLength - 20;
                for (var i = 1; i <= excess; i++) {
                    util.log("Removing song " + (playlistLength - i));
                    self.bot.playlistRemove(playlistLength - i);
                }
            }
        });
    };

    // Look for new songs to add to playlist. Get the up to top 100 rooms and find
    // the room titles that match the bot's filter. Add the current song playing in 
    // these rooms.
    this.findAndAddSong = function(index) {
        util.log("Finding a new song to add");
        this.bot.listRooms(index, function(resp) {
            var added = 0;
            resp.rooms.sort(self.randOrd).forEach(function(room) {
                var pattern = new RegExp(self.filter, "i");
                if (pattern.test(room[0].name)) {
                    var songId = room[0].metadata.current_song._id;
					var songName = room[0].metadata.current_song.metadata.song;
                    if (songId !== self.lastSongIdPlayed) {
                        self.bot.playlistAdd(songId);
                        util.log("Added song: " + songName + " from room " + room[0].name);
                        added++;
                    } else {
                        util.log("Not adding last song played with id " + songId);
                    }
                }
            });
            
            // Let everybody know the filter may not be any good.
            if (added == 0 && index<=100) {
				self.findAndAddSong(index+20);
            }

			if (added > 0) {
				self.bot.speak("Added " + added + " " + self.filter + " song(s) to playlist.");
			}	
            
            util.log("Added " + added + " songs to playlist.");
        });
    };

    // Dump out the playlist and its length to the console.
    this.logPlaylist = function() {
        util.log("Current Playlist");
        this.bot.playlistAll(function(resp) {
            resp.list.forEach(function(song) {
                util.log(util.inspect(song.metadata));
            });
            util.log("Playlist Length is " + resp.list.length);
        });
    };

	this.randOrd = function() {
	  return (Math.round(Math.random())-0.5);
	}

}

// Use properties file from current directory.
try {
    var properties = JSON.parse(fs.readFileSync("dj.properties"));
} catch (err) {
    util.log("Missing or corrupt dj.properties file in base directory?");
    throw err;
}

// Configure
var dj = new RoboDJ(properties);

// If webrepl is defined in the properties, configure and start it.
if (properties.webrepl) {
    var wr = require('webrepl');
    wr.start(properties.webrepl.port, properties.webrepl).context.dj = dj;
}

// Join and get started DJing!
dj.connect();
