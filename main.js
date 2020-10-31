const Discord = require("discord.js");
const got = require("got");
const ytdl = require("ytdl-core");
const YouTube = require("simple-youtube-api");
const covid = require("novelcovid");
require("dotenv").config();
const client = new Discord.Client();
const youtube = new YouTube(process.env.YOUTUBE_API);
const prefix = "$";
var version = "1.0";

const queue = new Map();

client.once("ready", () => {
  console.log("DES-Bot is online!");
});

client.on("message", async (message) => {
  client.user.setPresence({
    activity: { name: `DES-Bot.gg | ${prefix}help` },
  });
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  const args = message.content.slice(prefix.length).split(/ +/);
  const searchString = args.join(" ");
  const url = args[0] ? args[0].replace(/<(._)>/g, "$1") : "";
  const serverQueue = queue.get(message.guild.id);
  const command = args.shift().toLowerCase();
  switch (command) {
    case "help":
      message.channel.send(
        new Discord.MessageEmbed().setColor('RANDOM').setTitle(
          `These are my list of supported commands:`
        ).setDescription(` **$help** - Display the help menu
      **$poll <question>** - Generates a poll for the specified question
      **$meme** - Generate a random meme
      **$setnick <User> <nickname>** - Changes the nickname of the specified user
      **$covid** - Displays the covid statistics for India
      **$play <song name> or <song url>** - Plays the specified song in voice channel
      **$stop** - Stops the queue and leave the voice channel 
      **$skip** - Skip the current song in the queue and move to the next song
      **$pause** - Pause the current song
      **$resume** - Resume the current song
      **$queue** - Displays the whole queue
      **$np** - Displays the current playing song
      **$volume <volume value>**-Sets the volume for the song`)
      );

      break;
    case "poll":
      const Embed = new Discord.MessageEmbed()
        .setColor(0xffc300)
        .setTitle("Initiate Poll")
        .setDescription("$poll to initiate a simple yes or no poll");
      if (!args[0]) {
        message.channel.send(Embed);
      }
      let msgArgs = args.join(" ");
      message.channel
        .send("📝 " + "**" + msgArgs + "**")
        .then((messageReaction) => {
          messageReaction.react("👍");
          messageReaction.react("👎");
          message.delete({ timeout: 3000 }).catch(console.error);
        });
      break;

    case "meme":
      GetImage(message);
      break;
    case "setnick":
      let name = args.slice(1).join(" ");
      if (!message.member.permissions.has("ADMINISTRATOR"))
        return message.reply("You cannot use this command!");
      if (!args[0])
        return message.channel.send("Who's nickname should I change");
      const User =
        message.mentions.members.first() ||
        message.guild.members.cache.get(args[0]) ||
        message.member;
      if (!User) return message.channel.send("User not found 🥺 ");
      if (!name) return message.channel.send(`Please provide a nickname`);
      if (!User.kickable)
        return message.channel.send("I cannot change their nickname");
      await User.setNickname(name);
      const Embed1 = new Discord.MessageEmbed()
        .setTitle("Nickname changed")
        .setDescription(
          `${message.author.username} changed the name of ${User.user.username}`
        )
        .setColor("RANDOM")
        .setTimestamp();
      message.channel.send(Embed1);
      break;

    case "covid":
      const covidStats = await covid.countries({ country: "India" });
      message.channel.send(
        new Discord.MessageEmbed()
          .setTitle("COVID-19 Stats For India")
          .setColor("RANDOM")
          .addFields(
            {
              name: "Cases",
              value: covidStats.cases.toLocaleString(),
              inline: true,
            },
            {
              name: "Cases Today",
              value: covidStats.todayCases.toLocaleString(),
              inline: true,
            },
            {
              name: "Deaths",
              value: covidStats.deaths.toLocaleString(),
              inline: true,
            },
            {
              name: "Deaths Today",
              value: covidStats.todayDeaths.toLocaleString(),
              inline: true,
            },
            {
              name: "Recovered",
              value: covidStats.recovered.toLocaleString(),
              inline: true,
            },
            {
              name: "Recovered Today",
              value: covidStats.todayRecovered.toLocaleString(),
              inline: true,
            },
            {
              name: "Infected Right Now",
              value: covidStats.active.toLocaleString(),
              inline: true,
            },
            {
              name: "Critical Condition",
              value: covidStats.critical.toLocaleString(),
              inline: true,
            },
            {
              name: "Tested Till Now",
              value: covidStats.tests.toLocaleString(),
              inline: true,
            }
          )
      );
      break;

    case "play":
      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel)
        return message.channel.send(
          "You need to be in a voice channel to play music"
        );
      const permissions = voiceChannel.permissionsFor(message.client.user);
      if (!permissions.has("CONNECT"))
        return message.channel.send(
          "I donot have permission to connect to the voice channel"
        );
      if (!permissions.has("SPEAK"))
        return message.channel.send(
          "I donot have permission to speak in the voice channel"
        );
      try {
        var video = await youtube.getVideoByID(url);
      } catch (error) {
        try {
          var videos = await youtube.searchVideos(searchString, 1);
          var video = await youtube.getVideoByID(videos[0].id);
        } catch (error) {
          return message.channel.send("Couldnot find any search results");
        }
      }
      const song = {
        id: video.id,
        title: Discord.Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`,
      };
      if (!serverQueue) {
        const queueConstruct = {
          textChannel: message.channel,
          voiceChannel: voiceChannel,
          connection: null,
          songs: [],
          volume: 5,
          playing: true,
        };
        queue.set(message.guild.id, queueConstruct);
        queueConstruct.songs.push(song);
        try {
          var connection = await voiceChannel.join();
          queueConstruct.connection = connection;
          playSong(message.guild, queueConstruct.songs[0]);
        } catch (error) {
          console.log(`There is error connecting to voice channel:${error}`);
          queue.delete(message.guild.id);
          return message.channel.send(
            `There was an error connecting to the voice channel:${error}`
          );
        }
      } else {
        serverQueue.songs.push(song);
        return message.channel.send(
          `**${song.title}** has been added to the queue`
        );
      }
      return undefined;

      break;

    case "stop":
      if (!message.member.voice.channel)
        return message.channel.send(
          "You need to be in a voice channel to stop a music"
        );
      if (!serverQueue)
        return message.channel.send(`There is no song to play in the queue`);
      serverQueue.songs = [];
      serverQueue.connection.dispatcher.end();
      message.channel.send("The music has been stopped");
      return undefined;
      break;

    case "skip":
      if (!message.member.voice.channel)
        return message.channel.send(
          "You need to be in a voice channel to skip a music"
        );
      if (!serverQueue) return message.channel.send(`There is nothing playing`);
      serverQueue.connection.dispatcher.end();
      message.channel.send("I have skipped the music for you.");
      return undefined;
      break;

    case "volume":
      if (!message.member.voice.channel)
        return message.channel.send("You need to be in a voice channel");
      if (!serverQueue) return message.channel.send(`There is nothing playing`);
      if (!args[0])
        return message.channel.send(`That volume is **${serverQueue.volume}**`);
      if (isNaN(args[0]))
        return message.channel.send(
          `That is not a valid amount to change the volume to`
        );
      serverQueue.volume = args[0];
      serverQueue.connection.dispatcher.setVolumeLogarithmic(args[0] / 5);
      message.channel.send(`I have changed the volume to **${args[0]}**`);
      return undefined;
      break;

    case "np":
      if (!message.member.voice.channel)
        return message.channel.send("You need to be in a voice channel");
      if (!serverQueue) return message.channel.send(`There is nothing playing`);
      message.channel.send(`Now playing: **${serverQueue.songs[0].title}**`);
      return undefined;
      break;

    case "queue":
      if (!serverQueue) return message.channel.send(`There is nothing playing`);
      message.channel.send(
        `__**Song Queue:**__
        ${serverQueue.songs.map((song) => `**-**${song.title}`).join("\n")}
        **Now Playing:** ${serverQueue.songs[0].title}
        `,
        { split: true }
      );
      return undefined;
      break;

    case "pause":
      if (!message.member.voice.channel)
        return message.channel.send(
          "You need to be in a voice channel to use pause command"
        );
      if (!serverQueue) return message.channel.send(`There is nothing playing`);
      if (!serverQueue.playing)
        return message.channel.send("The music is already paused");
      serverQueue.playing = false;
      serverQueue.connection.dispatcher.pause();
      message.channel.send("The songs has been paused.");
      return undefined;
      break;

    case "resume":
      if (!message.member.voice.channel)
        return message.channel.send(
          "You need to be in a voice channel to use the resume command"
        );
      if (!serverQueue) return message.channel.send(`There is nothing playing`);
      if (serverQueue.playing)
        return message.channel.send("The music is already playing");
      serverQueue.playing = true;
      serverQueue.connection.dispatcher.resume();
      message.channel.send("I have resumed the music");
      return undefined;
  }
});

const playSong = (guild, song) => {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }
  const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      serverQueue.songs.shift();
      playSong(guild, serverQueue.songs[0]);
    })
    .on("error", (error) => {
      console.log(error);
    });
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send(`Started Playing **${song.title}**`);
};

const GetImage = (message) => {
  const embed = new Discord.MessageEmbed();
  got("https://www.reddit.com/r/memes/random/.json").then((response) => {
    // console.log(response.body)
    let content = JSON.parse(response.body);
    // let content = response.body;
    let permalink = content[0].data.children[0].data.permalink;
    let memeUrl = `https://reddit.com${permalink}`;
    let memeImage = content[0].data.children[0].data.url;
    let memeTitle = content[0].data.children[0].data.title;
    let memeUpvotes = content[0].data.children[0].data.ups;
    let memeDownvotes = content[0].data.children[0].data.downs;
    let memeNumComments = content[0].data.children[0].data.num_comments;
    embed.setTitle(`${memeTitle}`);
    embed.setURL(`${memeUrl}`);
    embed.setImage(memeImage);
    embed.setColor("RANDOM");
    embed.setFooter(
      `👍 ${memeUpvotes} 👎 ${memeDownvotes} 💬 ${memeNumComments}`
    );
    message.channel.send(embed);
  });
};

client.login(process.env.DISCORD_TOKEN);
