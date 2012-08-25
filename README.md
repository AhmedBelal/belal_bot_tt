About
=================
A Turntable.fm bot built with node.js, forked from [RoboDj](https://github.com/mmattozzi/robodj). As your personal DJ, this bot fetches songs from the top rooms in Turntable, filtered by the genre of your choice (all genres by default). This bot has improved song population and randomization over the original RoboDj and caters to its master's likes/lames by skipping songs that the master lames.

Requires
=================
* node.js version >= 0.6.5
* A [turntable.fm](http://turntable.fm) account.

Configure
=================

    git clone git://github.com/AhmedBelal/belal_bot_tt.git
    cd robodj

Download the dependencies by cd-ing into the robodj directory and running:

    npm install

Copy dj.properties.sample to dj.properties

    cp dj.properties.sample dj.properties

Edit dj.properties to configure bot. You'll need to create an account for the bot to use. Use http://alaingilbert.github.com/Turntable-API/bookmarklet.html to find auth and login information. 

    vi dj.properties

Run
=================
To start up the bot normally:

    node robodj.js

Commands in Turntable
=================
In the turntable chat window, robodj responds to the following patterns:

* [name of bot] - Tells you something about himself
* /play [keyword] - Uses keyword as a source to find new music, this keyword should be something that is in the title of a Turntable room, e.g. indie
* /skip - Skips song
* /up - Tells bot to become a DJ at the next chance available
* /down - Tells bot to step down from DJing

